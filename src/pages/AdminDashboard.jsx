import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import {
  LayoutDashboard, GraduationCap, BookOpen, ClipboardCheck, Search,
  Users, Clock, CheckCircle2, AlertCircle, Hourglass, CalendarDays,
  School, Wallet, Printer, Pencil, KeyRound, Trophy, UserPlus, BadgeDollarSign, Trash2,
} from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import PortalLayout, { LiveBadge, initials } from "../components/PortalLayout";
import StudentForm from "../components/StudentForm";
import TeacherForm from "../components/TeacherForm";
import AttendanceReview from "../components/AttendanceReview";
import ClassesView from "../components/ClassesView";
import CashierForm from "../components/CashierForm";
import CashierEditModal from "../components/CashierEditModal";
import CashierActivityLog from "../components/CashierActivityLog";
import CashierTotals from "../components/CashierTotals";
import RecycleBin from "../components/RecycleBin";
import { moveStudentToBin, subscribeBin } from "../utils/recycleBin";
import Receipt from "../components/Receipt";
import PaymentEditModal from "../components/PaymentEditModal";
import ExamsManager from "../components/ExamsManager";
import StudentList from "../components/StudentList";
import { studentGroups } from "../config/schoolOptions";
import { subscribePayments, formatMonth, money } from "../utils/payments";
import { subscribeActivity, ACTIVITY_TYPES } from "../utils/cashierActivity";
import {
  subscribeAllAttendance, subscribeSessions, todayStr, todayDayName,
  getTeacherDays, getWindowState, formatTime12, formatDate, formatTimestamp,
} from "../utils/attendance";
import { STUDENTS_COLLECTION, TEACHERS_COLLECTION, CASHIERS_COLLECTION } from "../config/collections";

const ACTIVITY_LABEL = Object.fromEntries(Object.entries(ACTIVITY_TYPES).map(([k, v]) => [k, v.label]));

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
  const [now, setNow] = useState(new Date());
  // Edit (maamulku wuxuu wax ka beddeli karaa xogta ardayga / macalinka)
  const [editStudent, setEditStudent] = useState(null);
  const [editTeacher, setEditTeacher] = useState(null);
  const [savedNote, setSavedNote] = useState("");

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
        setStudents(snap.docs.map((d) => ({ ...d.data(), docId: d.id })));
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
  const [editPayment, setEditPayment] = useState(null);
  const [activity, setActivity] = useState([]);
  const [bin, setBin] = useState([]);
  const [editCashier, setEditCashier] = useState(null);
  const [cashierFilter, setCashierFilter] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentMonthFilter, setPaymentMonthFilter] = useState("");

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
    const unsubA = subscribeActivity(setActivity, () => {});
    return () => {
      unsubC();
      unsubP();
      unsubA();
    };
  }, []);

  // Dhaqdhaqaaqii ugu dambeeyay ee cashier kasta (activity waa newest-first)
  const lastSeenByCashier = useMemo(() => {
    const map = {};
    activity.forEach((a) => {
      if (a.actorRole === "admin") return;
      if (!map[a.cashierId]) map[a.cashierId] = a;
    });
    return map;
  }, [activity]);

  const cashierEmailById = useMemo(
    () => Object.fromEntries(cashiers.map((c) => [c.id, c.email || c.username || ""])),
    [cashiers]
  );

  const cashierPayments = useMemo(() => {
    const q = paymentSearch.trim().toLowerCase();
    return payments.filter((p) => {
      if (cashierFilter && String(p.cashierId || "") !== cashierFilter) return false;
      if (paymentMonthFilter && p.month !== paymentMonthFilter) return false;
      if (!q) return true;
      return [p.receiptNo, p.studentName, p.studentId, p.cashierName, p.cashierEmail, p.method]
        .some((value) => String(value || "").toLowerCase().includes(q));
    });
  }, [payments, cashierFilter, paymentSearch, paymentMonthFilter]);

  const cashierReport = useMemo(() => {
    const total = cashierPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const today = todayStr();
    const todayTotal = cashierPayments
      .filter((p) => p.date === today)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return { total, todayTotal, count: cashierPayments.length };
  }, [cashierPayments]);

  useEffect(() => subscribeBin(setBin, () => {}), []);

  function flash(msg) {
    setSavedNote(msg);
    setTimeout(() => setSavedNote(""), 8000);
  }

  // Arday -> Recycle Bin (database-ka lagama saarayo)
  async function deleteStudent(s) {
    const ok = window.confirm(
      `Ma u guurinaysaa ${s.fullName} (ID ${s.studentId}) Recycle Bin?\n\nDatabase-ka lagama tirtirayo — waad dib u soo celin kartaa.`
    );
    if (!ok) return;
    try {
      await moveStudentToBin(s, adminName);
      flash(`✓ ${s.fullName} (ID ${s.studentId}) waxaa loo guuriyay Recycle Bin.`);
    } catch (err) {
      window.alert(err.message || "Lama tirtiri karin.");
    }
  }

  // Cashier -> si toos ah ayaa loo tirtiraa (recycle bin ma leh)
  async function deleteCashier(c) {
    const ok = window.confirm(
      `Ma tirtiraysaa cashier ${c.fullName} (${c.email || c.username})?\n\nAkoonkiisa si toos ah ayaa loo tirtirayaa, wuuna ka bixi doonaa Cashier Portal. Rasiidyadii uu qaaday way sii jiraan.`
    );
    if (!ok) return;
    try {
      await deleteDoc(doc(db, CASHIERS_COLLECTION, c.id));
      flash(`✓ Cashier ${c.fullName} waa la tirtiray.`);
    } catch (err) {
      window.alert(err.message || "Lama tirtiri karin.");
    }
  }

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

  const nav = [
    { key: "overview", label: "Dashboard", Icon: LayoutDashboard },
    { key: "addStudent", label: "Add Student", Icon: UserPlus },
    { key: "students", label: "Student List", Icon: GraduationCap, badge: students.length || null },
    { key: "classes", label: "Classes", Icon: School },
    { key: "teachers", label: "Teachers", Icon: BookOpen, badge: teachers.length || null },
    { key: "attendance", label: "Attendance", Icon: ClipboardCheck, badge: pendingCount || null },
    { key: "exams", label: "Exams & Results", Icon: Trophy },
    { key: "addCashier", label: "Add Cashier", Icon: BadgeDollarSign },
    { key: "cashiers", label: "Cashiers", Icon: Wallet, badge: cashiers.length || null },
    { key: "recycle", label: "Recycle Bin", Icon: Trash2, badge: bin.length || null },
  ];

  const TITLES = {
    overview: ["Dashboard", `Welcome back, ${adminName}`],
    addStudent: ["Add Student", "Diiwaan geli arday cusub"],
    students: ["Student List", "Dhammaan ardayda — raadi, eeg oo wax ka beddel"],
    teachers: ["Teachers", "Register teachers with their subject and attendance time"],
    attendance: ["Attendance", "Live attendance — review, change and approve"],
    classes: ["Classes", "All 6 classes and the students in each"],
    recycle: ["Recycle Bin", "Ardayda la tirtiray — dib u soo celi ama gacanta ugu tirtir"],
    addCashier: ["Add Cashier", "Samee cashier, liiska akoonnada iyo dhaqdhaqaaqa cashier-ada"],
    cashiers: ["Cashiers & Payments", "Ardayda, lacagaha soo gashay iyo intii cashier kasta qaaday — live"],
    exams: ["Exams & Results", "Samee exam fasal, geli natiijooyinka — ardaydu portal-kooda ayay ka arkayaan"],
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

      {tab === "addStudent" && (
        <div className="stack">
          <StudentForm />
          <button type="button" className="btn btn-light" style={{ alignSelf: "flex-start" }} onClick={() => setTab("students")}>
            <GraduationCap size={16} /> View Student List ({students.length})
          </button>
        </div>
      )}

      {tab === "students" && (
        <StudentList
          students={students}
          loading={loadingStudents}
          onEdit={(s) => setEditStudent(s)}
          onDelete={deleteStudent}
          onAdd={() => setTab("addStudent")}
          savedNote={savedNote}
        />
      )}

      {tab === "teachers" && (
        <div className="stack">
          <TeacherForm />
          {savedNote && <p className="banner banner-green" style={{ margin: 0 }}>{savedNote}</p>}
          <div className="panel">
            <div className="section-head">
              <h2>All Teachers ({teachers.length})</h2>
            </div>
            {loadingTeachers ? (
              <p className="muted">Loading...</p>
            ) : (
              <div className="table-scroll fit">
                <table className="compact-table">
                  <thead>
                    <tr>
                      <th>Teacher</th>
                      <th>Username</th>
                      <th>Phone</th>
                      <th>Class</th>
                      <th>Subject</th>
                      <th>Attendance days</th>
                      <th>Attendance time</th>
                      <th>Password</th>
                      <th></th>
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
                        <td>
                          {t.password ? (
                            <span className="id-chip"><KeyRound size={12} /> {t.password}</span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-light btn-sm"
                            onClick={() => setEditTeacher(t)}
                          >
                            <Pencil size={14} /> Edit
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

      {tab === "recycle" && (
        <>
          {savedNote && <p className="banner banner-green" style={{ margin: "0 0 16px" }}>{savedNote}</p>}
          <RecycleBin items={bin} onNote={flash} />
        </>
      )}

      {tab === "classes" && <ClassesView students={students} teachers={teachers} />}

      {tab === "addCashier" && (
        <div className="stack">
          <CashierForm />
          {savedNote && <p className="banner banner-green" style={{ margin: 0 }}>{savedNote}</p>}

          <div className="panel">
            <div className="section-head">
              <h2>Cashier accounts ({cashiers.length})</h2>
            </div>
            {cashiers.length === 0 ? (
              <div className="empty">
                <Wallet size={34} />
                <strong>No cashiers yet</strong>
                <span>Samee cashier-ka ugu horreeya foomka kor ku yaal.</span>
              </div>
            ) : (
              <div className="table-scroll fit">
                <table className="compact-table">
                  <thead>
                    <tr>
                      <th>Cashier</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Password</th>
                      <th>Last activity</th>
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
                        <td><span className="id-chip">{c.email || c.username || "—"}</span></td>
                        <td>{c.phone}</td>
                        <td>
                          {c.password ? <span className="id-chip"><KeyRound size={12} /> {c.password}</span> : <span className="muted">—</span>}
                        </td>
                        <td>
                          {lastSeenByCashier[c.id] ? (
                            <>
                              <strong>{ACTIVITY_LABEL[lastSeenByCashier[c.id].type] || lastSeenByCashier[c.id].type}</strong>
                              <div className="muted-sm">
                                {formatDate(lastSeenByCashier[c.id].date)} {formatTimestamp(lastSeenByCashier[c.id].createdAt) && `• ${formatTimestamp(lastSeenByCashier[c.id].createdAt)}`}
                              </div>
                            </>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          <span className={`pill ${c.active === false ? "pill-red" : "pill-green"}`}>
                            <span className="pill-dot" />
                            {c.active === false ? "Disabled" : "Active"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button type="button" className="btn btn-light btn-sm" onClick={() => setEditCashier(c)}>
                              <Pencil size={14} /> Edit
                            </button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleCashier(c)}>
                              {c.active === false ? "Enable" : "Disable"}
                            </button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteCashier(c)} title="Delete cashier">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>


          <CashierActivityLog activity={activity} cashiers={cashiers} />
        </div>
      )}

      {tab === "cashiers" && (
        <div className="stack">
          <CashierTotals students={students} payments={payments} cashiers={cashiers} lastSeenByCashier={lastSeenByCashier} />

          <div className="panel">
            <div className="section-head">
              <div>
                <h2>Cashier payment report</h2>
                <p>All transactions — dhammaan lacagaha cashier-ku qaaday.</p>
              </div>
              <LiveBadge />
            </div>

            <div className="stat-grid">
              <div className="stat-card tone-green">
                <span className="stat-icon"><Wallet size={20} /></span>
                <span className="stat-label">Filtered collected<em>Wadarta lacagta</em></span>
                <strong className="stat-value">{money(cashierReport.total)}</strong>
              </div>
              <div className="stat-card tone-blue">
                <span className="stat-icon"><CheckCircle2 size={20} /></span>
                <span className="stat-label">Transactions<em>Payments</em></span>
                <strong className="stat-value">{cashierReport.count}</strong>
              </div>
              <div className="stat-card tone-violet">
                <span className="stat-icon"><CalendarDays size={20} /></span>
                <span className="stat-label">Today<em>Maanta</em></span>
                <strong className="stat-value">{money(cashierReport.todayTotal)}</strong>
              </div>
            </div>

            <div className="filter-bar">
              <select value={cashierFilter} onChange={(e) => setCashierFilter(e.target.value)}>
                <option value="">All cashiers</option>
                {cashiers.map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName} — {c.email || c.username || c.id}</option>
                ))}
              </select>
              <div className="filter-date">
                <CalendarDays size={16} />
                <input type="month" value={paymentMonthFilter} onChange={(e) => setPaymentMonthFilter(e.target.value)} />
              </div>
              <div className="search-box">
                <Search size={16} />
                <input
                  placeholder="Search student, receipt, cashier or method"
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                />
              </div>
              {paymentMonthFilter && (
                <button type="button" className="btn btn-light btn-sm" onClick={() => setPaymentMonthFilter("")}>
                  All months
                </button>
              )}
            </div>

            {cashierPayments.length === 0 ? (
              <div className="empty"><Wallet size={34} /><strong>No payments match the selected filters.</strong></div>
            ) : (
              <div className="table-scroll fit">
                <table className="compact-table">
                  <thead>
                    <tr>
                      <th>Receipt</th>
                      <th>Student</th>
                      <th>Month</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Date</th>
                      <th>Cashier</th>
                      <th>Email</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashierPayments.map((p) => (
                      <tr key={p.id}>
                        <td><span className="id-chip">{p.receiptNo}</span></td>
                        <td>
                          <strong>{p.studentName}</strong>
                          <div className="muted-sm">ID {p.studentId}</div>
                        </td>
                        <td>{formatMonth(p.month)}</td>
                        <td>
                          <strong className="txt-green">{money(p.amount)}</strong>
                          {p.edited && <div className="muted-sm">edited{p.editedBy?.name ? ` by ${p.editedBy.name}` : ""}</div>}
                        </td>
                        <td><span className="tag tag-soft">{p.method}</span></td>
                        <td>{formatDate(p.date)}</td>
                        <td>{p.cashierName || "—"}</td>
                        <td>{p.cashierEmail || cashierEmailById[p.cashierId] || "—"}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button type="button" className="btn btn-light btn-sm" onClick={() => setReceipt(p)}>
                              <Printer size={14} /> Receipt
                            </button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditPayment(p)}>
                              <Pencil size={14} /> Edit
                            </button>
                          </div>
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

      {editCashier && (
        <CashierEditModal
          key={editCashier.id}
          cashier={editCashier}
          onClose={() => setEditCashier(null)}
          onSaved={(res) => {
            setEditCashier(null);
            setSavedNote(`✓ Cashier ${res.fullName} waa la keydiyay. Email: ${res.email} • Password: ${res.password}`);
            setTimeout(() => setSavedNote(""), 8000);
          }}
        />
      )}

      {editPayment && (
        <PaymentEditModal
          payment={editPayment}
          payments={payments}
          student={students.find((st) => String(st.studentId) === String(editPayment.studentId))}
          editor={{ ...user, role: "admin" }}
          onClose={() => setEditPayment(null)}
          onSaved={(p) => {
            setEditPayment(null);
            setReceipt(p);
          }}
        />
      )}

      {tab === "exams" && <ExamsManager students={students} teachers={teachers} adminName={adminName} />}

      {editStudent && (
        <div className="modal-backdrop" onClick={() => setEditStudent(null)}>
          <div className="modal" style={{ maxWidth: 880 }} onClick={(e) => e.stopPropagation()}>
            <StudentForm
              key={editStudent.studentId}
              editStudent={editStudent}
              onCancel={() => setEditStudent(null)}
              onDone={(res) => {
                setEditStudent(null);
                setSavedNote(`✓ Xogta ${res.fullName} (ID ${res.studentId}) waa la keydiyay. Password: ${res.password}`);
                setTimeout(() => setSavedNote(""), 8000);
              }}
            />
          </div>
        </div>
      )}

      {editTeacher && (
        <div className="modal-backdrop" onClick={() => setEditTeacher(null)}>
          <div className="modal" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
            <TeacherForm
              key={editTeacher.teacherId}
              editTeacher={editTeacher}
              onCancel={() => setEditTeacher(null)}
              onDone={(res) => {
                setEditTeacher(null);
                setSavedNote(`✓ Macalinka ${res.username} waa la keydiyay. Password: ${res.password}`);
                setTimeout(() => setSavedNote(""), 8000);
              }}
            />
          </div>
        </div>
      )}

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