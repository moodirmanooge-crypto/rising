// src/components/ClassesView.jsx
//
// Admin → Classes
// ------------------------------------------------------------------
// • 5-ta fasal ee warqadda: Fasalka 8aad, Fasalada Diyaarinta (B·T·J),
//   Fasalo Xisaab iyo English (B·T·J), Computer Class, English Classes
//   (A–E, mid kastana Elementary · Intermediate · Advance · Classic).
// • Fasal kasta waa la FURAA (drawer) si loo arko ardayda oo dhan.
// • Wareejinta / Promote: marka hore waa la weydiinayaa "Ma la
//   wareejinayaa?". Haa → liiska ardayda ayaa soo baxa, magaca ardayga
//   fasalka KU HADHAYA ayaa la raadin karaa oo laga saari karaa.
// • "Fasallada hore → Fasallada warqadda" (ClassMigration): hal riix oo
//   ardayda iyo macallimiinta oo dhan geeya fasallada cusub.
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
  ArrowLeft,
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
  ENGLISH_SECTIONS,
  groupLabel,
  genderOf,
  placementsOf,
  enrollmentsOf,
  enrollmentFields,
  makeEnrollment,
  studentInClass,
  studentInSub,
  studentNeedsSub,
  teacherGroups,
} from "../config/schoolOptions";
import { initials } from "./PortalLayout";
import ClassMigration from "./ClassMigration";

const NEEDS = "_needs";

// ------------------------------------------------------------------
// Move targets
// ------------------------------------------------------------------
const MOVE_TARGETS = CLASSES.flatMap((c) => {
  if (!c.subs) return [{ key: c.id, group: "Fasallada", label: c.name, classId: c.id, subIds: [] }];
  if (c.id === "english") {
    return c.subs.map((s) => ({ key: `english:${s.id}`, group: `English ${s.section}`, label: s.name, classId: c.id, subIds: [s.id] }));
  }
  return c.subs.map((s) => ({ key: `${c.id}:${s.id}`, group: c.name, label: groupLabel(c, s), classId: c.id, subIds: [s.id] }));
});
const TARGET_BY_KEY = Object.fromEntries(MOVE_TARGETS.map((t) => [t.key, t]));
const TARGET_GROUPS = [...new Set(MOVE_TARGETS.map((t) => t.group))];

// Fasalka xiga (Promote).
//  English: Elementary → Intermediate → Advance → Classic (isla English A–E)
//  (fasallada kale "Move" ayaa lagu wareejiyaa — fasal kasta waa la dooran karaa)
function nextTargetKey(classId, subId) {
  if (classId === "english" && subId) {
    const sub = CLASS_BY_ID.english.subs.find((x) => x.id === subId);
    const i = ENGLISH_LEVELS.findIndex((l) => l.id === sub?.levelId);
    const next = i >= 0 ? ENGLISH_LEVELS[i + 1] : null;
    return next ? `english:english-${next.id}-${sub.section.toLowerCase()}` : "";
  }
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

function subjectsKeep(mine, target) {
  const cls = CLASS_BY_ID[target.classId];
  const allowed = target.subIds.length
    ? cls.subs.filter((s) => target.subIds.includes(s.id)).flatMap((s) => s.subjects || [])
    : cls.subjects || [];
  const keep = (mine || []).filter((x) => allowed.includes(x));
  return keep.length ? keep : [...new Set(allowed)];
}

// Wareejin: fasalka laga wareejinayo (fromClassId) oo keliya ayaa la beddelaa —
// fasallada kale ee ardaygu ku jiro (tusaale English + Class 8) way sii jiraan.
async function writeMove(student, target, type, fromClassId = "") {
  const list = enrollmentsOf(student);
  let idx = fromClassId ? list.findIndex((e) => e.classId === fromClassId) : -1;
  if (idx < 0 && list.length === 1) idx = 0;
  const from = idx >= 0 ? list[idx] : null;

  const moved = makeEnrollment(target.classId, target.subIds, subjectsKeep(from ? from.subjects : student.subjects, target));
  // Haddii ardaygu horey ugu jiray fasalka cusub, laba jeer laguma darayo
  const next = list.filter((e, i) => i !== idx && !e.groups.some((g) => moved.groups.includes(g)));
  if (idx >= 0) next.splice(Math.min(idx, next.length), 0, moved); // isla booskiisa
  else next.push(moved);

  const fields = enrollmentFields(next);
  const fromText = from ? from.groups.join(", ") : currentLabel(student);
  await updateDoc(doc(db, STUDENTS_COLLECTION, student.docId || String(student.studentId)), {
    ...fields,
    updatedAt: serverTimestamp(),
    classHistory: arrayUnion({ from: fromText, to: target.label, type, at: new Date().toISOString() }),
  });
}

function Avatar({ s, size = "" }) {
  return s.photoUrl ? (
    <img src={s.photoUrl} alt={s.fullName} className={`avatar ${size}`} />
  ) : (
    <span className={`avatar avatar-placeholder ${size}`}>{initials(s.fullName)}</span>
  );
}

function MoveSelect({ value, onChange, placeholder = "U wareeji…", disabled }) {
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
// Transfer wizard — 1) fasalka laga wareejinayo  2) fasalka loo wareejinayo
//                   3) "Arday ma ku hadhayaa?"  4) dooro kuwa ku hadhaya
//  • "← Dib u noqo" ama Backspace → daaqadda hore;  Esc → xir
// ==================================================================
function buildSources(data) {
  const out = [];
  CLASSES.forEach((c) => {
    if (c.subs) {
      c.subs.forEach((sub) => {
        const key = `${c.id}:${sub.id}`;
        out.push({
          key,
          moveKey: c.id === "english" ? `english:${sub.id}` : key,
          group: c.name,
          label: groupLabel(c, sub),
          short: c.id === "english" ? `${sub.section} – ${sub.level}` : sub.name,
          classId: c.id,
          color: sub.color || c.color,
          students: data.bySub[key] || [],
        });
      });
      if (data.needs[c.id]?.length) {
        out.push({
          key: `needs:${c.id}`,
          group: c.name,
          label: `${c.name} — Class lama yaqaan`,
          short: "Need placement",
          classId: c.id,
          color: "amber",
          warn: true,
          students: data.needs[c.id],
        });
      }
    } else {
      out.push({ key: c.id, moveKey: c.id, group: c.name, label: c.name, short: c.name, classId: c.id, color: c.color, students: data.byClass[c.id] || [] });
    }
  });
  if (data.unassigned.length) {
    out.push({ key: "unassigned", group: "Fasal la'aan", label: "No class yet", short: "No class yet", classId: "", color: "amber", warn: true, students: data.unassigned });
  }
  return out;
}

function ClassTiles({ items, selectedKey, disabledKey, onPick, showCount = true }) {
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <div className="tw-groups">
      {groups.map((g) => (
        <div key={g} className="tw-group">
          <span className="tw-group-name">{g}</span>
          <div className="tw-tiles">
            {items
              .filter((i) => i.group === g)
              .map((i) => {
                const off = !!disabledKey && (i.key === disabledKey || i.moveKey === disabledKey);
                return (
                  <button
                    key={i.key}
                    type="button"
                    disabled={off}
                    className={`tw-tile tone-${i.color} ${selectedKey === i.key ? "on" : ""} ${i.warn ? "warn" : ""}`}
                    onClick={() => onPick(i)}
                  >
                    <strong>{i.short}</strong>
                    {showCount && <span>{i.students.length} arday</span>}
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TransferWizard({ data, init, onClose, onDone }) {
  const sources = useMemo(() => buildSources(data), [data]);
  const targets = useMemo(
    () =>
      MOVE_TARGETS.map((t) => {
        const cls = CLASS_BY_ID[t.classId];
        const sub = cls?.subs?.find((x) => x.id === t.subIds[0]);
        return {
          key: t.key,
          moveKey: t.key,
          group: cls.name,
          label: t.label,
          short: cls.id === "english" ? `${sub.section} – ${sub.level}` : sub ? sub.name : cls.name,
          color: sub?.color || cls.color,
          students: sub ? data.bySub[`${cls.id}:${sub.id}`] || [] : data.byClass[cls.id] || [],
        };
      }),
    [data]
  );

  const single = init?.people?.length === 1 ? init.people : null;
  const [fromKey, setFromKey] = useState(init?.fromKey || "");
  const [toKey, setToKey] = useState(init?.toKey || "");
  const firstStep = single ? (init?.toKey ? "confirm" : "to") : init?.fromKey ? (init?.toKey ? "ask" : "to") : "from";
  const [history, setHistory] = useState([firstStep]);
  const step = history[history.length - 1];
  const [stay, setStay] = useState(() => new Set());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const from = sources.find((x) => x.key === fromKey) || null;
  const target = TARGET_BY_KEY[toKey] || null;
  const people = single || from?.students || [];
  const moving = people.filter((p) => !stay.has(p.studentId));
  const fromLabel = single ? init.fromLabel || "fasalkiisa" : from?.label || "";
  const fromClassId = single ? init.fromClassId || "" : from?.classId || "";

  function go(next) {
    setErr("");
    setHistory((h) => [...h, next]);
  }
  function back() {
    if (busy) return;
    setErr("");
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  }

  // Backspace → dib u noqo (marka aan qoraal la qorayn);  Esc → xir
  useEffect(() => {
    function onKey(e) {
      const tag = String(e.target?.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable;
      if (e.key === "Escape" && !busy) onClose();
      else if (e.key === "Backspace" && !typing) {
        e.preventDefault();
        if (history.length > 1) back();
        else if (!busy) onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleStay(id) {
    setStay((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirm(list) {
    if (!list.length || !target) return;
    setBusy(true);
    setErr("");
    try {
      await Promise.all(list.map((s) => writeMove(s, target, init?.type || "move", fromClassId)));
      onDone({
        moved: list.length,
        stayed: people.length - list.length,
        target: target.label,
        from: fromLabel,
        type: init?.type || "move",
        names: list.length === 1 ? list[0].fullName : "",
      });
    } catch (e) {
      setErr(e.message || "Wareejintu way fashilantay.");
      setBusy(false);
    }
  }

  const query = q.trim().toLowerCase();
  const shown = query
    ? people.filter((p) => String(p.fullName || "").toLowerCase().includes(query) || String(p.studentId).includes(query))
    : people;
  const stepNo = { from: 1, to: 2, ask: 3, pick: 4, confirm: 2 }[step] || 1;
  const totalSteps = single ? 2 : 4;

  return (
    <div className="cv-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="cv-modal tw-modal" role="dialog" aria-modal="true" aria-label="U wareeji ardayda">
        <div className="tw-top">
          {history.length > 1 ? (
            <button type="button" className="tw-back" onClick={back} disabled={busy} title="Dib u noqo (Backspace)">
              <ArrowLeft size={16} /> Dib u noqo
            </button>
          ) : (
            <span className="tw-kicker"><ArrowRightLeft size={15} /> U wareeji ardayda</span>
          )}
          <span className="tw-steps">
            {Array.from({ length: totalSteps }, (_, i) => (
              <i key={i} className={i < stepNo ? "on" : ""} />
            ))}
          </span>
          <button type="button" className="cv-modal-x tw-x" onClick={onClose} disabled={busy} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {(from || single) && step !== "from" && (
          <div className="cv-modal-route">
            <span className="cv-route-chip from">{single ? single[0].fullName : fromLabel}</span>
            <ChevronRight size={18} />
            <span className={`cv-route-chip to ${target ? "" : "empty"}`}>{target ? target.label : "?"}</span>
          </div>
        )}

        {step === "from" && (
          <>
            <h3>1. Fasalka ardayda laga wareejinayo</h3>
            <p className="cv-modal-text">Dooro fasalka ay hadda ku jiraan ardayda la wareejinayo.</p>
            <ClassTiles
              items={sources.filter((x) => x.students.length)}
              selectedKey={fromKey}
              onPick={(i) => {
                setFromKey(i.key);
                setStay(new Set());
                if (toKey && (toKey === i.moveKey)) setToKey("");
                go("to");
              }}
            />
            {!sources.some((x) => x.students.length) && <p className="muted-sm">Arday ma jiraan.</p>}
          </>
        )}

        {step === "to" && (
          <>
            <h3>2. Fasalka loo wareejinayo</h3>
            <p className="cv-modal-text">
              {single ? <b>{single[0].fullName}</b> : <><b>{people.length}</b> arday oo ku jira <b>{fromLabel}</b></>} — xagee loo
              wareejinayaa?
            </p>
            <ClassTiles
              items={targets}
              selectedKey={toKey}
              disabledKey={from?.moveKey}
              showCount={false}
              onPick={(i) => {
                setToKey(i.key);
                go(single ? "confirm" : "ask");
              }}
            />
          </>
        )}

        {step === "ask" && target && (
          <>
            <div className="cv-modal-icon"><Users size={28} /></div>
            <h3>3. Arday ma ku hadhayaa {fromLabel}?</h3>
            <p className="cv-modal-text">
              <b>{people.length}</b> arday ayaa {init?.type === "promote" ? "loo gudbinayaa" : "loo wareejinayaa"}{" "}
              <b>{target.label}</b>. Haddii qaar fasalka ku hadhayaan, riix <b>Haa</b> oo dooro iyaga.
            </p>
            {err && <p className="error">{err}</p>}
            <div className="tw-answers">
              <button type="button" className="tw-answer" disabled={busy} onClick={() => go("pick")}>
                <UserMinus size={20} />
                <strong>Haa</strong>
                <span>Qaar ayaa ku hadhaya — aan doorto</span>
              </button>
              <button type="button" className="tw-answer primary" disabled={busy} onClick={() => confirm(people)}>
                <UserCheck size={20} />
                <strong>{busy ? "Wareejinaya…" : "Maya"}</strong>
                <span>Dhammaan {people.length} u wareeji</span>
              </button>
            </div>
          </>
        )}

        {step === "pick" && target && (
          <>
            <h3>4. Dooro ardayda ku hadhaya {fromLabel}</h3>
            <p className="cv-modal-text">
              Arday kasta oo aad doorato <b>wuu ku hadhayaa</b> {fromLabel}. Inta kale waxay u guurayaan <b>{target.label}</b>.
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
                  <label key={s.studentId} className={`cv-pick tw-pick ${stays ? "stays" : ""}`}>
                    <input type="checkbox" checked={stays} onChange={() => toggleStay(s.studentId)} />
                    <Avatar s={s} />
                    <div className="cv-pick-body">
                      <strong>{s.fullName}</strong>
                      <span>ID {s.studentId} • {stays ? `Wuxuu ku hadhayaa ${fromLabel}` : `→ ${target.label}`}</span>
                    </div>
                    <em className={`tw-pick-tag ${stays ? "stay" : "go"}`}>{stays ? "Ku hadhaya" : "Wuu guurayaa"}</em>
                  </label>
                );
              })}
              {shown.length === 0 && <p className="muted-sm" style={{ padding: 12 }}>Arday lama helin.</p>}
            </div>

            {err && <p className="error">{err}</p>}
            <div className="cv-modal-actions">
              <button type="button" className="btn btn-light" onClick={back} disabled={busy}>
                <ArrowLeft size={15} /> Dib u noqo
              </button>
              <button type="button" className="btn btn-primary" disabled={busy || !moving.length} onClick={() => confirm(moving)}>
                <ArrowRightLeft size={15} /> {busy ? "Wareejinaya…" : `Wareeji ${moving.length} arday`}
              </button>
            </div>
          </>
        )}

        {step === "confirm" && target && single && (
          <>
            <div className="cv-modal-icon"><ArrowRightLeft size={26} /></div>
            <h3>Ma loo wareejinayaa {single[0].fullName}?</h3>
            <p className="cv-modal-text">
              Wuxuu ka bixi doonaa <b>{fromLabel}</b>, wuxuuna geli doonaa <b>{target.label}</b>. Macallinka fasalka cusub
              ayaa xaadirin doona.
            </p>
            {err && <p className="error">{err}</p>}
            <div className="cv-modal-actions">
              <button type="button" className="btn btn-light" onClick={back} disabled={busy}>
                <ArrowLeft size={15} /> Dib u noqo
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => confirm(single)}>
                {busy ? "Wareejinaya…" : "Haa, wareeji"}
              </button>
            </div>
          </>
        )}

        <p className="tw-hint">Backspace = dib u noqo · Esc = xir</p>
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
          : ""
        : nextTargetKey(active.id, "")
      : "";
  const nextTarget = nextKey ? TARGET_BY_KEY[nextKey] || null : null;
  // Wizard-ka: fasalka hadda furan ayaa ah "laga wareejinayo"
  const fromKey = isUnassigned
    ? "unassigned"
    : subId === NEEDS
    ? `needs:${classId}`
    : activeSub
    ? `${classId}:${activeSub.id}`
    : active && !active.subs
    ? classId
    : "";

  function pickSub(id) {
    setSubId(id);
  }
  // people = [ardayga] → hal arday;  la'aan → fasalka oo dhan (wizard)
  function transfer(toKey, people, type = "move") {
    if (people && people.length === 1) {
      const p = placementsOf(people[0]).find((x) => x.classId === classId) || placementsOf(people[0])[0];
      onTransfer({
        toKey,
        people,
        type,
        fromLabel: p ? placeLabel(p.classId, p.subId) : currentLabel(people[0]),
        fromClassId: p?.classId || (CLASS_BY_ID[classId] ? classId : ""),
      });
    } else {
      onTransfer({ fromKey, toKey, type });
    }
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
            <div><strong>{list.filter((x) => genderOf(x) === "Male").length}</strong><span>Wiil</span></div>
            <div><strong>{list.filter((x) => genderOf(x) === "Female").length}</strong><span>Gabar</span></div>
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
                  {active.id === "english" ? `${s.section} · ${s.level}` : s.name}
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
                  {" "}Waxaa lagu weydiin doonaa kuwa ku hadhaya.
                </span>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => transfer(nextKey, null, "promote")}
              >
                <ArrowUpCircle size={15} />
                Promote {list.length}
              </button>
            </div>
          )}

          <div className="cv-bulk">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!list.length}
              onClick={() => transfer("", null)}
              title="Dooro fasalka loo wareejinayo, kadib kuwa ku hadhaya"
            >
              <ArrowRightLeft size={15} /> U wareeji ardayda fasalkan
            </button>
            <div className="search-box cv-drawer-search">
              <Search size={16} />
              <input placeholder="Search student" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="cv-bulk-actions">
              <div className="cv-view-toggle" role="group" aria-label="View">
                <button type="button" className={view === "list" ? "on" : ""} onClick={() => setView("list")} title="List"><List size={15} /></button>
                <button type="button" className={view === "cards" ? "on" : ""} onClick={() => setView("cards")} title="Cards"><LayoutGrid size={15} /></button>
              </div>
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
                    const rowNext = p && TARGET_BY_KEY[nextTargetKey(p.classId, p.subId)] ? nextTargetKey(p.classId, p.subId) : "";
                    return (
                      <tr key={s.studentId} className={needs ? "needs" : ""}>
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
                            <MoveSelect value="" placeholder={needs ? "Geli fasal…" : "U wareeji…"} onChange={(key) => key && transfer(key, [s])} />
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
                  <div key={s.studentId} className={`cv-student ${needs ? "needs" : ""}`}>
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
                    <MoveSelect value="" placeholder={needs ? "Geli fasal…" : "U wareeji…"} onChange={(key) => key && transfer(key, [s])} />
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
function SectionTiles({ cls, section, data, onOpen }) {
  const english = cls.id === "english";
  const subs = cls.subs.filter((s) => !section || s.section === section);
  return (
    <div className={`cv-sections ${english ? "cv-sections-levels" : ""}`}>
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
          <span className={`cv-section-letter ${english ? `lvl-${s.levelId}` : ""}`}>
            {english ? s.level.slice(0, 1) : s.section}
          </span>
          <span className="cv-section-label">{english ? s.level : s.time || s.section}</span>
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
export default function ClassesView({ students = [], teachers = [], rawTeachers }) {
  const [open, setOpen] = useState(null); // { classId, subId }
  const [transfer, setTransfer] = useState(null); // wizard init { fromKey, toKey, people, type }
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

  const english = CLASS_BY_ID.english;
  const sectioned = CLASSES.filter((c) => c.subs && c.id !== "english");
  const plain = CLASSES.filter((c) => !c.subs);
  const subCount = CLASSES.reduce((n, c) => n + (c.subs ? c.subs.length : 1), 0);
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
          <div><strong>{subCount}</strong><span>Groups</span></div>
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

      <ClassMigration students={students} teachers={rawTeachers || teachers} />

      <div className="tw-cta">
        <div>
          <strong>U wareeji ardayda fasal kale</strong>
          <span>1) Fasalka hadda · 2) Fasalka cusub · 3) Kuwa ku hadhaya — tusaale English A – Elementary → English A – Intermediate</span>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setTransfer({})}>
          <ArrowRightLeft size={16} /> U wareeji ardayda
        </button>
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

      {/* ---------- Class 8 + Computer ---------- */}
      <div className="cv-grid">
        {plain.map((c) => (
          <ClassCard key={c.id} c={c} n={CLASSES.findIndex((x) => x.id === c.id) + 1} data={data} onOpen={openClass}>
            <div className="cv-subjects">
              {c.subjects.slice(0, 4).map((x) => <em key={x}>{x}</em>)}
              {c.subjects.length > 4 && <em>+{c.subjects.length - 4}</em>}
            </div>
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
                <span>Arday aan fasal sax ah lahayn (fasallo hore oo la tirtiray)</span>
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

      {/* ---------- Preparation + Xisaab iyo English (B · T · J) ---------- */}
      <div className="cv-grid">
        {sectioned.map((c) => (
          <ClassCard key={c.id} c={c} n={CLASSES.findIndex((x) => x.id === c.id) + 1} data={data} onOpen={openClass}>
            <SectionTiles cls={c} data={data} onOpen={openClass} />
          </ClassCard>
        ))}
      </div>

      {/* ---------- English Classes: Class A–E × 4 level ---------- */}
      <div className="cv-english">
        <button type="button" className="cv-english-head" onClick={() => openClass("english")}>
          <span className="cv-num">{CLASSES.findIndex((x) => x.id === "english") + 1}</span>
          <div className="cv-card-title">
            <strong>{english.name}</strong>
            <span>{english.so} · A · B · C · D · E · {ENGLISH_LEVELS.map((l) => l.name).join(" · ")}</span>
          </div>
          {data.needs.english.length > 0 && (
            <span
              className="cv-warn"
              onClick={(e) => {
                e.stopPropagation();
                openClass("english", NEEDS);
              }}
            >
              <AlertTriangle size={12} /> {data.needs.english.length} need a class
            </span>
          )}
          <div className="cv-count">
            <strong>{data.byClass.english.length}</strong>
            <span>students</span>
          </div>
        </button>
        <div className="cv-levels">
          {ENGLISH_SECTIONS.map((section) => (
            <div key={section} className="cv-level tone-slate">
              <div className="cv-level-name">
                <i />
                English {section}
                <small>
                  {english.subs.filter((s) => s.section === section).reduce((n, s) => n + data.bySub[`english:${s.id}`].length, 0)} students
                </small>
              </div>
              <SectionTiles cls={english} section={section} data={data} onOpen={openClass} />
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
          onTransfer={(init) => setTransfer(init)}
        />
      )}

      {transfer && (
        <TransferWizard
          data={data}
          init={transfer}
          onClose={() => setTransfer(null)}
          onDone={(r) => {
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