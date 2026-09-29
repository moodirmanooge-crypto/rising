import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import {
  LayoutDashboard, GraduationCap, BookOpen, ClipboardCheck, Search,
  Users, Clock, CheckCircle2, AlertCircle, Hourglass, CalendarDays,
  School, Wallet, Printer,
} from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import PortalLayout, { LiveBadge, initials } from "../components/PortalLayout";
import StudentForm from "../components/StudentForm";
import TeacherForm from "../components/TeacherForm";
import AttendanceReview from "../components/AttendanceReview";
import ClassesView from "../components/ClassesView";
import CashierForm from "../components/CashierForm";
import Receipt from "../components/Receipt";
import { studentGroups } from "../config/schoolOptions";
import { subscribePayments, currentMonth, formatMonth, money } from "../utils/payments";
import {
  subscribeAllAttendance, subscribeSessions, todayStr, todayDayName,
  getTeacherDays, getWindowState, formatTime12, formatDate, formatTimestamp,
} from "../utils/attendance";
import { STUDENTS_COLLECTION, TEACHERS_COLLECTION, CASHIERS_COLLECTION } from "../config/collections";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [tab, setTab] = useState("overview");
  const [studentSearch, setStudentSearch] = useState("");
  const [now, setNow] = useState(new Date());

  const adminName = user?.fullName || user?.username || "admin";

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const q = query(collection(db, STUDENTS_COLLECTION), orderBy("studentId"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setStudents(snap.docs.map((d) => d.data()));
        setLoadingStudents(false);
      },
      () => setLoadingStudents(false)
    );
    return unsub;
  }, []);

  useEffect(() => {
    // Whole teacher1 collection, live. Document ID = username.
    // Newest registered teacher shows first.
    const unsub = onSnapshot(
      collection(db, TEACHERS_COLLECTION),
      (snap) => {
        const list = snap.docs.map((d) => ({
          ...d.data(),
          teacherId: d.data().teacherId || d.id,
          username: d.data().username || d.id,
        }));
        list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setTeachers(list);
        setLoadingTeachers(false);
      },
      () => setLoadingTeachers(false)
    );
    return unsub;
  }, []);

  // Live attendance + sessions (always on, so the badges stay current)
  useEffect(() => {
    const unsubA = subscribeAllAttendance(
      (list) => {
        setAttendance(list);
        setLoadingAttendance(false);
      },
      () => setLoadingAttendance(false)
    );
    const unsubS = subscribeSessions(setSessions, () => {});
    return () => {
      unsubA();
      unsubS();
    };
  }, []);

  // Cashier accounts + payments (live)
  const [cashiers, setCashiers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    const unsubC = onSnapshot(
      collection(db, CASHIERS_COLLECTION),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setCashiers(list);
      },
      () => {}
    );
    const unsubP = subscribePayments(setPayments, () => {});
    return () => {
      unsubC();
      unsubP();
    };
  }, []);

  const thisMonth = currentMonth();
  const monthCollected = payments
    .filter((p) => p.month === thisMonth)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  async function toggleCashier(c) {
    await updateDoc(doc(db, CASHIERS_COLLECTION, c.id), { active: c.active === false });
  }

  const today = todayStr();
  const todayRecords = attendance.filter((r) => r.date === today);
  const pendingCount = attendance.filter((r) => !r.reviewed).length;
  const todayPresent = todayRecords.filter((r) => r.status === "present" || r.status === "late").length;
  const todayRate = todayRecords.length ? Math.round((todayPresent / todayRecords.length) * 100) : 0;

  const sessionByTeacherToday = useMemo(
    () => Object.fromEntries(sessions.filter((s) => s.date === today).map((s) => [s.teacherId, s])),
    [sessions, today]
  );

  // Teachers who are scheduled today, with their live status
  const todaySchedule = useMemo(() => {
    const dayName = todayDayName().toLowerCase();
    return teachers
      .filter((t) => {
        const days = getTeacherDays(t).map((d) => d.toLowerCase());
        return days.length === 0 || days.includes(dayName);
      })
      .map((t) => {
        const session = sessionByTeacherToday[t.teacherId];
        const windowState = getWindowState(t, now);
        let state = "waiting";
        if (session) state = "done";
        else if (windowState === "open") state = "open";
        else if (windowState === "after") state = "missed";
        return { ...t, session, state };
      })
      .sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || "")));
  }, [teachers, sessionByTeacherToday, now]);

  const recentSessions = useMemo(
    () =>
      [...sessions]
        .sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0))
        .slice(0, 6),
    [sessions]
  );

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        String(s.fullName || "").toLowerCase().includes(q) ||
        String(s.studentId).includes(q) ||
        String(s.className || "").toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const nav = [
    { key: "overview", label: "Dashboard", Icon: LayoutDashboard },
    { key: "students", label: "Students", Icon: GraduationCap, badge: students.length || null },
    { key: "classes", label: "Classes", Icon: School },
    { key: "teachers", label: "Teachers", Icon: BookOpen, badge: teachers.length || null },
    { key: "attendance", label: "Attendance", Icon: ClipboardCheck, badge: pendingCount || null },
    { key: "cashiers", label: "Cashiers", Icon: Wallet, badge: cashiers.length || null },
  ];

  const TITLES = {
    overview: ["Dashboard", `Welcome back, ${adminName}`],
    students: ["Students", "Register and manage students"],
    teachers: ["Teachers", "Register teachers with their subject and attendance time"],
    attendance: ["Attendance", "Live attendance — review, change and approve"],
    classes: ["Classes", "All 6 classes and the students in each"],
    cashiers: ["Cashiers & Payments", "Create cashier accounts and follow fee payments live"],
  };

  const STATE_LABEL = {
    done: { text: "Submitted", Icon: CheckCircle2, cls: "st-done" },
    open: { text: "Open now", Icon: Hourglass, cls: "st-open" },
    waiting: { text: "Upcoming", Icon: Clock, cls: "st-waiting" },
    missed: { text: "Missed", Icon: AlertCircle, cls: "st-missed" },
  };

  return (
    <PortalLayout
      role="admin"
      title={TITLES[tab][0]}
      subtitle={TITLES[tab][1]}
      nav={nav}
      active={tab}
      onNavigate={setTab}
      actions={tab !== "attendance" ? <LiveBadge /> : null}
    >
      {tab === "overview" && (
        <div className="stack">
          <div className="hero-banner">
            <div>
              <span className="hero-kicker">{todayDayName()}, {formatDate(today)}</span>
              <h2>Rising Star School overview</h2>
              <p>Attendance updates here the moment a teacher saves it.</p>
            </div>
            <div className="hero-ring" style={{ "--p": todayRate }}>
              <div>
                <strong>{todayRate}%</strong>
                <span>today</span>
              </div>
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat-card tone-green">
              <span className="stat-icon"><GraduationCap size={20} /></span>
              <span className="stat-label">Students<em>Ardayda</em></span>
              <strong className="stat-value">{students.length}</strong>
            </div>
            <div className="stat-card tone-amber">
              <span className="stat-icon"><BookOpen size={20} /></span>
              <span className="stat-label">Teachers<em>Macalimiinta</em></span>
              <strong className="stat-value">{teachers.length}</strong>
            </div>
            <div className="stat-card tone-blue">
              <span className="stat-icon"><Users size={20} /></span>
              <span className="stat-label">Marked today<em>Maanta</em></span>
              <strong className="stat-value">{todayRecords.length}</strong>
            </div>
            <button type="button" className="stat-card tone-violet" onClick={() => setTab("attendance")}>
              <span className="stat-icon"><Clock size={20} /></span>
              <span className="stat-label">Pending review<em>Sugaya</em></span>
              <strong className="stat-value">{pendingCount}</strong>
            </button>
          </div>

          <div className="two-col">
            <div className="panel">
              <div className="panel-head row">
                <div className="panel-icon"><CalendarDays size={18} /></div>
                <div>
                  <h2>Today's attendance schedule</h2>
                  <p>Teachers scheduled for {todayDayName()}</p>
                </div>
              </div>
              {todaySchedule.length === 0 ? (
                <p className="muted">No teachers scheduled today.</p>
              ) : (
                <ul className="schedule-list">
                  {todaySchedule.map((t) => {
                    const s = STATE_LABEL[t.state];
                    return (
                      <li key={t.teacherId}>
                        <div className="avatar-initials sm">{initials(t.fullName)}</div>
                        <div className="schedule-main">
                          <strong>{t.fullName}</strong>
                          <span>{t.subject} • {t.className}</span>
                        </div>
                        <div className="schedule-time">
                          {t.startTime ? `${formatTime12(t.startTime)} – ${formatTime12(t.endTime)}` : "Any time"}
                        </div>
                        <span className={`state-tag ${s.cls}`}>
                          <s.Icon size={13} /> {s.text}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="panel">
              <div className="panel-head row">
                <div className="panel-icon"><ClipboardCheck size={18} /></div>
                <div>
                  <h2>Latest submissions</h2>
                  <p>Most recent attendance sessions</p>
                </div>
              </div>
              {recentSessions.length === 0 ? (
                <p className="muted">No attendance submitted yet.</p>
              ) : (
                <ul className="activity-list">
                  {recentSessions.map((s) => (
                    <li key={`${s.teacherId}_${s.date}`}>
                      <span className="activity-dot" />
                      <div>
                        <strong>{s.teacherName || s.teacherId}</strong> saved{" "}
                        <strong>{s.studentCount}</strong> students
                        {s.subject && <> — {s.subject}</>}
                        <span>
                          {formatDate(s.date)} {formatTimestamp(s.submittedAt) && `• ${formatTimestamp(s.submittedAt)}`}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="btn btn-light full" onClick={() => setTab("attendance")}>
                Open attendance review
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "students" && (
        <div className="stack">
          <StudentForm />
          <div className="panel">
            <div className="section-head">
              <div>
                <h2>All Students ({students.length})</h2>
              </div>
              <div className="search-box">
                <Search size={16} />
                <input
                  placeholder="Search name, ID or class"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
              </div>
            </div>
            {loadingStudents ? (
              <p className="muted">Loading...</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>ID</th>
                      <th>Class</th>
                      <th>Mother's Name</th>
                      <th>Student Phone</th>
                      <th>Parent Phone</th>
                      <th>Subjects</th>
                      <th>Shift</th>
                      <th>Fee Type</th>
                      <th>Reg. Fee</th>
                      <th>Monthly Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s) => (
                      <tr key={s.studentId}>
                        <td>
                          <div className="cell-person">
                            {s.photoUrl ? (
                              <img src={s.photoUrl} alt={s.fullName} className="avatar" />
                            ) : (
                              <span className="avatar avatar-placeholder">{initials(s.fullName)}</span>
                            )}
                            <strong>{s.fullName}</strong>
                          </div>
                        </td>
                        <td><span className="id-chip">{s.studentId}</span></td>
                        <td>
                          {studentGroups(s).length ? (
                            <div className="tag-list">
                              {studentGroups(s).map((g) => (
                                <span key={g} className="tag tag-soft">{g}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>{s.motherName}</td>
                        <td>{s.studentPhone}</td>
                        <td>{s.parentPhone}</td>
                        <td>
                          <div className="tag-list">
                            {(Array.isArray(s.subjects) ? s.subjects : s.subjects ? [s.subjects] : []).map((sub) => (
                              <span key={sub} className="tag">{sub}</span>
                            ))}
                          </div>
                        </td>
                        <td>{s.shift}</td>
                        <td>{s.feeType}</td>
                        <td>${s.registrationFee ?? 0}</td>
                        <td>${s.monthlyFee ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "teachers" && (
        <div className="stack">
          <TeacherForm />
          <div className="panel">
            <div className="section-head">
              <h2>All Teachers ({teachers.length})</h2>
            </div>
            {loadingTeachers ? (
              <p className="muted">Loading...</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Teacher</th>
                      <th>Username</th>
                      <th>Phone</th>
                      <th>Class</th>
                      <th>Subject</th>
                      <th>Attendance days</th>
                      <th>Attendance time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((t) => (
                      <tr key={t.teacherId}>
                        <td>
                          <div className="cell-person">
                            <span className="avatar avatar-placeholder amber">{initials(t.fullName)}</span>
                            <strong>{t.fullName}</strong>
                          </div>
                        </td>
                        <td><span className="id-chip">{t.username}</span></td>
                        <td>{t.phone}</td>
                        <td>{t.className}</td>
                        <td>
                          <span className="tag">
                            {t.subject || (Array.isArray(t.subjects) ? t.subjects.join(", ") : t.subjects)}
                          </span>
                        </td>
                        <td>
                          <div className="tag-list">
                            {getTeacherDays(t).length
                              ? getTeacherDays(t).map((d) => <span key={d} className="tag tag-soft">{d.slice(0, 3)}</span>)
                              : <span className="muted">Every day</span>}
                          </div>
                        </td>
                        <td>
                          {t.startTime
                            ? <span className="time-chip"><Clock size={13} /> {formatTime12(t.startTime)} – {formatTime12(t.endTime)}</span>
                            : <span className="muted">Any time</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "classes" && <ClassesView students={students} teachers={teachers} />}

      {tab === "cashiers" && (
        <div className="stack">
          <CashierForm />

          <div className="panel">
            <div className="section-head">
              <h2>Cashier accounts ({cashiers.length})</h2>
            </div>
            {cashiers.length === 0 ? (
              <p className="muted">No cashiers yet.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Cashier</th>
                      <th>Username</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashiers.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div className="cell-person">
                            <span className="avatar avatar-placeholder">{initials(c.fullName)}</span>
                            <strong>{c.fullName}</strong>
                          </div>
                        </td>
                        <td><span className="id-chip">{c.username}</span></td>
                        <td>{c.phone}</td>
                        <td>
                          <span className={`pill ${c.active === false ? "pill-red" : "pill-green"}`}>
                            <span className="pill-dot" />
                            {c.active === false ? "Disabled" : "Active"}
                          </span>
                        </td>
                        <td>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleCashier(c)}>
                            {c.active === false ? "Enable" : "Disable"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="section-head">
              <div>
                <h2>Latest payments</h2>
                <p>{formatMonth(thisMonth)}: <strong>{money(monthCollected)}</strong> collected</p>
              </div>
              <LiveBadge />
            </div>
            {payments.length === 0 ? (
              <p className="muted">No payments yet.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Receipt</th>
                      <th>Student</th>
                      <th>Month</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Date</th>
                      <th>Cashier</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.slice(0, 50).map((p) => (
                      <tr key={p.id}>
                        <td><span className="id-chip">{p.receiptNo}</span></td>
                        <td><strong>{p.studentName}</strong></td>
                        <td>{formatMonth(p.month)}</td>
                        <td><strong className="txt-green">{money(p.amount)}</strong></td>
                        <td><span className="tag tag-soft">{p.method}</span></td>
                        <td>{formatDate(p.date)}</td>
                        <td>{p.cashierName}</td>
                        <td>
                          <button type="button" className="btn btn-light btn-sm" onClick={() => setReceipt(p)}>
                            <Printer size={14} /> Receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {receipt && <Receipt payment={receipt} onClose={() => setReceipt(null)} />}

      {tab === "attendance" && (
        <AttendanceReview
          records={attendance}
          students={students}
          teachers={teachers}
          adminName={adminName}
          loading={loadingAttendance}
        />
      )}
    </PortalLayout>
  );
}