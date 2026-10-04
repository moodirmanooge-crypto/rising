import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, ShieldCheck, BookOpen, Hash, Users, Trophy, CalendarDays } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import PortalLayout, { StatusPill, LiveBadge, initials } from "../components/PortalLayout";
import { ATTENDANCE_STATUSES } from "../config/schoolOptions";
import { subscribeStudentAttendance, formatDate, dayNameOf } from "../utils/attendance";
import { subscribeStudentResults, gradeTone, gradeFor } from "../utils/exams";

export default function StudentPortal() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState("attendance");
  const [results, setResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(true);

  // Natiijooyinka imtixaannada (live) — admin-ku marka uu keydiyo isla markiiba
  useEffect(() => {
    if (!user?.studentId) return;
    const unsub = subscribeStudentResults(
      user.studentId,
      (list) => {
        setResults(list);
        setLoadingResults(false);
      },
      () => setLoadingResults(false)
    );
    return unsub;
  }, [user?.studentId]);

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
      title={tab === "results" ? "My Exam Results" : "My Attendance"}
      subtitle={tab === "results" ? "Natiijooyinka imtixaannadaada — updates live" : "Xaadirintaada — updates live"}
      nav={[
        { key: "attendance", label: "My Attendance", Icon: CalendarCheck },
        { key: "results", label: "My Results", Icon: Trophy, badge: results.length || null },
      ]}
      active={tab}
      onNavigate={setTab}
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

        {tab === "attendance" && (
          <>
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
          </>
        )}

        {tab === "results" && (
          loadingResults ? (
            <div className="panel"><p className="muted">Loading...</p></div>
          ) : results.length === 0 ? (
            <div className="panel empty">
              <Trophy size={34} />
              <strong>No exam results yet</strong>
              <span>Natiijooyinkaagu halkan ayay ka soo muuqan doonaan marka la geliyo.</span>
            </div>
          ) : (
            <div className="result-list">
              {results.map((r) => (
                <ResultCard key={r.id} r={r} />
              ))}
            </div>
          )
        )}

      </div>
    </PortalLayout>
  );
}

const REMARK = {
  A: "Excellent — Heer sare!",
  B: "Very good — Aad u fiican",
  C: "Good — Fiican",
  D: "Fair — Dhexdhexaad",
  E: "Pass — Gudbay",
  F: "Needs improvement — Dadaal dheeraad ah",
};

function medal(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "🏅";
}

// Natiijada hal imtixaan — muuqaal qurxoon (ring %, grade, rank, bar maado kasta)
function ResultCard({ r }) {
  const tone = gradeTone(r.grade);
  const pct = Math.max(0, Math.min(100, Number(r.percent) || 0));
  const subjects = r.subjects || [];

  return (
    <div className={`result-card tone-${tone}`}>
      <div className="result-head">
        <div className="result-head-text">
          <span className="hero-kicker">{r.term || "Exam result"}</span>
          <h2>{r.examTitle}</h2>
          <div className="result-meta">
            <span><Users size={13} /> {r.classGroup}</span>
            {r.examDate && <span><CalendarDays size={13} /> {formatDate(r.examDate)}</span>}
          </div>
        </div>
        <div className="result-ring" style={{ "--p": pct }}>
          <div>
            <strong>{r.grade}</strong>
            <span>{pct}%</span>
          </div>
        </div>
      </div>

      <div className="result-stats">
        <div>
          <span>Total marks</span>
          <strong>{r.total}<em>/{r.maxTotal}</em></strong>
        </div>
        <div>
          <span>Percentage</span>
          <strong>{pct}%</strong>
        </div>
        <div>
          <span>Grade</span>
          <strong className="result-grade">{r.grade}</strong>
        </div>
        <div>
          <span>Class rank</span>
          <strong>{r.rank ? <>{medal(r.rank)} {r.rank}<em>/{r.classSize}</em></> : "—"}</strong>
        </div>
      </div>

      <div className="result-subjects">
        {subjects.map((sub) => {
          const m = r.marks?.[sub.name];
          const has = !(m === null || m === undefined);
          const max = Number(sub.maxMark) || 100;
          const sp = has ? Math.round((Number(m) / max) * 100) : 0;
          const sg = has ? gradeFor(sp) : "";
          return (
            <div key={sub.name} className={`result-subject tone-${has ? gradeTone(sg) : "slate"}`}>
              <div className="result-subject-top">
                <span className="result-subject-name"><BookOpen size={14} /> {sub.name}</span>
                <span className="result-subject-mark">
                  {has ? <><strong>{m}</strong> / {max}</> : <em>Not graded</em>}
                  {sg && <b className="result-subject-grade">{sg}</b>}
                </span>
              </div>
              <div className="result-bar">
                <span style={{ width: `${sp}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {r.grade && <div className="result-remark">{REMARK[r.grade]}</div>}
    </div>
  );
}