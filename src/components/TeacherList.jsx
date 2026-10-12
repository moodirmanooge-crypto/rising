// src/components/TeacherList.jsx
//
// Admin → Teacher List: dhammaan macallimiinta (live), raadi, kala sooc,
// classes + maadooyinka, jadwalka toddobaadka (maalin kasta waqtigeeda),
// iyo Edit — isbeddelku isla markiiba halkan ayuu ka muuqdaa.

import { useMemo, useState } from "react";
import {
  Search, UserPlus, Pencil, Phone, KeyRound, Eye, EyeOff, BookOpen, CalendarDays,
  Users, School, Clock, CheckCircle2, GraduationCap, Trash2, AlertTriangle, X,
} from "lucide-react";

import { DAYS } from "../config/schoolOptions";
import { initials } from "./PortalLayout";
import { formatTime12, getDaySchedule, getTeacherDays, scheduleText, todayDayName } from "../utils/attendance";
import { teacherAssignments, teacherAllSubjects } from "../utils/teacherClasses";
import "../styles/teachers.css";

const PALETTES = [
  ["linear-gradient(135deg, #22c55e, #15803d)", "#effaf3"],
  ["linear-gradient(135deg, #f59e0b, #d97706)", "#fff8eb"],
  ["linear-gradient(135deg, #3b82f6, #1d4ed8)", "#eef4ff"],
  ["linear-gradient(135deg, #8b5cf6, #6d28d9)", "#f5f0ff"],
  ["linear-gradient(135deg, #14b8a6, #0f766e)", "#ecfbf8"],
  ["linear-gradient(135deg, #f43f5e, #be123c)", "#fff1f3"],
];

function paletteFor(name) {
  let h = 0;
  for (const ch of String(name || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

function hasDay(teacher, day) {
  const days = getTeacherDays(teacher).map((d) => d.toLowerCase());
  return days.length === 0 || days.includes(day.toLowerCase());
}

export default function TeacherList({ teachers = [], loading, onEdit, onDelete, onAdd, savedNote, flashId }) {
  const [confirm, setConfirm] = useState(null); // macallinka la tirtirayo
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [shown, setShown] = useState({}); // password reveal per teacher

  const today = todayDayName();

  const allClasses = useMemo(
    () => [...new Set(teachers.flatMap((t) => teacherAssignments(t).map((a) => a.className)))].sort(),
    [teachers]
  );

  const stats = useMemo(() => {
    const subjects = new Set(teachers.flatMap((t) => teacherAllSubjects(t)));
    return {
      teachers: teachers.length,
      classes: allClasses.length,
      subjects: subjects.size,
      today: teachers.filter((t) => hasDay(t, today)).length,
    };
  }, [teachers, allClasses, today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers.filter((t) => {
      const asg = teacherAssignments(t);
      if (classFilter && !asg.some((a) => a.className === classFilter)) return false;
      if (dayFilter && !hasDay(t, dayFilter)) return false;
      if (!q) return true;
      return [t.fullName, t.username, t.phone, ...asg.map((a) => a.className), ...asg.flatMap((a) => a.subjects)]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [teachers, search, classFilter, dayFilter]);

  return (
    <div className="stack">
      <div className="tl-hero">
        <div>
          <span className="kicker">Rising Star School</span>
          <h2>Teacher List</h2>
          <p>Dhammaan macallimiinta — classes-kooda, maadooyinka iyo jadwalka maalin kasta.</p>
        </div>
        {onAdd && (
          <button type="button" className="tl-hero-btn" onClick={onAdd}>
            <UserPlus size={17} /> Add Teacher
          </button>
        )}
      </div>

      <div className="tl-stats">
        <Stat Icon={Users} value={stats.teachers} label="Teachers · Macallimiin" tone="green" />
        <Stat Icon={School} value={stats.classes} label="Classes covered" tone="blue" />
        <Stat Icon={BookOpen} value={stats.subjects} label="Subjects · Maadooyin" tone="amber" />
        <Stat Icon={CalendarDays} value={stats.today} label={`Teaching today (${today.slice(0, 3)})`} tone="violet" />
      </div>

      {savedNote && (
        <div className="tl-toast">
          <CheckCircle2 size={18} /> {String(savedNote).replace(/^✓\s*/, "")}
        </div>
      )}

      <div className="tl-toolbar">
        <div className="tl-search">
          <Search size={16} />
          <input
            placeholder="Raadi magac, username, phone, class ama maado…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="">All classes</option>
          {allClasses.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <div className="tl-chips">
          <button type="button" className={`tl-chip ${!dayFilter ? "active" : ""}`} onClick={() => setDayFilter("")}>
            All days
          </button>
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              className={`tl-chip ${dayFilter === d ? "active" : ""}`}
              onClick={() => setDayFilter(dayFilter === d ? "" : d)}
            >
              {d.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="tl-empty">Loading teachers…</div>
      ) : filtered.length === 0 ? (
        <div className="tl-empty">
          <GraduationCap size={36} />
          <strong>{teachers.length ? "Macallin lama helin" : "No teachers yet"}</strong>
          <span>{teachers.length ? "Beddel raadinta ama filter-ka." : "Diiwaan geli macallinka ugu horreeya."}</span>
          {!teachers.length && onAdd && (
            <button type="button" className="btn btn-primary" onClick={onAdd} style={{ marginTop: 6 }}>
              <UserPlus size={16} /> Add Teacher
            </button>
          )}
        </div>
      ) : (
        <div className="tl-grid">
          {filtered.map((t) => {
            const id = t.docId || t.teacherId;
            const [grad, soft] = paletteFor(t.fullName || t.username);
            const asg = teacherAssignments(t);
            const teachesToday = hasDay(t, today) && getTeacherDays(t).length > 0;
            const todaySch = getDaySchedule(t, today);
            return (
              <article
                key={id}
                className={`tl-card ${flashId && flashId === id ? "flash" : ""}`}
                style={{ "--tl-grad": grad, "--tl-soft": soft }}
              >
                <div className="tl-card-top">
                  <div className="tl-avatar">{initials(t.fullName)}</div>
                  <div className="tl-name">
                    <h3 title={t.fullName}>{t.fullName || "—"}</h3>
                    <div className="tl-name-row">
                      <span className="tl-handle">@{t.username || id}</span>
                      <span className={`tl-today ${teachesToday ? "on" : "off"}`}>
                        <i />
                        {teachesToday
                          ? todaySch.startTime
                            ? `Today ${formatTime12(todaySch.startTime)}${todaySch.periods.length > 1 ? ` +${todaySch.periods.length - 1}` : ""}`
                            : "Today"
                          : "Off today"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="tl-section">
                  <div className="tl-label"><BookOpen size={12} /> Classes & subjects ({asg.length})</div>
                  {asg.length ? (
                    <div className="tl-classes">
                      {asg.map((a) => (
                        <div key={a.className} className="tl-class">
                          <strong>{a.className}</strong>
                          <div className="tl-subjects">
                            {a.subjects.length ? (
                              a.subjects.map((s) => <span key={s} className="tl-subject">{s}</span>)
                            ) : (
                              <span className="muted-sm">No subject</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="muted-sm">Not assigned</span>
                  )}
                </div>

                <div className="tl-section">
                  <div className="tl-label"><Clock size={12} /> Weekly attendance</div>
                  <div className="tl-week">
                    {DAYS.map((d) => {
                      const on = getTeacherDays(t).map((x) => x.toLowerCase()).includes(d.toLowerCase());
                      const s = on ? getDaySchedule(t, d) : null;
                      return (
                        <div
                          key={d}
                          className={`tl-wd ${on ? "on" : ""} ${d === today ? "today" : ""}`}
                          title={s?.startTime ? `${d}: ${scheduleText(s)}` : `${d}: off`}
                        >
                          <b>{d.slice(0, 3)}</b>
                          {s?.startTime ? formatTime12(s.startTime).replace(":00", "").replace(" ", "") : "—"}
                          {s?.periods?.length > 1 && <em className="tl-more">+{s.periods.length - 1}</em>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="tl-card-foot">
                  {t.phone && (
                    <span className="tl-meta"><Phone size={14} /> {t.phone}</span>
                  )}
                  {t.password && (
                    <span className="tl-meta">
                      <KeyRound size={14} />
                      <span className="tl-pass">{shown[id] ? t.password : "••••••"}</span>
                      <button
                        type="button"
                        className="tl-eye"
                        onClick={() => setShown((p) => ({ ...p, [id]: !p[id] }))}
                        title={shown[id] ? "Qari" : "Muuji"}
                      >
                        {shown[id] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </span>
                  )}
                  <div className="tl-actions">
                    <button type="button" className="btn btn-light btn-sm" onClick={() => onEdit?.(t)}>
                      <Pencil size={14} /> Edit
                    </button>
                    {onDelete && (
                      <button type="button" className="btn btn-sm tl-delete" onClick={() => setConfirm(t)} title="Delete teacher">
                        <Trash2 size={14} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {confirm && (
        <DeleteTeacherModal
          teacher={confirm}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await onDelete(confirm);
            setConfirm(null);
          }}
        />
      )}
    </div>
  );
}

// Xaqiijinta tirtirka — si macallin aan si qalad ah loo tirtirin
function DeleteTeacherModal({ teacher, onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const asg = teacherAssignments(teacher);

  async function go() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message || "Lama tirtiri karin.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => !busy && onCancel()}>
      <div className="modal tl-del-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="tl-del-close" onClick={onCancel} disabled={busy} aria-label="Close">
          <X size={18} />
        </button>
        <div className="tl-del-icon"><AlertTriangle size={26} /></div>
        <h3>Move to Recycle Bin?</h3>
        <p>
          Ma u guurinaysaa <b>{teacher.fullName}</b> (@{teacher.username || teacher.docId}) Recycle Bin?
        </p>
        <ul className="tl-del-list">
          <li>Inta uu Recycle Bin-ka ku jiro, Teacher Portal-ka ma geli karo.</li>
          <li>Database-ka lagama saarayo — Recycle Bin-ka ayaad dib uga soo celin kartaa.</li>
          <li>{asg.length} class ayaa laga saarayaa: {asg.map((a) => a.className).join(", ") || "—"}.</li>
          <li>Xaadirintii iyo natiijooyinkii hore ee uu keydiyay way sii jirayaan.</li>
        </ul>
        {error && <p className="error">{error}</p>}
        <div className="tl-del-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn tl-del-confirm" onClick={go} disabled={busy}>
            <Trash2 size={15} /> {busy ? "Moving..." : "Move to Recycle Bin"}
          </button>
        </div>
      </div>
    </div>
  );
}

const TONES = {
  green: ["var(--t-green-bg)", "var(--t-green)"],
  blue: ["var(--t-blue-bg)", "var(--t-blue)"],
  amber: ["var(--t-amber-bg)", "var(--t-amber)"],
  violet: ["var(--t-violet-bg)", "var(--t-violet)"],
};

function Stat({ Icon, value, label, tone }) {
  const [bg, fg] = TONES[tone];
  return (
    <div className="tl-stat">
      <span className="tl-stat-icon" style={{ background: bg, color: fg }}><Icon size={20} /></span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}