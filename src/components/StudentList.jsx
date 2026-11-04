// src/components/StudentList.jsx
//
// Admin → Student List: dhammaan ardayda (live) oo muuqaal cusub leh.
//  • Kaararka fasallada (tirada ardayda fasal kasta) — riix si aad u shaandhayso
//  • Raadin (magac, ID, waalid, taleefan), shaandhee Shift iyo Fee Type
//  • Laba muuqaal: Cards (kaar arday kasta) iyo Table (liis cufan)
//  • Password-ka: qari/muuji + copy;  ✏️ Edit — xogta ardayga oo dhan

import { useMemo, useState } from "react";
import { doc, updateDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { STUDENTS_COLLECTION } from "../config/collections";
import {
  Search, Pencil, KeyRound, Eye, EyeOff, Copy, Check, Phone, User, LayoutGrid, List,
  GraduationCap, BookOpen, Clock, Wallet, Users, X, SlidersHorizontal, Trash2, CheckSquare,
} from "lucide-react";
import { CLASSES, SHIFTS, FEE_TYPES, GENDERS, genderOf, isFreeStudent, studentGroups, classOfStudent, studentInClass } from "../config/schoolOptions";

const studentRef = (s) => doc(db, STUDENTS_COLLECTION, s.docId || String(s.studentId));

// Jinsiga hal riix ayaa lagu keydiyaa (ardayda hore ee aan gender lahayn)
function GenderQuick({ s }) {
  const [busy, setBusy] = useState("");
  async function set(value) {
    setBusy(value);
    try {
      await updateDoc(studentRef(s), { gender: value, updatedAt: serverTimestamp() });
    } catch (e) {
      alert(e.message || "Lama keydin karin.");
    } finally {
      setBusy("");
    }
  }
  return (
    <span className="gender-quick" title="Jinsiga lama qorin — dooro">
      {GENDERS.map((g) => (
        <button
          key={g.value}
          type="button"
          className={g.value === "Male" ? "male" : "female"}
          disabled={!!busy}
          onClick={() => set(g.value)}
        >
          {g.value === "Male" ? "♂" : "♀"} {busy === g.value ? "…" : g.so}
        </button>
      ))}
    </span>
  );
}

// Ka dhig Free (bilaash): feeType = Free, lacagaha = 0 → Cashier-ka kama muuqdo
async function makeFree(s) {
  if (!window.confirm(`${s.fullName} ma laga dhigayaa FREE (bilaash)?\n\nLacag bille ah lagama qaadi doono, Cashier-kana kama muuqan doono.`)) return;
  try {
    await updateDoc(studentRef(s), { feeType: "Free", monthlyFee: 0, registrationFee: 0, updatedAt: serverTimestamp() });
  } catch (e) {
    alert(e.message || "Lama keydin karin.");
  }
}
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

function GenderBadge({ s, empty = null }) {
  const g = genderOf(s);
  if (!g) return empty ? <span className="muted">{empty}</span> : null;
  const meta = GENDERS.find((x) => x.value === g);
  return (
    <span className={`gender-badge ${g === "Male" ? "male" : "female"}`} title={meta.label}>
      {g === "Male" ? "♂" : "♀"} {meta.so}
    </span>
  );
}

export default function StudentList({ students, loading, onEdit, onDelete, onAdd, savedNote }) {
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [shift, setShift] = useState("");
  const [feeType, setFeeType] = useState("");
  const [gender, setGender] = useState("");
  // Bulk gender: ardayda la doortay → hal riix Wiil / Gabar
  const [picked, setPicked] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState("");
  const [bulkNote, setBulkNote] = useState("");
  const [view, setView] = useState("cards");
  const [sort, setSort] = useState("id");

  const classCounts = useMemo(() => {
    const map = {};
    // Arday fasallo badan ku jira wuxuu ku tirsan yahay fasal kasta oo uu ku jiro
    students.forEach((s) => {
      const mine = CLASSES.filter((c) => studentInClass(s, c.id));
      if (!mine.length) map._none = (map._none || 0) + 1;
      mine.forEach((c) => (map[c.id] = (map[c.id] || 0) + 1));
    });
    return map;
  }, [students]);

  const totals = useMemo(() => {
    let monthly = 0;
    let withPassword = 0;
    const g = { Male: 0, Female: 0, "": 0 };
    students.forEach((s) => {
      monthly += Number(s.monthlyFee) || 0;
      if (s.password) withPassword += 1;
      g[genderOf(s)] += 1;
    });
    return { monthly, withPassword, male: g.Male, female: g.Female, noGender: g[""] };
  }, [students]);

  // Shift kasta inta arday ku jirta
  const shiftCounts = useMemo(() => {
    const c = { _none: 0 };
    SHIFTS.forEach((sh) => (c[sh] = 0));
    students.forEach((st) => {
      const sh = SHIFTS.find((x) => x.toLowerCase() === String(st.shift || "").trim().toLowerCase());
      if (sh) c[sh] += 1;
      else c._none += 1;
    });
    return c;
  }, [students]);

  function togglePick(id) {
    setBulkNote("");
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkGender(value) {
    const list = students.filter((st) => picked.has(String(st.studentId)));
    if (!list.length) return;
    setBulkBusy(value);
    setBulkNote("");
    try {
      for (let i = 0; i < list.length; i += 400) {
        const batch = writeBatch(db);
        list.slice(i, i + 400).forEach((st) => batch.update(studentRef(st), { gender: value, updatedAt: serverTimestamp() }));
        await batch.commit();
      }
      setBulkNote(`✓ ${list.length} arday waxaa loo qoray ${value === "Male" ? "♂ Wiil" : "♀ Gabar"}.`);
      setPicked(new Set());
    } catch (e) {
      setBulkNote(`Lama keydin karin: ${e.message || e}`);
    } finally {
      setBulkBusy("");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = students.filter((s) => {
      if (classId) {
        if (classId === "_none" ? classOf(s) : !studentInClass(s, classId)) return false;
      }
      if (shift && s.shift !== shift) return false;
      if (feeType && s.feeType !== feeType) return false;
      if (gender && genderOf(s) !== (gender === "_none" ? "" : gender)) return false;
      if (shift === "_none" && SHIFTS.some((x) => x.toLowerCase() === String(s.shift || "").trim().toLowerCase())) return false;
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
  }, [students, search, classId, shift, feeType, gender, sort]);

  const activeFilters = [classId, shift, feeType, gender, search.trim()].filter(Boolean).length;

  function clearFilters() {
    setSearch("");
    setClassId("");
    setShift("");
    setFeeType("");
    setGender("");
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
            <strong>{totals.male}</strong>
            <span>Boys<em>Wiil</em></span>
          </div>
          <div>
            <strong>{totals.female}</strong>
            <span>Girls<em>Gabar</em></span>
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

      {totals.noGender > 0 && (
        <div className="gender-banner">
          <span className="gender-banner-ico">⚥</span>
          <div>
            <strong>{totals.noGender} arday jinsigooda lama qorin</strong>
            <span>
              Wiil {totals.male} · Gabar {totals.female}. Si tirada u noqoto mid sax ah, arday kasta ku riix <b>♂ Wiil</b> ama{" "}
              <b>♀ Gabar</b> — isla markiiba waa la keydinayaa.
            </span>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setGender(gender === "_none" ? "" : "_none")}>
            {gender === "_none" ? "Muuji dhammaan" : "Muuji kuwa aan la qorin"}
          </button>
        </div>
      )}

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

      {/* ===== Shift kasta ===== */}
      <div className="sl-shifts">
        <span className="sl-shifts-label"><Clock size={14} /> Shifts</span>
        {SHIFTS.map((sh) => (
          <button
            key={sh}
            type="button"
            className={`sl-shift ${shift === sh ? "on" : ""}`}
            onClick={() => setShift(shift === sh ? "" : sh)}
          >
            {sh}
            <b>{shiftCounts[sh]}</b>
          </button>
        ))}
        {shiftCounts._none > 0 && (
          <button type="button" className={`sl-shift warn ${shift === "_none" ? "on" : ""}`} onClick={() => setShift(shift === "_none" ? "" : "_none")}>
            Shift lama qorin
            <b>{shiftCounts._none}</b>
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
          {SHIFTS.map((s) => <option key={s} value={s}>{s} ({shiftCounts[s]})</option>)}
          {shiftCounts._none > 0 && <option value="_none">Shift lama qorin ({shiftCounts._none})</option>}
        </select>
        <select value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">All genders</option>
          {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label} — {g.so}</option>)}
          {totals.noGender > 0 && <option value="_none">Not set ({totals.noGender})</option>}
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
        <span className="sl-result-actions">
          <button
            type="button"
            className="btn btn-light btn-sm"
            disabled={!filtered.length}
            onClick={() => {
              setBulkNote("");
              const all = filtered.every((st) => picked.has(String(st.studentId)));
              setPicked(all ? new Set() : new Set(filtered.map((st) => String(st.studentId))));
            }}
          >
            <CheckSquare size={14} />
            {filtered.length && filtered.every((st) => picked.has(String(st.studentId)))
              ? "Ka saar doorashada"
              : `Dooro dhammaan (${filtered.length})`}
          </button>
          {activeFilters > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <X size={13} /> Clear filters
            </button>
          )}
        </span>
      </div>

      {bulkNote && <p className={`banner ${bulkNote.startsWith("✓") ? "banner-green" : "banner-amber"}`} style={{ margin: 0 }}>{bulkNote}</p>}

      {picked.size > 0 && (
        <div className="sl-bulk" role="region" aria-label="Bulk gender">
          <span className="sl-bulk-count"><b>{picked.size}</b> arday la doortay</span>
          <span className="sl-bulk-label">Jinsiga u dhig:</span>
          <button type="button" className="sl-bulk-btn male" disabled={!!bulkBusy} onClick={() => bulkGender("Male")}>
            ♂ {bulkBusy === "Male" ? "Keydinaya…" : "Wiil"}
          </button>
          <button type="button" className="sl-bulk-btn female" disabled={!!bulkBusy} onClick={() => bulkGender("Female")}>
            ♀ {bulkBusy === "Female" ? "Keydinaya…" : "Gabar"}
          </button>
          <button type="button" className="sl-bulk-clear" disabled={!!bulkBusy} onClick={() => setPicked(new Set())}>
            <X size={14} /> Ka saar
          </button>
        </div>
      )}

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
              <article key={s.studentId} className={`sl-card tone-${c?.color || "slate"} ${picked.has(String(s.studentId)) ? "picked" : ""}`}>
                <div className="sl-card-band" />
                <label className="sl-pick" title="Dooro (bulk gender)">
                  <input
                    type="checkbox"
                    checked={picked.has(String(s.studentId))}
                    onChange={() => togglePick(String(s.studentId))}
                    aria-label={`Dooro ${s.fullName}`}
                  />
                </label>
                <div className="sl-card-top">
                  {s.photoUrl ? (
                    <img src={s.photoUrl} alt={s.fullName} className="sl-photo" />
                  ) : (
                    <span className="sl-photo sl-photo-ph">{initials(s.fullName)}</span>
                  )}
                  <div className="sl-card-id">
                    <span className="sl-id">
                      ID {s.studentId}
                      {genderOf(s) ? <GenderBadge s={s} /> : <GenderQuick s={s} />}
                    </span>
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
                  {isFreeStudent(s) ? (
                    <span className="free-badge">FREE</span>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm sl-free-btn" onClick={() => makeFree(s)} title="Ka dhig Free (bilaash)">
                      Free
                    </button>
                  )}
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
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      className="sl-pick-box"
                      aria-label="Dooro dhammaan"
                      checked={filtered.length > 0 && filtered.every((st) => picked.has(String(st.studentId)))}
                      onChange={(e) =>
                        setPicked(e.target.checked ? new Set(filtered.map((st) => String(st.studentId))) : new Set())
                      }
                    />
                  </th>
                  <th>Student</th>
                  <th>Gender</th>
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
                  <tr key={s.studentId} className={picked.has(String(s.studentId)) ? "sl-row-picked" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        className="sl-pick-box"
                        checked={picked.has(String(s.studentId))}
                        onChange={() => togglePick(String(s.studentId))}
                        aria-label={`Dooro ${s.fullName}`}
                      />
                    </td>
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
                    <td>{genderOf(s) ? <GenderBadge s={s} /> : <GenderQuick s={s} />}</td>
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