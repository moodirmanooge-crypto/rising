import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import {
  ClipboardCheck, History, Clock, CalendarDays, BookOpen, Users, Trophy,
  Lock, CheckCircle2, AlertTriangle, CheckCheck, ShieldCheck, Pencil, School,
} from "lucide-react";

import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import PortalLayout, { StatusPill, initials } from "../components/PortalLayout";
import TeacherResults from "../components/TeacherResults";
import { ATTENDANCE_STATUSES, DAYS } from "../config/schoolOptions";
import { STUDENTS_COLLECTION, TEACHERS_COLLECTION } from "../config/collections";
import {
  saveTodayAttendance, subscribeTeacherTodaySessions, subscribeTeacherAttendance,
  todayStr, todayDayName, getTeacherDays, getTodaySchedule, scheduleText,
  formatTime12, formatDate, dayNameOf, formatTimestamp, periodText,
  getClassWindowState, classTodayPeriods, classCurrentPeriod, classNextPeriod, classDays, classNextDay,
} from "../utils/attendance";
import {
  teacherAssignments, teacherAllSubjects, classKey, sameGroup, studentsForClass,
} from "../utils/teacherClasses";
import "../styles/teacherPortal.css";

// Macallinku wuxuu calaamadeeyaa Present ama Absent oo kaliya.
// Late / Excused waxaa beddeli kara admin-ka (Attendance review).
const TEACHER_STATUSES = ATTENDANCE_STATUSES.filter((s) => s.value === "present" || s.value === "absent");

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

// Record / session ma u yahay class-kan? (kuwa hore classKey ma lahayn)
// Xaadirin / session ma fasalkan baa? (classKey ama magaca — xitaa magac hore
// sida "Preparation – B Duhurley" iyo kan cusub "Fasalada Diyaarinta – B Duhurley")
function belongsToClass(item, className) {
  if (item?.classKey && item.classKey === classKey(className)) return true;
  return sameGroup(item?.className, className);
}

export default function TeacherPortal() {
  const { user, logout } = useAuth();
  const teacherId = user?.teacherId || user?.id;

  const [teacher, setTeacher] = useState(user);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState({}); // { [classKey]: { [sid]: status } }
  const [sessions, setSessions] = useState(undefined); // undefined = loading
  const [myRecords, setMyRecords] = useState([]);
  const [savingKey, setSavingKey] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("take");
  const [activeClass, setActiveClass] = useState("");
  const [now, setNow] = useState(new Date());

  const today = todayDayName();
  const todayDate = todayStr();

  // Re-check the time window every 20 seconds
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(t);
  }, []);

  // Live teacher doc — if the admin changes classes/schedule it applies at once
  useEffect(() => {
    if (!teacherId) return;
    const unsub = onSnapshot(
      doc(db, TEACHERS_COLLECTION, teacherId),
      (snap) => {
        // Admin-ku haddii uu tirtiro akoonka -> si toos ah ayaa looga saarayaa
        if (!snap.exists()) {
          logout();
          return;
        }
        setTeacher({ ...user, ...snap.data() });
      },
      () => {}
    );
    return unsub;
  }, [teacherId]); // eslint-disable-line react-hooks/exhaustive-deps

  const assignments = useMemo(() => teacherAssignments(teacher), [teacher]);
  const allSubjects = useMemo(() => teacherAllSubjects(teacher), [teacher]);
  const teacherDays = getTeacherDays(teacher);
  const todaySchedule = getTodaySchedule(teacher, now);

  // Class-ka hadda la furay. Default: class-ka xiisaddiisu hadda socoto,
  // haddii kale kan ugu horreeya.
  const current =
    assignments.find((a) => a.className === activeClass) ||
    assignments.find((a) => getClassWindowState(teacher, a.className, now) === "open") ||
    assignments[0] ||
    null;
  const currentKey = current ? classKey(current.className) : "";

  // Waqtiga xaadirintu waa FASAL-FASAL: class kasta xiisadihiisa oo keliya
  // ayaa la xaadirin karaa (macallin Class 8 iyo English leh kuma qaldamo).
  const windowState = current ? getClassWindowState(teacher, current.className, now) : "not-today";
  const classPeriods = current ? classTodayPeriods(teacher, current.className, now) : [];
  const classSchedule = {
    periods: classPeriods,
    startTime: classPeriods[0]?.startTime || "",
    endTime: classPeriods[classPeriods.length - 1]?.endTime || "",
  };
  const currentDays = current ? classDays(teacher, current.className) : teacherDays;

  // Students (live)
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, STUDENTS_COLLECTION), orderBy("studentId"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setStudents(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("students1 error:", err);
        setError("Unable to load students.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  // Today's sessions (one per class) + all my records (live).
  // todayDate ayaa ku jira dependencies-ka si maalinta cusub loo dhagaysto.
  useEffect(() => {
    if (!teacherId) return;
    setSessions(undefined);
    const unsubSession = subscribeTeacherTodaySessions(teacherId, setSessions, () => setSessions([]));
    const unsubRecords = subscribeTeacherAttendance(teacherId, setMyRecords, () => {});
    return () => {
      unsubSession();
      unsubRecords();
    };
  }, [teacherId, todayDate]);

  // Ardayda class kasta (maadooyinka macallinka ee class-kaas)
  const studentsByClass = useMemo(() => {
    const map = {};
    assignments.forEach((a) => {
      map[classKey(a.className)] = studentsForClass(students, a.className, a.subjects);
    });
    return map;
  }, [students, assignments]);

  function sessionFor(className) {
    if (!sessions) return undefined;
    return sessions.find((s) => belongsToClass(s, className)) || null;
  }

  const visibleStudents = current ? studentsByClass[currentKey] || [] : [];
  const session = current ? sessionFor(current.className) : null;
  const alreadySubmitted = !!session;
  const canMark = sessions !== undefined && !alreadySubmitted && windowState === "open";
  const classStatuses = statuses[currentKey] || {};
  const statusOf = (sid) => classStatuses[sid] || "present";

  const todayRecords = current
    ? myRecords.filter((r) => r.date === todayDate && belongsToClass(r, current.className))
    : [];

  const doneCount = assignments.filter((a) => sessionFor(a.className)).length;

  const draftCounts = useMemo(() => {
    const c = { present: 0, absent: 0 };
    visibleStudents.forEach((s) => (classStatuses[s.studentId] === "absent" ? c.absent++ : c.present++));
    return c;
  }, [visibleStudents, classStatuses]);

  function setStatus(studentId, status) {
    setStatuses((prev) => ({
      ...prev,
      [currentKey]: { ...(prev[currentKey] || {}), [studentId]: status },
    }));
  }

  function markAll(status) {
    setStatuses((prev) => {
      const next = { ...(prev[currentKey] || {}) };
      visibleStudents.forEach((s) => (next[s.studentId] = status));
      return { ...prev, [currentKey]: next };
    });
  }

  async function handleSave() {
    setError("");
    if (!current) return;
    setSavingKey(currentKey);
    try {
      if (!teacherId) throw new Error("Teacher ID is missing.");
      if (sessions === undefined) throw new Error("Fadlan sug ilbiriqsi — xogta maanta weli way soo dhacaysaa.");
      if (session) throw new Error(`Xaadirinta ${current.className} maanta horey ayaa loo keydiyay.`);
      if (visibleStudents.length === 0) throw new Error("Fasalkan arday kuma jiraan.");

      const at = new Date();
      const state = getClassWindowState(teacher, current.className, at);
      const periodsNow = classTodayPeriods(teacher, current.className, at);
      if (state === "not-today") {
        throw new Error(`${current.className}: maanta (${today}) xiisad ma laha. Maalmaha: ${currentDays.join(", ") || "—"}.`);
      }
      if (state === "before") throw new Error(`${current.className}: xaadirintu waxay furmaysaa ${formatTime12(periodsNow[0].startTime)}.`);
      if (state === "after") {
        throw new Error(`${current.className}: waqtiga xaadirintu wuu dhammaaday (${formatTime12(periodsNow[periodsNow.length - 1].endTime)}).`);
      }
      if (state === "between") {
        const np = classNextPeriod(teacher, current.className, at);
        throw new Error(np ? `${current.className}: xiisadda xigta waxay furmaysaa ${formatTime12(np.startTime)}.` : "Hadda xiisad ma jirto.");
      }
      const livePeriodNow = classCurrentPeriod(teacher, current.className, at);

      const toSave = {};
      const studentNames = {};
      visibleStudents.forEach((student) => {
        const st = statusOf(student.studentId);
        toSave[student.studentId] = st === "absent" ? "absent" : "present";
        studentNames[student.studentId] = student.fullName || "";
      });

      await saveTodayAttendance(teacherId, toSave, {
        teacherName: teacher?.fullName || teacher?.username || "",
        className: current.className,
        classKey: currentKey,
        subject: "",
        subjects: current.subjects,
        startTime: livePeriodNow?.startTime || "",
        endTime: livePeriodNow?.endTime || "",
        studentNames,
      });

      // U gudub class-ka xiga ee aan weli la xaadirin
      const next = assignments.find((a) => a.className !== current.className && !sessionFor(a.className));
      if (next) setActiveClass(next.className);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save attendance.");
    } finally {
      setSavingKey("");
    }
  }

  // History grouped by date + class
  const history = useMemo(() => {
    const map = new Map();
    myRecords.forEach((r) => {
      const key = `${r.date}|${r.className || ""}`;
      if (!map.has(key)) map.set(key, { date: r.date, className: r.className || "", list: [] });
      map.get(key).list.push(r);
    });
    return [...map.values()].sort((a, b) =>
      a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.className.localeCompare(b.className)
    );
  }, [myRecords]);

  // Waqtiga MAANTA (maalin kasta waqti gaar ah ayay yeelan kartaa)
  const timeText = scheduleText(todaySchedule);
  const classTimeText = scheduleText(classSchedule);
  const livePeriod = current ? classCurrentPeriod(teacher, current.className, now) : null;
  const upcoming = current ? classNextPeriod(teacher, current.className, now) : null;
  const nextDay = current ? classNextDay(teacher, current.className, now) : "";

  let banner;
  if (sessions === undefined || !current) {
    banner = null;
  } else if (alreadySubmitted) {
    banner = (
      <div className="banner banner-green">
        <CheckCircle2 size={22} />
        <div>
          <strong>{current.className} — attendance saved</strong>
          <span>
            {session.studentCount} students • submitted {formatTimestamp(session.submittedAt)}. 🔒 Lama beddeli karo —
            {nextDay ? ` xaadirinta xigta: ${nextDay}.` : " sug maalinta xaadirinta ee xigta."}
          </span>
        </div>
      </div>
    );
  } else if (windowState === "open") {
    banner = (
      <div className="banner banner-blue">
        <Clock size={22} />
        <div>
          <strong>
            {current.className} — attendance is open now
          </strong>
          <span>
            {livePeriod
              ? `Xiisadda: ${periodText(livePeriod)}. Keydi ka hor ${formatTime12(livePeriod.endTime)} — class kasta hal mar maalintii.`
              : "Mark each class and save it once for today."}
          </span>
        </div>
      </div>
    );
  } else if (windowState === "before") {
    banner = (
      <div className="banner banner-amber">
        <Lock size={22} />
        <div>
          <strong>{current.className} — attendance opens at {formatTime12(classSchedule.startTime)}</strong>
          <span>Liiska waad diyaarin kartaa, laakiin keydintu waxay furantahay oo keliya: {classTimeText}.</span>
        </div>
      </div>
    );
  } else if (windowState === "between") {
    banner = (
      <div className="banner banner-amber">
        <Clock size={22} />
        <div>
          <strong>{current.className} — xiisadda xigta: {upcoming ? periodText(upcoming) : "—"}</strong>
          <span>Hadda xiisadda fasalkan ma socoto. Maanta fasalkan: {classTimeText}.</span>
        </div>
      </div>
    );
  } else if (windowState === "after") {
    banner = (
      <div className="banner banner-red">
        <AlertTriangle size={22} />
        <div>
          <strong>{current.className} — attendance time is over</strong>
          <span>Waqtigii maanta ({classTimeText}) wuu dhammaaday. La xiriir maamulka haddii loo baahdo.</span>
        </div>
      </div>
    );
  } else {
    banner = (
      <div className="banner banner-gray">
        <CalendarDays size={22} />
        <div>
          <strong>{current.className} — no attendance today</strong>
          <span>
            Maanta waa {today}. Fasalkan maalmihiisa: {currentDays.join(", ") || "—"}
            {nextDay ? ` • xigta: ${nextDay}` : ""}.
          </span>
        </div>
      </div>
    );
  }

  const nav = [
    { key: "take", label: "Take Attendance", Icon: ClipboardCheck },
    { key: "results", label: "Exams & Results", Icon: Trophy },
    { key: "history", label: "My History", Icon: History },
  ];

  const TITLES = {
    take: "Take Attendance",
    results: "Exams & Results",
    history: "My Attendance History",
  };

  return (
    <PortalLayout
      role="teacher"
      title={TITLES[tab]}
      subtitle={`${today}, ${formatDate(todayDate)}`}
      nav={nav}
      active={tab}
      onNavigate={setTab}
    >
      <div className="stack">
        <div className="teacher-hero">
          <div className="teacher-hero-main">
            <div className="avatar-initials lg">{initials(teacher?.fullName)}</div>
            <div>
              <span className="hero-kicker">Welcome back</span>
              <h2>{teacher?.fullName || teacher?.username}</h2>
            </div>
          </div>
          <div className="teacher-hero-info">
            <div><BookOpen size={16} /><span>Subjects</span><strong>{allSubjects.join(", ") || "Not assigned"}</strong></div>
            <div><Users size={16} /><span>Classes</span><strong>{assignments.length || "Not assigned"}</strong></div>
            <div><Clock size={16} /><span>Today's time</span><strong>{timeText}</strong></div>
          </div>
          <div className="week-strip">
            {DAYS.map((d) => {
              const on = teacherDays.length === 0 || teacherDays.map(normalize).includes(normalize(d));
              return (
                <span key={d} className={`week-day ${on ? "on" : ""} ${normalize(d) === normalize(today) ? "today" : ""}`}>
                  {d.slice(0, 3)}
                </span>
              );
            })}
          </div>
        </div>

        {tab === "take" && (
          <>
            {assignments.length === 0 ? (
              <div className="panel empty">
                <School size={34} />
                <strong>No classes assigned</strong>
                <span>Admin-ka weli kuuma qoondayn class. La xiriir maamulka.</span>
              </div>
            ) : (
              <>
                <ClassPicker
                  assignments={assignments}
                  activeKey={currentKey}
                  studentsByClass={studentsByClass}
                  sessionFor={sessionFor}
                  doneCount={doneCount}
                  teacher={teacher}
                  now={now}
                  onPick={(name) => {
                    setError("");
                    setActiveClass(name);
                  }}
                />

                {banner}
                {error && <p className="error">{error}</p>}

                {alreadySubmitted ? (
                  <div className="panel">
                    <div className="section-head">
                      <div>
                        <h2>Saved today ({todayRecords.length})</h2>
                        <p className="muted-sm">{current.className}</p>
                      </div>
                      <span className="muted-sm">Changes by the admin appear here live</span>
                    </div>
                    <div className="record-list">
                      {todayRecords.map((r) => {
                        const edited = r.originalStatus && r.originalStatus !== r.status;
                        return (
                          <div key={r.id} className="record-row">
                            <div className="record-student">
                              <span className="avatar avatar-placeholder">{initials(r.studentName)}</span>
                              <div>
                                <strong>{r.studentName || r.studentId}</strong>
                                <span>ID {r.studentId}</span>
                              </div>
                            </div>
                            <div className="record-status">
                              <StatusPill status={r.status} />
                              {edited && (
                                <span className="edited-note"><Pencil size={12} /> Changed by admin (you marked {r.originalStatus})</span>
                              )}
                            </div>
                            <div className="record-review">
                              {r.reviewed ? (
                                <span className="approved-tag sm"><ShieldCheck size={14} /> Approved</span>
                              ) : (
                                <span className="pending-tag">Pending review</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : loading ? (
                  <div className="panel empty">Loading students…</div>
                ) : visibleStudents.length === 0 ? (
                  <div className="panel empty">
                    <Users size={34} />
                    <strong>No students found</strong>
                    <span>
                      Arday kuma diiwaangashana <b>{current.className}</b>. La xiriir admin-ka.
                    </span>
                  </div>
                ) : (
                  <div className="panel">
                    <div className="section-head">
                      <div>
                        <h2>{current.className} — Students ({visibleStudents.length})</h2>
                        <p className="muted-sm">Dhammaan ardayda ku diiwaangashan fasalkan</p>
                      </div>
                      <div className="quick-actions">
                        <button type="button" className="btn btn-light btn-sm" disabled={!canMark} onClick={() => markAll("present")}>
                          <CheckCheck size={14} /> All present
                        </button>
                        <button type="button" className="btn btn-light btn-sm" disabled={!canMark} onClick={() => markAll("absent")}>
                          All absent
                        </button>
                      </div>
                    </div>

                    <div className="mini-counts wide">
                      <span className="mc green">{draftCounts.present} Present</span>
                      <span className="mc red">{draftCounts.absent} Absent</span>
                    </div>

                    <div className="record-list">
                      {visibleStudents.map((student, index) => (
                        <div key={student.studentId || student.id} className="record-row">
                          <div className="record-student">
                            <span className="row-num">{index + 1}</span>
                            {student.photoUrl ? (
                              <img src={student.photoUrl} alt={student.fullName} className="avatar" />
                            ) : (
                              <span className="avatar avatar-placeholder">{initials(student.fullName)}</span>
                            )}
                            <div>
                              <strong>{student.fullName}</strong>
                              <span>ID {student.studentId}</span>
                            </div>
                          </div>
                          <div className="record-status wide">
                            <div className="seg tp-seg">
                              {TEACHER_STATUSES.map((s) => (
                                <button
                                  key={s.value}
                                  type="button"
                                  className={`seg-btn tone-${s.tone} ${statusOf(student.studentId) === s.value ? "active" : ""}`}
                                  disabled={!canMark}
                                  onClick={() => setStatus(student.studentId, s.value)}
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {windowState === "open" && (
                      <div className="save-bar tp-save-bar">
                        <span>
                          {draftCounts.present} present • {draftCounts.absent} absent • {current.className}
                          <em className="tp-once">Hal mar oo kaliya ayaa la keydin karaa</em>
                        </span>
                        <button type="button" className="btn btn-primary btn-lg" onClick={handleSave} disabled={!!savingKey}>
                          {savingKey === currentKey ? "Saving..." : `Save ${current.className}`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === "results" && (
          <TeacherResults teacher={{ ...teacher, teacherId }} students={students} loadingStudents={loading} />
        )}

        {tab === "history" && (
          history.length === 0 ? (
            <div className="panel empty">
              <History size={34} />
              <strong>No attendance yet</strong>
              <span>Sessions you save will appear here.</span>
            </div>
          ) : (
            history.map(({ date, className, list }) => {
              const c = { present: 0, absent: 0, late: 0, excused: 0 };
              list.forEach((r) => c[r.status]++);
              const pending = list.filter((r) => !r.reviewed).length;
              return (
                <details key={`${date}|${className}`} className="session-card collapsible">
                  <summary className="session-head">
                    <div className="session-teacher">
                      <div className="date-block">
                        <strong>{date.slice(8, 10)}</strong>
                        <span>{formatDate(date).split(" ")[1]}</span>
                      </div>
                      <div>
                        <strong>{dayNameOf(date)}{className && ` • ${className}`}</strong>
                        <span>{list.length} students{list[0]?.subject && ` • ${list[0].subject}`}</span>
                      </div>
                    </div>
                    <div className="mini-counts">
                      <span className="mc green">{c.present} P</span>
                      <span className="mc red">{c.absent} A</span>
                      <span className="mc amber">{c.late} L</span>
                      <span className="mc blue">{c.excused} E</span>
                    </div>
                    {pending ? (
                      <span className="pending-tag">{pending} pending</span>
                    ) : (
                      <span className="approved-tag sm"><ShieldCheck size={14} /> Approved</span>
                    )}
                  </summary>
                  <div className="record-list">
                    {list.map((r) => (
                      <div key={r.id} className="record-row">
                        <div className="record-student">
                          <span className="avatar avatar-placeholder">{initials(r.studentName)}</span>
                          <div>
                            <strong>{r.studentName || r.studentId}</strong>
                            <span>ID {r.studentId}</span>
                          </div>
                        </div>
                        <div className="record-status">
                          <StatusPill status={r.status} small />
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })
          )
        )}
      </div>
    </PortalLayout>
  );
}

// Classes-ka macallinka — mid mid u dooro oo u xaadiri
const STATE_LABEL = {
  open: "Open now",
  before: "Later today",
  between: "Next period later",
  after: "Closed",
  "not-today": "Not today",
};

function ClassPicker({ assignments, activeKey, studentsByClass, sessionFor, doneCount, teacher, now, onPick }) {
  return (
    <div className="panel">
      <div className="section-head">
        <div>
          <h2>My classes ({assignments.length})</h2>
          <p className="muted-sm">Dooro class-ka aad xaadirinayso — class kasta gooni ayaa loo keydiyaa.</p>
        </div>
        <span className={`pill ${doneCount === assignments.length ? "pill-green" : "pill-amber"}`}>
          <span className="pill-dot" />
          {doneCount}/{assignments.length} saved today
        </span>
      </div>
      <div className="tp-class-grid">
        {assignments.map((a) => {
          const key = classKey(a.className);
          const active = key === activeKey;
          const done = !!sessionFor(a.className);
          const state = getClassWindowState(teacher, a.className, now);
          const periods = classTodayPeriods(teacher, a.className, now);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(a.className)}
              className={`tp-class-card ${active ? "active" : ""} ${done ? "done" : ""}`}
            >
              <span className="tp-class-top">
                <strong>{a.className}</strong>
                {done ? (
                  <span className="tp-state done"><CheckCircle2 size={14} /> Saved</span>
                ) : (
                  <span className={`tp-state ${state === "open" ? "open" : ""}`}>{STATE_LABEL[state] || "Pending"}</span>
                )}
              </span>
              <span className="tp-class-sub">
                {(studentsByClass[key] || []).length} students
              </span>
              <span className="tp-class-sub">
                <Clock size={12} /> {periods.length ? periods.map(periodText).join(", ") : state === "open" ? "Any time" : "Maanta xiisad ma laha"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}