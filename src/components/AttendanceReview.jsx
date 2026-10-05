import { useMemo, useState } from "react";
import {
  CheckCheck, Check, RotateCcw, Search, ShieldCheck, Clock, CalendarDays, Pencil, Users,
} from "lucide-react";
import { ATTENDANCE_STATUSES } from "../config/schoolOptions";
import {
  todayStr, formatDate, dayNameOf, formatTimestamp,
  updateAttendanceStatus, reviewAttendance, reopenAttendance,
} from "../utils/attendance";
import { StatusPill, LiveBadge, initials } from "./PortalLayout";

function countStatuses(list) {
  const c = { total: list.length, present: 0, absent: 0, late: 0, excused: 0, pending: 0 };
  list.forEach((r) => {
    c[r.status] = (c[r.status] || 0) + 1;
    if (!r.reviewed) c.pending++;
  });
  return c;
}

// Admin: every attendance record, live. Records are grouped into one card
// per teacher per day. While a record is NOT reviewed the admin can change
// it (Present / Absent / Late / Excused); approving locks it.
export default function AttendanceReview({ records, students, teachers, adminName, loading }) {
  const [date, setDate] = useState(todayStr());
  const [allDates, setAllDates] = useState(false);
  const [teacherFilter, setTeacherFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reviewFilter, setReviewFilter] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState({});
  const [error, setError] = useState("");

  const studentById = useMemo(
    () => Object.fromEntries(students.map((s) => [s.studentId, s])),
    [students]
  );
  const teacherById = useMemo(
    () => Object.fromEntries(teachers.map((t) => [t.teacherId, t])),
    [teachers]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (!allDates && r.date !== date) return false;
      if (teacherFilter && r.teacherId !== teacherFilter) return false;
      if (classFilter && String(r.className || "") !== classFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (reviewFilter === "pending" && r.reviewed) return false;
      if (reviewFilter === "approved" && !r.reviewed) return false;
      if (q) {
        const name = (r.studentName || studentById[r.studentId]?.fullName || "").toLowerCase();
        if (!name.includes(q) && !String(r.studentId).includes(q)) return false;
      }
      return true;
    });
  }, [records, date, allDates, teacherFilter, classFilter, statusFilter, reviewFilter, search, studentById]);

  const stats = countStatuses(filtered);

  // Group by teacher + date
  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach((r) => {
      const className = r.className || "Unassigned class";
      const key = `${r.teacherId}_${r.date}_${className}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          teacherId: r.teacherId,
          date: r.date,
          className,
          items: [],
        });
      }
      map.get(key).items.push(r);
    });
    return [...map.values()].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      const at = Math.max(...a.items.map((i) => i.createdAt?.seconds || 0));
      const bt = Math.max(...b.items.map((i) => i.createdAt?.seconds || 0));
      return bt - at;
    });
  }, [filtered]);

  async function run(key, fn) {
    setError("");
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      await fn();
    } catch (err) {
      console.error(err);
      setError(err.message || "Action failed.");
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  }

  const statCards = [
    { key: "total", label: "Total", so: "Wadarta", tone: "slate", Icon: Users },
    { key: "present", label: "Present", so: "Joogay", tone: "green" },
    { key: "absent", label: "Absent", so: "Maqan", tone: "red" },
    { key: "late", label: "Late", so: "Daahay", tone: "amber" },
    { key: "excused", label: "Excused", so: "Fasax", tone: "blue" },
    { key: "pending", label: "Pending review", so: "Sugaya", tone: "violet", Icon: Clock },
  ];

  return (
    <div className="stack">
      <div className="section-head">
        <div>
          <h2>Attendance review</h2>
          <p>Every attendance a teacher submits appears here instantly. Change a status before you approve it.</p>
        </div>
        <LiveBadge />
      </div>

      <div className="stat-grid stat-grid-6">
        {statCards.map(({ key, label, so, tone }) => (
          <button
            key={key}
            type="button"
            className={`stat-card tone-${tone} ${
              (key === statusFilter) || (key === "pending" && reviewFilter === "pending") ? "selected" : ""
            }`}
            onClick={() => {
              if (key === "total") { setStatusFilter(""); setReviewFilter(""); return; }
              if (key === "pending") { setReviewFilter(reviewFilter === "pending" ? "" : "pending"); return; }
              setStatusFilter(statusFilter === key ? "" : key);
            }}
          >
            <span className="stat-label">{label}<em>{so}</em></span>
            <strong className="stat-value">{stats[key] || 0}</strong>
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <div className="filter-date">
          <CalendarDays size={16} />
          <input
            type="date"
            value={date}
            disabled={allDates}
            onChange={(e) => setDate(e.target.value)}
          />
          <label className="switch">
            <input type="checkbox" checked={allDates} onChange={(e) => setAllDates(e.target.checked)} />
            <span>All dates</span>
          </label>
        </div>
        <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
          <option value="">All teachers</option>
          {teachers.map((t) => (
            <option key={t.teacherId} value={t.teacherId}>
              {t.fullName} — {t.subject}
            </option>
          ))}
        </select>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="">All classes</option>
          {[...new Set(records.map((r) => r.className).filter(Boolean))]
            .sort()
            .map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {ATTENDANCE_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value)}>
          <option value="">Pending &amp; approved</option>
          <option value="pending">Pending only</option>
          <option value="approved">Approved only</option>
        </select>
        <div className="search-box">
          <Search size={16} />
          <input
            placeholder="Search student name or ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <div className="panel empty">Loading attendance…</div>
      ) : groups.length === 0 ? (
        <div className="panel empty">
          <CalendarDays size={34} />
          <strong>No attendance found</strong>
          <span>{allDates ? "No records match these filters." : `Nothing submitted for ${formatDate(date)} yet.`}</span>
        </div>
      ) : (
        groups.map((g) => {
          const teacher = teacherById[g.teacherId] || {};
          const first = g.items[0] || {};
          const teacherName = first.teacherName || teacher.fullName || g.teacherId;
          const subject = first.subject || teacher.subject || "—";
          const className = g.className || first.className || teacher.className || "—";
          const c = countStatuses(g.items);
          const rate = c.total ? Math.round(((c.present + c.late) / c.total) * 100) : 0;
          const pendingIds = g.items.filter((r) => !r.reviewed).map((r) => r.id);
          const approvedIds = g.items.filter((r) => r.reviewed).map((r) => r.id);
          const submitted = formatTimestamp(
            g.items.reduce((min, r) => (!min || (r.createdAt?.seconds || 0) < (min.seconds || 0) ? r.createdAt : min), null)
          );

          return (
            <div key={g.key} className="session-card">
              <div className="session-head">
                <div className="session-teacher">
                  <div className="avatar-initials">{initials(teacherName)}</div>
                  <div>
                    <strong>{teacherName}</strong>
                    <span>
                      {subject} • {className}
                    </span>
                    <span className="muted-sm">
                      {dayNameOf(g.date)}, {formatDate(g.date)}
                      {submitted && <> • submitted {submitted}</>}
                    </span>
                  </div>
                </div>

                <div className="session-meta">
                  <div className="mini-counts">
                    <span className="mc green">{c.present} P</span>
                    <span className="mc red">{c.absent} A</span>
                    <span className="mc amber">{c.late} L</span>
                    <span className="mc blue">{c.excused} E</span>
                  </div>
                  <div className="rate">
                    <div className="rate-bar"><span style={{ width: `${rate}%` }} /></div>
                    <small>{rate}% attended</small>
                  </div>
                </div>

                <div className="session-actions">
                  {pendingIds.length > 0 ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy[g.key]}
                      onClick={() => run(g.key, () => reviewAttendance(pendingIds, adminName))}
                    >
                      <CheckCheck size={16} /> Approve all ({pendingIds.length})
                    </button>
                  ) : (
                    <span className="approved-tag"><ShieldCheck size={16} /> All approved</span>
                  )}
                  {approvedIds.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy[g.key]}
                      title="Unlock approved records so they can be changed"
                      onClick={() => run(g.key, () => reopenAttendance(approvedIds))}
                    >
                      <RotateCcw size={15} /> Reopen
                    </button>
                  )}
                </div>
              </div>

              <div className="record-list">
                {g.items.map((r) => {
                  const st = studentById[r.studentId] || {};
                  const name = r.studentName || st.fullName || "—";
                  const edited = r.originalStatus && r.originalStatus !== r.status;
                  return (
                    <div key={r.id} className={`record-row ${r.reviewed ? "is-reviewed" : ""}`}>
                      <div className="record-student">
                        {st.photoUrl ? (
                          <img src={st.photoUrl} alt={name} className="avatar" />
                        ) : (
                          <span className="avatar avatar-placeholder">{initials(name)}</span>
                        )}
                        <div>
                          <strong>{name}</strong>
                          <span>ID {r.studentId}</span>
                        </div>
                      </div>

                      <div className="record-status">
                        {r.reviewed ? (
                          <StatusPill status={r.status} />
                        ) : (
                          <div className="seg">
                            {ATTENDANCE_STATUSES.map((s) => (
                              <button
                                key={s.value}
                                type="button"
                                className={`seg-btn tone-${s.tone} ${r.status === s.value ? "active" : ""}`}
                                disabled={busy[r.id]}
                                onClick={() =>
                                  r.status !== s.value &&
                                  run(r.id, () => updateAttendanceStatus(r, s.value, adminName))
                                }
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        )}
                        {edited && (
                          <span className="edited-note">
                            <Pencil size={12} /> Teacher marked: {r.originalStatus}
                          </span>
                        )}
                      </div>

                      <div className="record-review">
                        {r.reviewed ? (
                          <span className="approved-tag sm">
                            <ShieldCheck size={14} /> Approved
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            disabled={busy[r.id]}
                            onClick={() => run(r.id, () => reviewAttendance([r.id], adminName))}
                          >
                            <Check size={14} /> Approve
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}