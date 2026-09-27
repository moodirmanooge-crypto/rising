import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, ShieldCheck, BookOpen, Hash, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import PortalLayout, { StatusPill, LiveBadge, initials } from "../components/PortalLayout";
import { ATTENDANCE_STATUSES } from "../config/schoolOptions";
import { subscribeStudentAttendance, formatDate, dayNameOf } from "../utils/attendance";

export default function StudentPortal() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState("");

  // Live: the student sees a new record (or an admin change) instantly
  useEffect(() => {
    if (!user?.studentId) return;
    const unsub = subscribeStudentAttendance(
      user.studentId,
      (list) => {
        setRecords(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [user?.studentId]);

  const subjects = useMemo(
    () => [...new Set(records.map((r) => r.subject).filter(Boolean))].sort(),
    [records]
  );

  const bySubject = subject ? records.filter((r) => r.subject === subject) : records;
  const shown = status ? bySubject.filter((r) => r.status === status) : bySubject;

  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  bySubject.forEach((r) => (counts[r.status] = (counts[r.status] || 0) + 1));
  const total = bySubject.length;
  const rate = total ? Math.round(((counts.present + counts.late) / total) * 100) : 0;

  return (
    <PortalLayout
      role="student"
      title="My Attendance"
      subtitle="Xaadirintaada — updates live"
      nav={[{ key: "attendance", label: "My Attendance", Icon: CalendarCheck }]}
      active="attendance"
      actions={<LiveBadge />}
    >
      <div className="stack">
        <div className="student-hero">
          <div className="student-hero-main">
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt={user.fullName} className="avatar avatar-xl" />
            ) : (
              <span className="avatar avatar-xl avatar-placeholder">{initials(user?.fullName)}</span>
            )}
            <div>
              <span className="hero-kicker">Student</span>
              <h2>{user?.fullName}</h2>
              <div className="hero-chips">
                <span><Hash size={13} /> {user?.studentId}</span>
                {user?.className && <span><Users size={13} /> {user.className}</span>}
                {user?.shift && <span>{user.shift}</span>}
              </div>
            </div>
          </div>
          <div className="hero-ring light" style={{ "--p": rate }}>
            <div>
              <strong>{rate}%</strong>
              <span>attendance</span>
            </div>
          </div>
        </div>

        <div className="stat-grid">
          {ATTENDANCE_STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`stat-card tone-${s.tone} ${status === s.value ? "selected" : ""}`}
              onClick={() => setStatus(status === s.value ? "" : s.value)}
            >
              <span className="stat-label">{s.label}<em>{s.so}</em></span>
              <strong className="stat-value">{counts[s.value] || 0}</strong>
            </button>
          ))}
        </div>

        {subjects.length > 0 && (
          <div className="chip-filter">
            <button type="button" className={`chip ${!subject ? "active" : ""}`} onClick={() => setSubject("")}>
              All subjects
            </button>
            {subjects.map((s) => (
              <button key={s} type="button" className={`chip ${subject === s ? "active" : ""}`} onClick={() => setSubject(s)}>
                <BookOpen size={13} /> {s}
              </button>
            ))}
          </div>
        )}

        <div className="panel">
          <div className="section-head">
            <h2>Attendance history ({shown.length})</h2>
          </div>
          {loading ? (
            <p className="muted">Loading...</p>
          ) : shown.length === 0 ? (
            <div className="empty">
              <CalendarCheck size={34} />
              <strong>No attendance recorded yet</strong>
            </div>
          ) : (
            <ul className="timeline">
              {shown.map((r) => (
                <li key={r.id} className={`timeline-item tone-${r.status}`}>
                  <div className="date-block">
                    <strong>{r.date?.slice(8, 10)}</strong>
                    <span>{formatDate(r.date).split(" ")[1]}</span>
                  </div>
                  <div className="timeline-main">
                    <strong>{r.subject || "Class attendance"}</strong>
                    <span>
                      {dayNameOf(r.date)} • {formatDate(r.date)}
                      {r.teacherName && <> • {r.teacherName}</>}
                    </span>
                  </div>
                  <div className="timeline-side">
                    <StatusPill status={r.status} />
                    {r.reviewed && (
                      <span className="approved-tag sm"><ShieldCheck size={13} /> Verified</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}