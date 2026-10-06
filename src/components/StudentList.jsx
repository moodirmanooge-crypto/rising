// src/components/StudentList.jsx
//
// Admin → Student List: dhammaan ardayda (live) oo muuqaal cusub leh.
//  • Kaararka fasallada (tirada ardayda fasal kasta) — riix si aad u shaandhayso
//  • Raadin (magac, ID, waalid, taleefan), shaandhee Shift iyo Fee Type
//  • Laba muuqaal: Cards (kaar arday kasta) iyo Table (liis cufan)
//  • Password-ka: qari/muuji + copy;  ✏️ Edit — xogta ardayga oo dhan

import { useMemo, useState } from "react";
import {
  Search, Pencil, KeyRound, Eye, EyeOff, Copy, Check, Phone, User, LayoutGrid, List,
  GraduationCap, BookOpen, Clock, Wallet, Users, X, SlidersHorizontal, Trash2,
} from "lucide-react";
import { CLASSES, SHIFTS, FEE_TYPES, studentGroups, classOfStudent } from "../config/schoolOptions";
import { initials } from "./PortalLayout";

function classOf(student) {
  return classOfStudent(student);
}

function subjectsOf(s) {
  return Array.isArray(s.subjects) ? s.subjects : s.subjects ? [s.subjects] : [];
}

function PasswordChip({ value }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="muted">—</span>;
  return (
    <span className="sl-pass">
      <KeyRound size={13} />
      <code>{show ? value : "•".repeat(Math.min(String(value).length, 8))}</code>
      <button type="button" onClick={() => setShow((v) => !v)} title={show ? "Qari" : "Muuji"}>
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <button
        type="button"
        title="Copy"
        onClick={() =>
          navigator.clipboard?.writeText(String(value)).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
        }
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </span>
  );
}

export default function StudentList({ students, loading, onEdit, onDelete, onAdd, savedNote }) {
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [shift, setShift] = useState("");
  const [feeType, setFeeType] = useState("");
  const [view, setView] = useState("cards");
  const [sort, setSort] = useState("id");

  const classCounts = useMemo(() => {
    const map = {};
    students.forEach((s) => {
      const c = classOf(s);
      const key = c ? c.id : "_none";
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [students]);

  const totals = useMemo(() => {
    let monthly = 0;
    let withPassword = 0;
    students.forEach((s) => {
      monthly += Number(s.monthlyFee) || 0;
      if (s.password) withPassword += 1;
    });
    return { monthly, withPassword };
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = students.filter((s) => {
      if (classId) {
        const c = classOf(s);
        if (classId === "_none" ? c : c?.id !== classId) return false;
      }
      if (shift && s.shift !== shift) return false;
      if (feeType && s.feeType !== feeType) return false;
      if (!q) return true;
      return [
        s.fullName, s.studentId, s.motherName, s.parentPhone, s.studentPhone,
        s.className, ...studentGroups(s), ...subjectsOf(s),
      ].some((v) => String(v || "").toLowerCase().includes(q));
    });
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || "")));
    else if (sort === "newest") sorted.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    else sorted.sort((a, b) => String(a.studentId).localeCompare(String(b.studentId), undefined, { numeric: true }));
    return sorted;
  }, [students, search, classId, shift, feeType, sort]);

  const activeFilters = [classId, shift, feeType, search.trim()].filter(Boolean).length;

  function clearFilters() {
    setSearch("");
    setClassId("");
    setShift("");
    setFeeType("");
  }

  return (
    <div className="stack">
      {/* ===== Hero ===== */}
      <div className="sl-hero">
        <div className="sl-hero-text">
          <span className="hero-kicker">Rising Star School</span>
          <h2>Student Directory</h2>
          <p>Dhammaan ardayda diiwaangashan — raadi, shaandhee, eeg ama wax ka beddel.</p>
        </div>
        <div className="sl-hero-stats">
          <div>
            <strong>{students.length}</strong>
            <span>Students<em>Ardayda</em></span>
          </div>
          <div>
            <strong>{CLASSES.filter((c) => classCounts[c.id]).length}</strong>
            <span>Classes<em>Fasallada</em></span>
          </div>
          <div>
            <strong>${totals.monthly.toLocaleString()}</strong>
            <span>Monthly fees<em>Bishii</em></span>
          </div>
        </div>
        <button type="button" className="btn sl-add-btn" onClick={onAdd}>
          <GraduationCap size={17} /> Add Student
        </button>
      </div>

      {savedNote && <p className="banner banner-green" style={{ margin: 0 }}>{savedNote}</p>}

      {/* ===== Class tiles ===== */}
      <div className="sl-class-tiles">
        <button
          type="button"
          className={`sl-tile tone-slate ${classId === "" ? "active" : ""}`}
          onClick={() => setClassId("")}
        >
          <span className="sl-tile-icon"><Users size={18} /></span>
          <strong>{students.length}</strong>
          <span>All classes</span>
        </button>
        {CLASSES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`sl-tile tone-${c.color} ${classId === c.id ? "active" : ""}`}
            onClick={() => setClassId(classId === c.id ? "" : c.id)}
          >
            <span className="sl-tile-icon"><GraduationCap size={18} /></span>
            <strong>{classCounts[c.id] || 0}</strong>
            <span>{c.name}</span>
          </button>
        ))}
        {classCounts._none > 0 && (
          <button
            type="button"
            className={`sl-tile tone-red ${classId === "_none" ? "active" : ""}`}
            onClick={() => setClassId(classId === "_none" ? "" : "_none")}
          >
            <span className="sl-tile-icon"><X size={18} /></span>
            <strong>{classCounts._none}</strong>
            <span>No class</span>
          </button>
        )}
      </div>

      {/* ===== Toolbar ===== */}
      <div className="sl-toolbar">
        <div className="search-box sl-search">
          <Search size={16} />
          <input
            placeholder="Search name, ID, parent, phone, subject…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={shift} onChange={(e) => setShift(e.target.value)}>
          <option value="">All shifts</option>
          {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={feeType} onChange={(e) => setFeeType(e.target.value)}>
          <option value="">All fee types</option>
          {FEE_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="id">Sort: ID</option>
          <option value="name">Sort: Name A–Z</option>
          <option value="newest">Sort: Newest</option>
        </select>
        <div className="sl-view-toggle">
          <button type="button" className={view === "cards" ? "active" : ""} onClick={() => setView("cards")} title="Cards">
            <LayoutGrid size={16} />
          </button>
          <button type="button" className={view === "table" ? "active" : ""} onClick={() => setView("table")} title="Table">
            <List size={16} />
          </button>
        </div>
      </div>

      <div className="sl-result-line">
        <span>
          <SlidersHorizontal size={14} /> Showing <strong>{filtered.length}</strong> of {students.length} students
        </span>
        {activeFilters > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
            <X size={13} /> Clear filters
          </button>
        )}
      </div>

      {/* ===== List ===== */}
      {loading ? (
        <div className="panel"><p className="muted">Loading...</p></div>
      ) : filtered.length === 0 ? (
        <div className="panel empty">
          <Users size={34} />
          <strong>No students found</strong>
          <span>{students.length ? "Beddel raadinta ama shaandhaynta." : "Weli arday lama diiwaangelin."}</span>
        </div>
      ) : view === "cards" ? (
        <div className="sl-grid">
          {filtered.map((s) => {
            const c = classOf(s);
            const groups = studentGroups(s);
            const subs = subjectsOf(s);
            return (
              <article key={s.studentId} className={`sl-card tone-${c?.color || "slate"}`}>
                <div className="sl-card-band" />
                <div className="sl-card-top">
                  {s.photoUrl ? (
                    <img src={s.photoUrl} alt={s.fullName} className="sl-photo" />
                  ) : (
                    <span className="sl-photo sl-photo-ph">{initials(s.fullName)}</span>
                  )}
                  <div className="sl-card-id">
                    <span className="sl-id">ID {s.studentId}</span>
                    <h3>{s.fullName}</h3>
                    <div className="sl-groups">
                      {groups.length ? groups.map((g) => (
                        <span key={g} className="sl-class-pill">{g}</span>
                      )) : <span className="sl-class-pill muted">No class</span>}
                    </div>
                  </div>
                </div>

                <div className="sl-info">
                  <div>
                    <User size={14} />
                    <span>Parent</span>
                    <strong>{s.motherName || "—"}</strong>
                  </div>
                  <div>
                    <Phone size={14} />
                    <span>Parent phone</span>
                    <strong>{s.parentPhone || "—"}</strong>
                  </div>
                  <div>
                    <Phone size={14} />
                    <span>Student phone</span>
                    <strong>{s.studentPhone || "—"}</strong>
                  </div>
                  <div>
                    <Clock size={14} />
                    <span>Shift</span>
                    <strong>{s.shift || "—"}</strong>
                  </div>
                </div>

                <div className="sl-subjects">
                  <span className="sl-label"><BookOpen size={13} /> Subjects</span>
                  <div className="tag-list">
                    {subs.length ? subs.map((x) => <span key={x} className="tag">{x}</span>) : <span className="muted-sm">—</span>}
                  </div>
                </div>

                <div className="sl-fees">
                  <div><span>Fee type</span><strong>{s.feeType || "—"}</strong></div>
                  <div><span>Registration</span><strong>${s.registrationFee ?? 0}</strong></div>
                  <div><span>Monthly</span><strong>${s.monthlyFee ?? 0}</strong></div>
                </div>

                <div className="sl-card-foot">
                  <PasswordChip value={s.password} />
                  {onDelete && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDelete(s)} title="Move to Recycle Bin">
                      <Trash2 size={14} />
                    </button>
                  )}
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => onEdit(s)}>
                    <Pencil size={14} /> Edit
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="panel">
          <div className="table-scroll fit">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Parent</th>
                  <th>Student Phone</th>
                  <th>Subjects</th>
                  <th>Shift / Fee</th>
                  <th>Fees</th>
                  <th>Password</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.studentId}>
                    <td>
                      <div className="cell-person">
                        {s.photoUrl ? (
                          <img src={s.photoUrl} alt={s.fullName} className="avatar" />
                        ) : (
                          <span className="avatar avatar-placeholder">{initials(s.fullName)}</span>
                        )}
                        <div className="cell-stack">
                          <strong>{s.fullName}</strong>
                          <span className="id-chip">ID {s.studentId}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="tag-list">
                        {studentGroups(s).length
                          ? studentGroups(s).map((g) => <span key={g} className="tag tag-soft">{g}</span>)
                          : <span className="muted">—</span>}
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <strong>{s.motherName || "—"}</strong>
                        <span className="muted-sm">{s.parentPhone || "—"}</span>
                      </div>
                    </td>
                    <td>{s.studentPhone || <span className="muted">—</span>}</td>
                    <td>
                      <div className="tag-list">
                        {subjectsOf(s).map((x) => <span key={x} className="tag">{x}</span>)}
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <span>{s.shift || "—"}</span>
                        <span className="muted-sm">{s.feeType || "—"}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack nowrap">
                        <span>Reg: <strong>${s.registrationFee ?? 0}</strong></span>
                        <span>Monthly: <strong>${s.monthlyFee ?? 0}</strong></span>
                      </div>
                    </td>
                    <td><PasswordChip value={s.password} /></td>
                    <td>
                      {onDelete && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDelete(s)} title="Move to Recycle Bin" style={{ marginRight: 6 }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                      <button type="button" className="btn btn-light btn-sm" onClick={() => onEdit(s)}>
                        <Pencil size={14} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && students.length > 0 && (
        <p className="hint" style={{ textAlign: "center" }}>
          <Wallet size={13} /> {totals.withPassword}/{students.length} arday ayaa leh password portal.
        </p>
      )}
    </div>
  );
}