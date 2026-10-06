// src/components/ClassesView.jsx
//
// Admin → Classes
// ------------------------------------------------------------------
// • 7-da fasal ee warqadda. Preparation iyo English waxay leeyihiin
//   Class A·B·C·D (English: Elementary A–D iyo Intermediate A–D).
// • Fasal kasta waa la FURAA (drawer) si loo arko ardayda oo dhan.
// • Wareejinta / Promote: marka hore waa la weydiinayaa "Ma la
//   wareejinayaa?". Haa → liiska ardayda ayaa soo baxa, magaca ardayga
//   fasalka KU HADHAYA ayaa la raadin karaa oo laga saari karaa.
// • Si toos ah (hawada): ardayda Elementary ee aan section lahayn →
//   Elementary A, Preparation aan section lahayn → Preparation A.
//   Firestore waa la cusboonaysiiyaa marka boggan la furo.
// • Xogtu waa live (onSnapshot) — teacher-ka fasalka cusub isla markiiba
//   ayuu arkaa ardayga.
// ------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from "react";
import { doc, updateDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import {
  Users,
  Search,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  GraduationCap,
  X,
  ArrowUpCircle,
  LayoutGrid,
  List,
  Phone,
  ChevronRight,
  UserCheck,
  UserMinus,
  Sparkles,
} from "lucide-react";
import { db } from "../firebase";
import { STUDENTS_COLLECTION } from "../config/collections";
import {
  CLASSES,
  CLASS_BY_ID,
  ENGLISH_LEVELS,
  groupLabel,
  placementsOf,
  placementFields,
  studentInClass,
  studentInSub,
  studentNeedsSub,
  teacherGroups,
} from "../config/schoolOptions";
import { initials } from "./PortalLayout";

const NEEDS = "_needs";

// ------------------------------------------------------------------
// Move targets
// ------------------------------------------------------------------
const MOVE_TARGETS = CLASSES.flatMap((c) => {
  if (!c.subs) return [{ key: c.id, group: "School classes", label: c.name, classId: c.id, subIds: [] }];
  if (c.id === "open") {
    return [
      ...c.subs.map((s) => ({ key: `open:${s.id}`, group: c.name, label: groupLabel(c, s), classId: c.id, subIds: [s.id] })),
      { key: "open:both", group: c.name, label: "Open Classes – Af-Somali + Xisaab", classId: c.id, subIds: c.subs.map((s) => s.id) },
    ];
  }
  if (c.id === "english") {
    return c.subs.map((s) => ({ key: `english:${s.id}`, group: `English ${s.level}`, label: s.name, classId: c.id, subIds: [s.id] }));
  }
  return c.subs.map((s) => ({ key: `${c.id}:${s.id}`, group: c.name, label: groupLabel(c, s), classId: c.id, subIds: [s.id] }));
});
const TARGET_BY_KEY = Object.fromEntries(MOVE_TARGETS.map((t) => [t.key, t]));
const TARGET_GROUPS = [...new Set(MOVE_TARGETS.map((t) => t.group))];

// Fasalka xiga (Promote).
function nextTargetKey(classId, subId) {
  if (classId === "preparation") return "class8";
  if (classId === "class8") return "f4";
  if (classId === "english" && subId && subId.startsWith("english-elementary-")) {
    return `english:${subId.replace("elementary", "intermediate")}`;
  }
  if (classId === "health" && subId === "basic-health") return "health:first-aid";
  return "";
}

function placeLabel(classId, subId) {
  const cls = CLASS_BY_ID[classId];
  const sub = cls?.subs?.find((x) => x.id === subId);
  return sub ? groupLabel(cls, sub) : cls?.name || "";
}

function currentLabel(student) {
  const p = placementsOf(student).find((x) => !x.auto) || null;
  if (p) return placeLabel(p.classId, p.subId);
  return student.className || "No class";
}

function placementText(student) {
  return placementsOf(student).map((p) => {
    const cls = CLASS_BY_ID[p.classId];
    const sub = cls?.subs?.find((s) => s.id === p.subId);
    if (sub) return { text: groupLabel(cls, sub), warn: false };
    return { text: cls?.subs ? `${cls.name} — sub lama yaqaan` : cls?.name, warn: !!cls?.subs };
  });
}

function subjectsKeep(student, target) {
  const cls = CLASS_BY_ID[target.classId];
  const allowed = target.subIds.length
    ? cls.subs.filter((s) => target.subIds.includes(s.id)).flatMap((s) => s.subjects || [])
    : cls.subjects || [];
  const mine = Array.isArray(student.subjects) ? student.subjects : [];
  const keep = mine.filter((x) => allowed.includes(x));
  return keep.length ? keep : [...new Set(allowed)];
}

async function writeMove(student, target, type) {
  const fields = placementFields(target.classId, target.subIds, subjectsKeep(student, target));
  await updateDoc(doc(db, STUDENTS_COLLECTION, student.docId || String(student.studentId)), {
    ...fields,
    updatedAt: serverTimestamp(),
    classHistory: arrayUnion({ from: currentLabel(student), to: target.label, type, at: new Date().toISOString() }),
  });
}

function Avatar({ s, size = "" }) {
  return s.photoUrl ? (
    <img src={s.photoUrl} alt={s.fullName} className={`avatar ${size}`} />
  ) : (
    <span className={`avatar avatar-placeholder ${size}`}>{initials(s.fullName)}</span>
  );
}

function MoveSelect({ value, onChange, placeholder = "Move to…", disabled }) {
  return (
    <select className="cv-move-select" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">{placeholder}</option>
      {TARGET_GROUPS.map((g) => (
        <optgroup key={g} label={g}>
          {MOVE_TARGETS.filter((t) => t.group === g).map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// ==================================================================
// Transfer modal — 1) Haa / Maya   2) yaa ku hadhaya (raadi magaca)
// ==================================================================
function TransferModal({ request, onClose, onDone }) {
  const { target, people, type, fromLabel } = request;
  const single = people.length === 1;
  const [step, setStep] = useState("ask");
  const [stay, setStay] = useState(() => new Set());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const moving = people.filter((p) => !stay.has(p.studentId));
  const query = q.trim().toLowerCase();
  const shown = query
    ? people.filter((p) => String(p.fullName || "").toLowerCase().includes(query) || String(p.studentId).includes(query))
    : people;

  function toggleStay(id) {
    setStay((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirm(list) {
    if (!list.length) return;
    setBusy(true);
    setErr("");
    try {
      await Promise.all(list.map((s) => writeMove(s, target, type)));
      onDone({
        moved: list.length,
        stayed: people.length - list.length,
        target: target.label,
        type,
        names: list.length === 1 ? list[0].fullName : "",
      });
    } catch (e) {
      setErr(e.message || "Wareejintu way fashilantay.");
      setBusy(false);
    }
  }

  const verb = type === "promote" ? "loo gudbinayaa" : "loo wareejinayaa";

  return (
    <div className="cv-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="cv-modal" role="dialog" aria-modal="true">
        <button type="button" className="cv-modal-x" onClick={onClose} disabled={busy} aria-label="Close">
          <X size={18} />
        </button>

        <div className="cv-modal-route">
          <span className="cv-route-chip from">{fromLabel}</span>
          <ChevronRight size={18} />
          <span className="cv-route-chip to">{target.label}</span>
        </div>

        {step === "ask" ? (
          <>
            <div className="cv-modal-icon"><ArrowUpCircle size={28} /></div>
            <h3>{single ? `Ma ${verb} ${people[0].fullName}?` : `Ma ${verb} ardayda ${fromLabel}?`}</h3>
            <p className="cv-modal-text">
              {single
                ? `${people[0].fullName} wuxuu ka bixi doonaa ${fromLabel}, wuxuuna geli doonaa ${target.label}. Teacher-ka fasalka cusub ayaa xaadirin doona.`
                : `${people.length} arday ayaa ${verb} ${target.label}. Haddii aad tiraahdo Haa, waxaad dooran kartaa ardayda fasalka ku hadhaya.`}
            </p>
            {err && <p className="error">{err}</p>}
            <div className="cv-modal-actions">
              <button type="button" className="btn btn-light" onClick={onClose} disabled={busy}>
                Maya
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => (single ? confirm(people) : setStep("pick"))}>
                {busy ? "Wareejinaya…" : "Haa"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3>Yaa fasalka ku hadhaya?</h3>
            <p className="cv-modal-text">
              Ardayda oo dhan waa la wareejinayaa. Raadi magaca ardayga <b>ku hadhaya {fromLabel}</b>, kadibna riix
              “Ha joogo”.
            </p>

            <div className="cv-modal-stats">
              <span className="go"><UserCheck size={15} /> {moving.length} la wareejinayo</span>
              <span className="stay"><UserMinus size={15} /> {stay.size} ku hadhaya</span>
            </div>

            <div className="search-box cv-modal-search">
              <Search size={16} />
              <input autoFocus placeholder="Raadi magaca ardayga…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>

            <div className="cv-pick-list">
              {shown.map((s) => {
                const stays = stay.has(s.studentId);
                return (
                  <div key={s.studentId} className={`cv-pick ${stays ? "stays" : ""}`}>
                    <Avatar s={s} />
                    <div className="cv-pick-body">
                      <strong>{s.fullName}</strong>
                      <span>ID {s.studentId} • {stays ? `Wuxuu ku hadhayaa ${fromLabel}` : `→ ${target.label}`}</span>
                    </div>
                    <button type="button" className={`cv-pick-btn ${stays ? "on" : ""}`} onClick={() => toggleStay(s.studentId)}>
                      {stays ? <><ArrowUpCircle size={14} /> Wareeji</> : <><UserMinus size={14} /> Ha joogo</>}
                    </button>
                  </div>
                );
              })}
              {shown.length === 0 && <p className="muted-sm" style={{ padding: 12 }}>Arday lama helin.</p>}
            </div>

            {err && <p className="error">{err}</p>}
            <div className="cv-modal-actions">
              <button type="button" className="btn btn-light" onClick={() => setStep("ask")} disabled={busy}>
                Dib u noqo
              </button>
              <button type="button" className="btn btn-primary" disabled={busy || !moving.length} onClick={() => confirm(moving)}>
                <ArrowRightLeft size={15} /> {busy ? "Wareejinaya…" : `Wareeji ${moving.length} arday`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ==================================================================
// Class drawer — the opened class with all its students
// ==================================================================
function ClassDrawer({ classId, initialSub, data, teachers, onClose, onTransfer }) {
  const isUnassigned = classId === "unassigned";
  const active = CLASS_BY_ID[classId];
  const [subId, setSubId] = useState(initialSub || "");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [bulkTarget, setBulkTarget] = useState("");
  const [view, setView] = useState("list");

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  let list = isUnassigned ? data.unassigned : data.byClass[classId] || [];
  if (active?.subs && subId === NEEDS) list = data.needs[classId];
  else if (active?.subs && subId) list = data.bySub[`${classId}:${subId}`] || [];
  const q = search.trim().toLowerCase();
  if (q) list = list.filter((s) => String(s.fullName || "").toLowerCase().includes(q) || String(s.studentId || "").includes(q));
  list = [...list].sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || "")));

  const activeSub = active?.subs?.find((s) => s.id === subId);
  const title = isUnassigned
    ? "Students without a class"
    : subId === NEEDS
    ? `${active.name} — need placement`
    : activeSub
    ? groupLabel(active, activeSub)
    : active.name;
  const subjects = activeSub?.subjects || active?.subjects || [];

  const classTeachers = active
    ? teachers.filter((t) =>
        teacherGroups(t).some((g) => {
          const fake = { className: g };
          return activeSub ? studentInSub(fake, active.id, activeSub.id) : studentInClass(fake, active.id);
        })
      )
    : [];

  const nextKey =
    !isUnassigned && subId !== NEEDS && active
      ? active.subs
        ? subId
          ? nextTargetKey(active.id, subId)
          : active.id === "preparation"
          ? "class8"
          : ""
        : nextTargetKey(active.id, "")
      : "";
  const nextTarget = nextKey ? TARGET_BY_KEY[nextKey] : null;
  const selectedPeople = list.filter((s) => selected.has(s.studentId));
  const allSelected = list.length > 0 && list.every((s) => selected.has(s.studentId));
  const shiftCount = (sh) => list.filter((s) => s.shift === sh).length;

  function pickSub(id) {
    setSubId(id);
    setSelected(new Set());
    setBulkTarget("");
  }
  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function transfer(key, people, type = "move") {
    const target = TARGET_BY_KEY[key];
    if (!target || !people.length) return;
    onTransfer({ target, people, type, fromLabel: title }, () => {
      setSelected(new Set());
      setBulkTarget("");
    });
  }

  const tone = isUnassigned ? "amber" : activeSub?.color || active.color;
  const badge = isUnassigned ? "?" : activeSub?.section || CLASSES.findIndex((c) => c.id === classId) + 1;

  return (
    <div className="cv-drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className={`cv-drawer tone-${tone}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="cv-drawer-head">
          <div className="cv-drawer-title">
            <span className="cv-num">{badge}</span>
            <div>
              <span className="cv-drawer-kicker">{isUnassigned ? "Needs a class" : active.name}</span>
              <h2>{title}</h2>
              <p>{isUnassigned ? "Ardaydan fasal sax ah kuma jiraan — u wareeji fasalkooda." : activeSub?.so || active.so}</p>
            </div>
          </div>
          <button type="button" className="cv-drawer-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>

          <div className="cv-drawer-stats">
            <div><strong>{list.length}</strong><span>Students</span></div>
            <div><strong>{shiftCount("Morning")}</strong><span>Morning</span></div>
            <div><strong>{shiftCount("Afternoon")}</strong><span>Afternoon</span></div>
            <div><strong>{shiftCount("Evening")}</strong><span>Evening</span></div>
            <div><strong>{classTeachers.length}</strong><span>Teachers</span></div>
          </div>
        </header>

        <div className="cv-drawer-body">
          {active?.subs && !isUnassigned && (
            <div className="cv-tabs">
              <button type="button" className={`cv-tab ${!subId ? "on" : ""}`} onClick={() => pickSub("")}>
                All <b>{data.byClass[active.id].length}</b>
              </button>
              {active.subs.map((s) => (
                <button key={s.id} type="button" className={`cv-tab ${subId === s.id ? "on" : ""}`} onClick={() => pickSub(s.id)}>
                  {active.id === "english"
                    ? `${s.level.slice(0, 5)}. ${s.section}`
                    : active.id === "preparation"
                    ? `Class ${s.section}`
                    : s.name}
                  <b>{data.bySub[`${active.id}:${s.id}`].length}</b>
                </button>
              ))}
              {data.needs[active.id].length > 0 && (
                <button type="button" className={`cv-tab cv-tab-warn ${subId === NEEDS ? "on" : ""}`} onClick={() => pickSub(NEEDS)}>
                  <AlertTriangle size={13} /> Need placement <b>{data.needs[active.id].length}</b>
                </button>
              )}
            </div>
          )}

          {!isUnassigned && subjects.length > 0 && (
            <div className="cv-subject-row">
              <span>Subjects:</span>
              {subjects.map((x) => <em key={x}>{x}</em>)}
            </div>
          )}
          {classTeachers.length > 0 && (
            <div className="cv-subject-row">
              <span>Teachers:</span>
              {classTeachers.map((t) => (
                <em key={t.teacherId || t.id || t.fullName} className="cv-teacher">
                  {t.fullName}{t.subject ? ` — ${t.subject}` : ""}
                </em>
              ))}
            </div>
          )}

          {list.length > 0 && nextTarget && (
            <div className="cv-promote">
              <span className="cv-promote-icon"><ArrowUpCircle size={20} /></span>
              <div className="cv-promote-text">
                <strong>Promote → {nextTarget.label}</strong>
                <span>
                  Fasalka markuu dhammeeyo, u gudbi fasalka xiga.
                  {selectedPeople.length ? ` (${selectedPeople.length} la doortay)` : " Waxaa lagu weydiin doonaa kuwa ku hadhaya."}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => transfer(nextKey, selectedPeople.length ? selectedPeople : list, "promote")}
              >
                <ArrowUpCircle size={15} />
                {selectedPeople.length ? `Promote ${selectedPeople.length}` : `Promote all ${list.length}`}
              </button>
            </div>
          )}

          <div className="cv-bulk">
            <label className="cv-check">
              <input
                type="checkbox"
                checked={allSelected}
                disabled={!list.length}
                onChange={() => setSelected(allSelected ? new Set() : new Set(list.map((s) => s.studentId)))}
              />
              <span>{selected.size ? `${selected.size} selected` : "Select all"}</span>
            </label>
            <div className="search-box cv-drawer-search">
              <Search size={16} />
              <input placeholder="Search student" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="cv-bulk-actions">
              <div className="cv-view-toggle" role="group" aria-label="View">
                <button type="button" className={view === "list" ? "on" : ""} onClick={() => setView("list")} title="List"><List size={15} /></button>
                <button type="button" className={view === "cards" ? "on" : ""} onClick={() => setView("cards")} title="Cards"><LayoutGrid size={15} /></button>
              </div>
              <MoveSelect value={bulkTarget} onChange={setBulkTarget} placeholder="Move selected to…" />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!bulkTarget || !selectedPeople.length}
                onClick={() => transfer(bulkTarget, selectedPeople)}
              >
                <ArrowRightLeft size={14} /> Move
              </button>
            </div>
          </div>

          {list.length === 0 ? (
            <div className="empty">
              <Users size={34} />
              <strong>No students here yet</strong>
              <span>Fasalkan weli arday kuma jiro.</span>
            </div>
          ) : view === "list" ? (
            <div className="cv-table-wrap">
              <table className="cv-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }} />
                    <th style={{ width: 40 }}>#</th>
                    <th>Student · Ardayga</th>
                    <th>ID</th>
                    <th>Shift</th>
                    <th>Phone</th>
                    <th>Class · Fasalka</th>
                    <th style={{ width: 230, textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s, i) => {
                    const places = placementText(s);
                    const needs = isUnassigned || subId === NEEDS || (active?.subs && studentNeedsSub(s, active.id));
                    const p = placementsOf(s)[0];
                    const rowNext = p ? nextTargetKey(p.classId, p.subId) : "";
                    return (
                      <tr key={s.studentId} className={`${selected.has(s.studentId) ? "sel" : ""} ${needs ? "needs" : ""}`}>
                        <td>
                          <input type="checkbox" className="cv-student-check" checked={selected.has(s.studentId)} onChange={() => toggle(s.studentId)} aria-label={`Select ${s.fullName}`} />
                        </td>
                        <td className="cv-td-num">{i + 1}</td>
                        <td>
                          <div className="cv-person">
                            <Avatar s={s} />
                            <div>
                              <strong>{s.fullName}</strong>
                              {s.motherName && <span>{s.motherName}</span>}
                            </div>
                          </div>
                        </td>
                        <td><span className="id-chip">{s.studentId}</span></td>
                        <td>{s.shift || "—"}</td>
                        <td className="cv-td-phone">
                          {s.studentPhone || s.parentPhone ? <><Phone size={12} /> {s.studentPhone || s.parentPhone}</> : "—"}
                        </td>
                        <td>
                          <div className="tag-list">
                            {places.length === 0 && <span className="tag cv-tag-warn">{s.className || "No class"}</span>}
                            {places.map((pl) => (
                              <span key={pl.text} className={`tag ${pl.warn ? "cv-tag-warn" : ""}`}>{pl.text}</span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div className="cv-row-actions">
                            {rowNext && !needs && (
                              <button type="button" className="cv-next-btn" title={`Promote → ${TARGET_BY_KEY[rowNext].label}`} onClick={() => transfer(rowNext, [s], "promote")}>
                                <ArrowUpCircle size={14} /> Next
                              </button>
                            )}
                            <MoveSelect value="" placeholder={needs ? "Place in…" : "Move…"} onChange={(key) => key && transfer(key, [s])} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="cv-students">
              {list.map((s) => {
                const places = placementText(s);
                const needs = isUnassigned || subId === NEEDS || (active?.subs && studentNeedsSub(s, active.id));
                return (
                  <div key={s.studentId} className={`cv-student ${selected.has(s.studentId) ? "sel" : ""} ${needs ? "needs" : ""}`}>
                    <input type="checkbox" className="cv-student-check" checked={selected.has(s.studentId)} onChange={() => toggle(s.studentId)} aria-label={`Select ${s.fullName}`} />
                    <Avatar s={s} size="avatar-lg" />
                    <div className="cv-student-body">
                      <strong>{s.fullName}</strong>
                      <span>ID {s.studentId} • {s.shift || "—"}</span>
                      <div className="tag-list">
                        {places.map((pl) => (
                          <span key={pl.text} className={`tag ${pl.warn ? "cv-tag-warn" : ""}`}>{pl.text}</span>
                        ))}
                      </div>
                    </div>
                    <MoveSelect value="" placeholder={needs ? "Place in…" : "Move…"} onChange={(key) => key && transfer(key, [s])} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

// ==================================================================
// Overview pieces
// ==================================================================
function SectionTiles({ cls, level, data, onOpen }) {
  const subs = cls.subs.filter((s) => !level || s.levelId === level);
  return (
    <div className="cv-sections">
      {subs.map((s) => (
        <button
          key={s.id}
          type="button"
          className="cv-section"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(cls.id, s.id);
          }}
        >
          <span className="cv-section-letter">{s.section}</span>
          <span className="cv-section-label">Class {s.section}</span>
          <strong>{data.bySub[`${cls.id}:${s.id}`].length}</strong>
        </button>
      ))}
    </div>
  );
}

function ClassCard({ c, n, data, onOpen, wide, children }) {
  const needCount = data.needs[c.id].length;
  return (
    <div
      role="button"
      tabIndex={0}
      className={`cv-card tone-${c.color} ${wide ? "cv-card-wide" : ""}`}
      onClick={() => onOpen(c.id)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(c.id)}
    >
      <div className="cv-card-top">
        <span className="cv-num">{n}</span>
        <div className="cv-card-title">
          <strong>{c.name}</strong>
          <span>{c.so}</span>
        </div>
        <div className="cv-count">
          <strong>{data.byClass[c.id].length}</strong>
          <span>students</span>
        </div>
      </div>
      {children}
      <div className="cv-card-foot">
        {needCount > 0 ? (
          <span
            className="cv-warn"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(c.id, NEEDS);
            }}
          >
            <AlertTriangle size={12} /> {needCount} need placement
          </span>
        ) : (
          <span className="cv-subjects-mini">{(c.subjects || []).length ? `${c.subjects.length} subjects` : ""}</span>
        )}
        <span className="cv-open">Fur fasalka <ChevronRight size={14} /></span>
      </div>
    </div>
  );
}

// ==================================================================
// Main
// ==================================================================
export default function ClassesView({ students = [], teachers = [] }) {
  const [open, setOpen] = useState(null); // { classId, subId }
  const [transfer, setTransfer] = useState(null); // { request, after }
  const [note, setNote] = useState(null);
  const [autoNote, setAutoNote] = useState("");
  const fixedRef = useRef(new Set());

  const data = useMemo(() => {
    const byClass = {};
    const bySub = {};
    const needs = {};
    CLASSES.forEach((c) => {
      byClass[c.id] = students.filter((s) => studentInClass(s, c.id));
      (c.subs || []).forEach((sub) => {
        bySub[`${c.id}:${sub.id}`] = byClass[c.id].filter((s) => studentInSub(s, c.id, sub.id));
      });
      needs[c.id] = c.subs ? byClass[c.id].filter((s) => studentNeedsSub(s, c.id)) : [];
    });
    const unassigned = students.filter((s) => placementsOf(s).length === 0);
    const needsTotal = new Set(Object.values(needs).flat().map((s) => s.studentId)).size;
    return { byClass, bySub, needs, unassigned, needsTotal };
  }, [students]);

  // ---- Si toos ah: Elementary → Elementary A, Preparation → Preparation A ----
  useEffect(() => {
    const todo = students.filter((s) => !fixedRef.current.has(s.studentId) && placementsOf(s).some((p) => p.auto));
    if (!todo.length) return;
    todo.forEach((s) => fixedRef.current.add(s.studentId));
    Promise.all(
      todo.map((s) => {
        const p = placementsOf(s).find((x) => x.auto);
        const key = `${p.classId}:${p.subId}`;
        return writeMove(s, TARGET_BY_KEY[key], "auto");
      })
    )
      .then(() => setAutoNote(`${todo.length} arday si toos ah ayaa loo geeyay Elementary A / Preparation A.`))
      .catch((e) => setAutoNote(`Hagaajinta tooska ah way fashilantay: ${e.message}`));
  }, [students]);

  const english = CLASS_BY_ID.english;
  const prep = CLASS_BY_ID.preparation;
  const others = CLASSES.filter((c) => c.id !== "english" && c.id !== "preparation");
  const openClass = (classId, subId = "") => setOpen({ classId, subId });
  const warnCount = data.needsTotal + data.unassigned.length;

  return (
    <div className="cv stack">
      {/* ---------- hero ---------- */}
      <div className="cv-hero">
        <div className="cv-hero-text">
          <span className="cv-hero-kicker"><GraduationCap size={15} /> Rising Star School</span>
          <h2>Classes &amp; Students</h2>
          <p>Fasal kasta fur si aad u aragto ardayda oo dhan, una gudbiso fasalka xiga markay dhammeeyaan.</p>
        </div>
        <div className="cv-hero-stats">
          <div><strong>{students.length}</strong><span>Students</span></div>
          <div><strong>{CLASSES.length}</strong><span>Classes</span></div>
          <div><strong>{english.subs.length + prep.subs.length}</strong><span>Class A–D</span></div>
          <button
            type="button"
            className={warnCount ? "warn" : ""}
            onClick={() => {
              if (data.unassigned.length) openClass("unassigned");
              else {
                const c = CLASSES.find((x) => data.needs[x.id].length);
                if (c) openClass(c.id, NEEDS);
              }
            }}
          >
            <strong>{warnCount}</strong>
            <span>Need placement</span>
          </button>
        </div>
      </div>

      {autoNote && (
        <p className="banner banner-blue cv-note">
          <Sparkles size={16} /> {autoNote}
          <button type="button" onClick={() => setAutoNote("")} aria-label="Close"><X size={14} /></button>
        </p>
      )}
      {note && (
        <p className={`banner ${note.ok ? "banner-green" : "banner-red"} cv-note`}>
          {note.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {note.text}
          <button type="button" onClick={() => setNote(null)} aria-label="Close"><X size={14} /></button>
        </p>
      )}

      {/* ---------- Preparation A–D ---------- */}
      <ClassCard c={prep} n={1} data={data} onOpen={openClass} wide>
        <SectionTiles cls={prep} data={data} onOpen={openClass} />
      </ClassCard>

      {/* ---------- other classes ---------- */}
      <div className="cv-grid">
        {others.map((c) => (
          <ClassCard key={c.id} c={c} n={CLASSES.findIndex((x) => x.id === c.id) + 1} data={data} onOpen={openClass}>
            {c.subs ? (
              <div className="cv-subs">
                {c.subs.map((s) => (
                  <span
                    key={s.id}
                    className="cv-sub"
                    onClick={(e) => {
                      e.stopPropagation();
                      openClass(c.id, s.id);
                    }}
                  >
                    {s.name}<b>{data.bySub[`${c.id}:${s.id}`].length}</b>
                  </span>
                ))}
              </div>
            ) : (
              <div className="cv-subjects">
                {c.subjects.slice(0, 4).map((x) => <em key={x}>{x}</em>)}
                {c.subjects.length > 4 && <em>+{c.subjects.length - 4}</em>}
              </div>
            )}
          </ClassCard>
        ))}

        {data.unassigned.length > 0 && (
          <div
            role="button"
            tabIndex={0}
            className="cv-card tone-amber cv-card-unassigned"
            onClick={() => openClass("unassigned")}
            onKeyDown={(e) => e.key === "Enter" && openClass("unassigned")}
          >
            <div className="cv-card-top">
              <span className="cv-num">?</span>
              <div className="cv-card-title">
                <strong>No class yet</strong>
                <span>Arday aan fasal sax ah lahayn</span>
              </div>
              <div className="cv-count">
                <strong>{data.unassigned.length}</strong>
                <span>students</span>
              </div>
            </div>
            <div className="cv-card-foot">
              <span className="cv-warn"><ArrowRightLeft size={12} /> Fasal u wareeji</span>
              <span className="cv-open">Fur <ChevronRight size={14} /></span>
            </div>
          </div>
        )}
      </div>

      {/* ---------- English Department ---------- */}
      <div className="cv-english">
        <button type="button" className="cv-english-head" onClick={() => openClass("english")}>
          <span className="cv-num">{CLASSES.length}</span>
          <div className="cv-card-title">
            <strong>English Department</strong>
            <span>Qeybta Ingiriisiga · Elementary &amp; Intermediate · Class A–D</span>
          </div>
          {data.needs.english.length > 0 && (
            <span
              className="cv-warn"
              onClick={(e) => {
                e.stopPropagation();
                openClass("english", NEEDS);
              }}
            >
              <AlertTriangle size={12} /> {data.needs.english.length} need a section
            </span>
          )}
          <div className="cv-count">
            <strong>{data.byClass.english.length}</strong>
            <span>students</span>
          </div>
        </button>
        <div className="cv-levels">
          {ENGLISH_LEVELS.map((level) => (
            <div key={level.id} className={`cv-level tone-${level.color}`}>
              <div className="cv-level-name">
                <i />
                {level.name}
                <small>
                  {english.subs.filter((s) => s.levelId === level.id).reduce((n, s) => n + data.bySub[`english:${s.id}`].length, 0)} students
                </small>
              </div>
              <SectionTiles cls={english} level={level.id} data={data} onOpen={openClass} />
            </div>
          ))}
        </div>
      </div>

      {open && (
        <ClassDrawer
          key={`${open.classId}:${open.subId}`}
          classId={open.classId}
          initialSub={open.subId}
          data={data}
          teachers={teachers}
          onClose={() => setOpen(null)}
          onTransfer={(request, after) => setTransfer({ request, after })}
        />
      )}

      {transfer && (
        <TransferModal
          request={transfer.request}
          onClose={() => setTransfer(null)}
          onDone={(r) => {
            transfer.after?.();
            setTransfer(null);
            setNote({
              ok: true,
              text:
                (r.names || `${r.moved} arday`) +
                (r.type === "promote" ? " waxaa loo gudbiyay " : " waxaa loo wareejiyay ") +
                `${r.target}.` +
                (r.stayed ? ` ${r.stayed} ayaa fasalka ku hadhay.` : "") +
                " Teacher-ka fasalka cusub ayaa hadda arka.",
            });
          }}
        />
      )}
    </div>
  );
}