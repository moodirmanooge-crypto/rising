import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import {
  ClipboardCheck, History, Clock, CalendarDays, BookOpen, Users,
  Lock, CheckCircle2, AlertTriangle, CheckCheck, ShieldCheck, Pencil,
} from "lucide-react";

import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import PortalLayout, { StatusPill, initials } from "../components/PortalLayout";
import { ATTENDANCE_STATUSES, DAYS, studentGroups } from "../config/schoolOptions";
import { STUDENTS_COLLECTION, TEACHERS_COLLECTION } from "../config/collections";
import {
  saveTodayAttendance, subscribeTodaySession, subscribeTeacherAttendance,
  todayStr, todayDayName, getTeacherDays, getWindowState,
  formatTime12, formatDate, dayNameOf, formatTimestamp,
} from "../utils/attendance";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

export default function TeacherPortal() {
  const { user } = useAuth();
  const teacherId = user?.teacherId || user?.id;

  const [teacher, setTeacher] = useState(user);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState({});
  const [session, setSession] = useState(undefined);
  const [myRecords, setMyRecords] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("take");
  const [now, setNow] = useState(new Date());

  const today = todayDayName();
  const todayDate = todayStr();

  // Re-check the time window every 20 seconds
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(t);
  }, []);

  // Live teacher doc — if the admin changes the schedule it applies at once
  useEffect(() => {
    if (!teacherId) return;
    const unsub = onSnapshot(
      doc(db, TEACHERS_COLLECTION, teacherId),
      (snap) => snap.exists() && setTeacher({ ...user, ...snap.data() }),
      () => {}
    );
    return unsub;
  }, [teacherId]); // eslint-disable-line react-hooks/exhaustive-deps

  const teacherClass = teacher?.className || teacher?.class || "";
  const teacherSubject = teacher?.subject || (teacher?.subjects?.length ? teacher.subjects[0] : "");
  const teacherDays = getTeacherDays(teacher);
  const windowState = getWindowState(teacher, now);

  // Students (live)
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, STUDENTS_COLLECTION), orderBy("studentId"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setStudents(list);
        setStatuses((previous) => {
          const next = { ...previous };
          list.forEach((student) => {
            if (!next[student.studentId]) next[student.studentId] = "present";
          });
          return next;
        });
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

  // Today's session (live) + all my records (live)
  useEffect(() => {
    if (!teacherId) return;
    const unsubSession = subscribeTodaySession(teacherId, setSession, () => setSession(null));
    const unsubRecords = subscribeTeacherAttendance(teacherId, setMyRecords, () => {});
    return () => {
      unsubSession();
      unsubRecords();
    };
  }, [teacherId]);

  // Students in the teacher's class (e.g. "Open Classes – Xisaab").
  // If the student picked subjects, the teacher's subject must be one of
  // them; students with no subjects picked are included.
  const visibleStudents = useMemo(() => {
    if (!teacherClass || !teacherSubject) return [];
    return students.filter((student) => {
      const groups = studentGroups(student);
      const legacyClass = student.class || student.studentClass || "";
      const inClass =
        groups.some((g) => normalize(g) === normalize(teacherClass)) ||
        normalize(legacyClass) === normalize(teacherClass);
      const studentSubjects = Array.isArray(student.subjects)
        ? student.subjects
        : student.subject
        ? [student.subject]
        : [];
      const subjectOk =
        studentSubjects.length === 0 ||
        studentSubjects.some((s) => normalize(s) === normalize(teacherSubject));
      return inClass && subjectOk;
    });
  }, [students, teacherClass, teacherSubject]);

  const alreadySubmitted = !!session;
  const canMark = !alreadySubmitted && windowState === "open";

  const todayRecords = myRecords.filter((r) => r.date === todayDate);

  const draftCounts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0 };
    visibleStudents.forEach((s) => {
      const st = statuses[s.studentId] || "present";
      c[st]++;
    });
    return c;
  }, [visibleStudents, statuses]);

  function setStatus(studentId, status) {
    setStatuses((previous) => ({ ...previous, [studentId]: status }));
  }

  function markAll(status) {
    setStatuses((previous) => {
      const next = { ...previous };
      visibleStudents.forEach((s) => (next[s.studentId] = status));
      return next;
    });
  }

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      if (!teacherId) throw new Error("Teacher ID is missing.");
      if (!teacherClass) throw new Error("Teacher class is missing.");
      if (!teacherSubject) throw new Error("Teacher subject is missing.");

      const state = getWindowState(teacher, new Date());
      if (state === "not-today") throw new Error(`Today is ${today}. Your attendance days are ${teacherDays.join(", ")}.`);
      if (state === "before") throw new Error(`Attendance opens at ${formatTime12(teacher.startTime)}.`);
      if (state === "after") throw new Error(`Attendance closed at ${formatTime12(teacher.endTime)}.`);

      const toSave = {};
      const studentNames = {};
      visibleStudents.forEach((student) => {
        toSave[student.studentId] = statuses[student.studentId] || "present";
        studentNames[student.studentId] = student.fullName || "";
      });

      await saveTodayAttendance(teacherId, toSave, {
        teacherName: teacher?.fullName || teacher?.username || "",
        className: teacherClass,
        subject: teacherSubject,
        startTime: teacher?.startTime || "",
        endTime: teacher?.endTime || "",
        studentNames,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save attendance.");
    } finally {
      setSaving(false);
    }
  }

  // History grouped by date
  const history = useMemo(() => {
    const map = new Map();
    myRecords.forEach((r) => {
      if (!map.has(r.date)) map.set(r.date, []);
      map.get(r.date).push(r);
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [myRecords]);

  const timeText = teacher?.startTime
    ? `${formatTime12(teacher.startTime)} – ${formatTime12(teacher.endTime)}`
    : "Any time";

  let banner;
  if (session === undefined) {
    banner = null;
  } else if (alreadySubmitted) {
    banner = (
      <div className="banner banner-green">
        <CheckCircle2 size={22} />
        <div>
          <strong>Today's attendance is saved</strong>
          <span>
            {session.studentCount} students • submitted {formatTimestamp(session.submittedAt)}. Locked until your next attendance day.
          </span>
        </div>
      </div>
    );
  } else if (windowState === "open") {
    banner = (
      <div className="banner banner-blue">
        <Clock size={22} />
        <div>
          <strong>Attendance is open now</strong>
          <span>{teacher?.endTime ? `Save before ${formatTime12(teacher.endTime)}.` : "Mark each student and save once for today."}</span>
        </div>
      </div>
    );
  } else if (windowState === "before") {
    banner = (
      <div className="banner banner-amber">
        <Lock size={22} />
        <div>
          <strong>Attendance opens at {formatTime12(teacher.startTime)}</strong>
          <span>You can prepare the list, but saving is only allowed during {timeText}.</span>
        </div>
      </div>
    );
  } else if (windowState === "after") {
    banner = (
      <div className="banner banner-red">
        <AlertTriangle size={22} />
        <div>
          <strong>Attendance time is over</strong>
          <span>Today's window ({timeText}) has closed. Contact the admin if needed.</span>
        </div>
      </div>
    );
  } else {
    banner = (
      <div className="banner banner-gray">
        <CalendarDays size={22} />
        <div>
          <strong>No attendance today</strong>
          <span>Today is {today}. Your attendance days: {teacherDays.join(", ")}.</span>
        </div>
      </div>
    );
  }

  const nav = [
    { key: "take", label: "Take Attendance", Icon: ClipboardCheck },
    { key: "history", label: "My History", Icon: History },
  ];

  return (
    <PortalLayout
      role="teacher"
      title={tab === "take" ? "Take Attendance" : "My Attendance History"}
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
            <div><BookOpen size={16} /><span>Subject</span><strong>{teacherSubject || "Not assigned"}</strong></div>
            <div><Users size={16} /><span>Class</span><strong>{teacherClass || "Not assigned"}</strong></div>
            <div><Clock size={16} /><span>Time</span><strong>{timeText}</strong></div>
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
            {banner}
            {error && <p className="error">{error}</p>}

            {alreadySubmitted ? (
              <div className="panel">
                <div className="section-head">
                  <h2>Saved today ({todayRecords.length})</h2>
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
                  No students in class <b>{teacherClass || "—"}</b> are registered for <b>{teacherSubject || "—"}</b>.
                </span>
              </div>
            ) : (
              <div className="panel">
                <div className="section-head">
                  <div>
                    <h2>Students ({visibleStudents.length})</h2>
                    <p className="muted-sm">{teacherSubject} • {teacherClass}</p>
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
                  <span className="mc amber">{draftCounts.late} Late</span>
                  <span className="mc blue">{draftCounts.excused} Excused</span>
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
                        <div className="seg">
                          {ATTENDANCE_STATUSES.map((s) => (
                            <button
                              key={s.value}
                              type="button"
                              className={`seg-btn tone-${s.tone} ${statuses[student.studentId] === s.value ? "active" : ""}`}
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
                  <div className="save-bar">
                    <span>{visibleStudents.length} students • saved once per day</span>
                    <button type="button" className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : "Save Today's Attendance"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {tab === "history" && (
          history.length === 0 ? (
            <div className="panel empty">
              <History size={34} />
              <strong>No attendance yet</strong>
              <span>Sessions you save will appear here.</span>
            </div>
          ) : (
            history.map(([date, list]) => {
              const c = { present: 0, absent: 0, late: 0, excused: 0 };
              list.forEach((r) => c[r.status]++);
              const pending = list.filter((r) => !r.reviewed).length;
              return (
                <details key={date} className="session-card collapsible">
                  <summary className="session-head">
                    <div className="session-teacher">
                      <div className="date-block">
                        <strong>{date.slice(8, 10)}</strong>
                        <span>{formatDate(date).split(" ")[1]}</span>
                      </div>
                      <div>
                        <strong>{dayNameOf(date)}</strong>
                        <span>{list.length} students</span>
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