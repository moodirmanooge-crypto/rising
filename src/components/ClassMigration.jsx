// src/components/ClassMigration.jsx
//
// Admin → Classes → "Fasallada hore → Fasallada cusub"
// ------------------------------------------------------------------
// Hal riix: arday kasta iyo macallin kasta waxaa la geeyaa fasallada
// warqadda (Fasalka 8aad, Fasalada Diyaarinta B·T·J, Fasalo Xisaab iyo
// English B·T·J, Computer Class, English A–E). Magacyadii hore oo dhan
// waa la tirtiraa.
//   • Preparation hore → Fasalada Diyaarinta (shift: Morning→B, Afternoon→T, Evening→J)
//   • Open Classes → Fasalo Xisaab iyo English (shift)
//   • English aan A–E lahayn → English A (level-kiisa)
//   • Class 8 / Health / kuwo kale → admin-ka ayaa dooranaya fasalka cusub
//   • Macallimiinta: fasalka hore → magaca cusub; fasal la tirtiray → waa laga saaraa
//   • Exams: classGroup-ka hore → magaca cusub
// ------------------------------------------------------------------

import { useMemo, useState } from "react";
import {
  arrayUnion, collection, deleteDoc, deleteField, doc, getDocs, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, Sparkles, AlertTriangle } from "lucide-react";
import { db } from "../firebase";
import {
  STUDENTS_COLLECTION, TEACHERS_COLLECTION, EXAMS_COLLECTION, SCHOOL_CLASSES_COLLECTION,
} from "../config/collections";
import {
  CLASS_OPTION_GROUPS, CLASS_GROUPS, migrateStudent, migrateClassName, resolveGroupLabel, subjectsFor,
} from "../config/schoolOptions";
import { teacherAssignments } from "../utils/teacherClasses";
import { blocksFromTeacher, buildTeacherSchedule } from "../utils/schoolForms";

function oldText(s) {
  const g = Array.isArray(s.classGroups) && s.classGroups.length ? s.classGroups : [s.className || s.class || "—"];
  return g.filter(Boolean).join(", ");
}

// Macallinka: block kasta → magaca cusub; fasal la tirtiray ama maado aan fasalka ku jirin → laga saaro
function planTeacher(t) {
  const assignments = teacherAssignments(t);
  if (!assignments.length) return null;
  const blocks = blocksFromTeacher(t, assignments).filter((b) => b.className);
  if (!blocks.length) return null;
  const dropped = [];
  let renamed = 0;
  const next = [];
  blocks.forEach((b) => {
    const name = migrateClassName(b.className, b.shift);
    const r = name ? resolveGroupLabel(name) : null;
    const allowed = r ? subjectsFor(r.classId, r.subId) : [];
    if (!name || (b.subject && !allowed.includes(b.subject))) {
      dropped.push(`${b.className}${b.subject ? ` · ${b.subject}` : ""}`);
      return;
    }
    if (name !== b.className) renamed += 1;
    next.push({ ...b, className: name });
  });
  if (!renamed && !dropped.length) return null;
  return { teacher: t, blocks: next, renamed, dropped };
}

export default function ClassMigration({ students = [], teachers = [] }) {
  const [overrides, setOverrides] = useState({}); // { studentId: { oldLabel: optionId | "" } }
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const plans = useMemo(
    () =>
      students
        .map((s) => ({ s, plan: migrateStudent(s, overrides[s.studentId] || {}) }))
        .filter((x) => x.plan.changed || x.plan.unresolved.length),
    [students, overrides]
  );
  const teacherPlans = useMemo(() => teachers.map(planTeacher).filter(Boolean), [teachers]);

  // Ardayda fasal la'aan noqonaya (wax la doorto ma jiro)
  const needChoice = plans.filter((x) => x.plan.unresolved.length > 0);
  const empty = plans.filter((x) => !x.plan.unresolved.length && !x.plan.enrollments.length);
  const blocked = needChoice.length + empty.length;
  const total = plans.length + teacherPlans.length;

  if (!total && !result) return null;

  function choose(studentId, label, optionId) {
    setOverrides((o) => ({ ...o, [studentId]: { ...(o[studentId] || {}), [label]: optionId } }));
  }

  async function run() {
    setError("");
    if (blocked) {
      setOpen(true);
      return setError(`${blocked} arday fasal cusub looma dooran. Hoos ka dooro fasalkooda, kadib mar kale riix.`);
    }
    if (!window.confirm(`${plans.length} arday iyo ${teacherPlans.length} macallin ayaa loo wareejinayaa fasallada cusub. Magacyadii hore waa la tirtirayaa. Ma sii wadaa?`)) return;

    setRunning(true);
    try {
      const at = new Date().toISOString();
      const writes = [];
      plans.forEach(({ s, plan }) => {
        writes.push((b) =>
          b.update(doc(db, STUDENTS_COLLECTION, s.docId || String(s.studentId)), {
            ...plan.fields,
            class: deleteField(),
            studentClass: deleteField(),
            classHistory: arrayUnion({ from: oldText(s), to: plan.fields.classGroups.join(", "), type: "migration", at }),
            migratedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      });
      teacherPlans.forEach(({ teacher, blocks }) => {
        writes.push((b) =>
          b.update(doc(db, TEACHERS_COLLECTION, teacher.docId || teacher.username || teacher.teacherId), {
            ...buildTeacherSchedule(blocks),
            migratedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      });

      // Exams: classGroup hore → magaca cusub
      let examCount = 0;
      try {
        const ex = await getDocs(collection(db, EXAMS_COLLECTION));
        ex.docs.forEach((d) => {
          const cg = d.data().classGroup;
          const name = cg && !CLASS_GROUPS.includes(cg) ? migrateClassName(cg) : null;
          if (name && name !== cg) {
            examCount += 1;
            writes.push((b) => b.update(d.ref, { classGroup: name, classGroupOld: cg }));
          }
        });
      } catch {
        /* exams ma jiraan / rules */
      }

      for (let i = 0; i < writes.length; i += 400) {
        const batch = writeBatch(db);
        writes.slice(i, i + 400).forEach((w) => w(batch));
        await batch.commit();
      }

      // Liiskii fasallada hore (rssSchoolClasses) — hadda lama isticmaalo → tirtir
      let oldDocs = 0;
      try {
        const old = await getDocs(collection(db, SCHOOL_CLASSES_COLLECTION));
        await Promise.all(old.docs.map((d) => deleteDoc(d.ref)));
        oldDocs = old.size;
      } catch {
        /* ma jiro */
      }

      setResult({ students: plans.length, teachers: teacherPlans.length, exams: examCount, oldDocs });
      setOverrides({});
      setOpen(false);
    } catch (err) {
      setError(err.message || "Wareejintu way fashilantay.");
    } finally {
      setRunning(false);
    }
  }

  if (!total && result) {
    return (
      <div className="mig mig-done">
        <CheckCircle2 size={22} />
        <div>
          <strong>Dhammaan waa la wareejiyay</strong>
          <span>
            {result.students} arday · {result.teachers} macallin · {result.exams} exam ayaa hadda ku jira fasallada
            warqadda. Fasalladii hore waa la tirtiray.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mig">
      <div className="mig-head">
        <span className="mig-icon"><Sparkles size={20} /></span>
        <div className="mig-text">
          <strong>Fasallada hore → Fasallada warqadda</strong>
          <span>
            <b>{plans.length}</b> arday iyo <b>{teacherPlans.length}</b> macallin ayaa weli ku jira magacyada / fasallada
            hore. Riix si dhammaantood loogu geeyo fasallada cusub, wixii hore-na loo tirtiro.
          </span>
        </div>
        <div className="mig-actions">
          <button type="button" className="btn btn-light btn-sm" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {open ? "Qari" : "Eeg"}
          </button>
          <button type="button" className="btn btn-primary" onClick={run} disabled={running}>
            <RefreshCw size={16} className={running ? "spin" : ""} /> {running ? "Wareejinaya..." : "Wareeji dhammaan"}
          </button>
        </div>
      </div>

      {blocked > 0 && (
        <p className="mig-warn">
          <AlertTriangle size={15} /> {blocked} arday (Class 8, Health ama fasal kale oo la tirtiray) — dooro fasalkooda cusub.
          <button type="button" onClick={() => setOpen(true)}>Dooro</button>
        </p>
      )}
      {error && <p className="error" style={{ margin: "10px 0 0" }}>{error}</p>}

      {open && (
        <div className="mig-body">
          <div className="mig-rules">
            <span>Preparation → <b>Fasalada Diyaarinta</b></span>
            <span>Open Classes → <b>Fasalo Xisaab iyo English</b></span>
            <span>Morning → <b>B Duhurley</b> · Afternoon → <b>T Galabley</b> · Evening → <b>J Habeenley</b></span>
            <span>English (Class la&apos;aan) → <b>English A</b></span>
          </div>

          <div className="mig-list">
            {[...needChoice, ...empty, ...plans.filter((x) => !x.plan.unresolved.length && x.plan.enrollments.length)].map(({ s, plan }) => (
              <div key={s.studentId} className={`mig-row ${plan.unresolved.length || !plan.enrollments.length ? "need" : ""}`}>
                <div className="mig-who">
                  <strong>{s.fullName}</strong>
                  <span>ID {s.studentId}{s.shift ? ` · ${s.shift}` : ""}</span>
                </div>
                <div className="mig-from">{oldText(s)}</div>
                <ArrowRight size={16} className="mig-arrow" />
                <div className="mig-to">
                  {plan.enrollments.map((e) => (
                    <span key={e.groups[0]} className="mig-chip">{e.groups[0]}</span>
                  ))}
                  {plan.unresolved.map((label) => (
                    <select
                      key={label}
                      className="mig-select"
                      value={overrides[s.studentId]?.[label] ?? "_"}
                      onChange={(e) => choose(s.studentId, label, e.target.value)}
                    >
                      <option value="_" disabled>{label} → dooro fasal</option>
                      <option value="">Ka saar fasalkan</option>
                      {CLASS_OPTION_GROUPS.map((g) => (
                        <optgroup key={g.key} label={g.label}>
                          {g.list.map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  ))}
                  {!plan.unresolved.length && !plan.enrollments.length && (
                    <span className="mig-chip warn">Fasal ma laha — Edit ka dooro</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {teacherPlans.length > 0 && (
            <div className="mig-teachers">
              <h4>Macallimiinta</h4>
              {teacherPlans.map(({ teacher, blocks, dropped }) => (
                <div key={teacher.docId || teacher.username} className="mig-row">
                  <div className="mig-who">
                    <strong>{teacher.fullName || teacher.username}</strong>
                    <span>@{teacher.username || teacher.docId}</span>
                  </div>
                  <div className="mig-from">{teacherAssignments(teacher).map((a) => a.className).join(", ")}</div>
                  <ArrowRight size={16} className="mig-arrow" />
                  <div className="mig-to">
                    {[...new Set(blocks.map((b) => b.className))].map((c) => (
                      <span key={c} className="mig-chip">{c}</span>
                    ))}
                    {dropped.map((d) => (
                      <span key={d} className="mig-chip warn" title="Fasalkan la tirtiray — waa laga saarayaa">✕ {d}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}