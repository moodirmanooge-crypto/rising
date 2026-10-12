// src/components/ExamsManager.jsx
//
// Admin → Exams:
//  1) Samee exam: magaca, term, taariikhda, hal mar dooro CLASSES BADAN,
//     class kastana hal lambar: "inta lagu saxayo" (marked out of) — maado
//     kasta ee class-kaas waxaa lagu saxayaa lambarkaas.
//  2) Dooro exam-ka → ardayda fasalkaas oo dhan ayaa si toos ah u soo baxaya
//  3) Geli dhibcaha arday kasta → Save Results
//  4) Arday kasta natiijadiisa wuxuu ku arkayaa Student Portal-kiisa (live)
//  5) Macallimiintu waxay Teacher Portal-ka ka soo gudbiyaan maadadooda —
//     halkan ayaa lagu arkaa cidda gudbisay, natiijada fasalka oo isku
//     duuban, Download (Excel) iyo Print.

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList, Plus, Trash2, Save, ArrowLeft, Users, CalendarDays, BookOpen, Trophy, CheckCircle2,
  Download, Printer, Clock, Check, X,
} from "lucide-react";
import "../styles/exams.css";
import { CLASSES, SUBJECT_OPTIONS, groupLabel, resolveGroupLabel, studentBelongsToGroup, subjectsFor } from "../config/schoolOptions";
import {
  computeResult, createExam, deleteExam, gradeTone,
  saveExamResults, subscribeExamResults, subscribeExams,
} from "../utils/exams";
import { todayStr, formatDate } from "../utils/attendance";
import { initials } from "./PortalLayout";
import { sameGroup, teacherAssignments } from "../utils/teacherClasses";
import { buildResultRows, downloadResultsCsv, printResults } from "../utils/resultsExport";

const emptyExam = {
  title: "",
  term: "",
  examDate: todayStr(),
  outOf: "", // "inta lagu saxayo" — dhammaan classes-ka (class kasta wuu beddeli karaa)
  classes: [], // [{ classGroup, subjects: [name], outOf: "" }]
};

// Fasallada la dooran karo, kooxaysan (Preparation A–D, English A–D, ...)
const CLASS_PICKER = CLASSES.map((c) => ({
  id: c.id,
  name: c.name,
  groups: c.subs ? c.subs.map((sub) => groupLabel(c, sub)) : [c.name],
}));

// Maadooyinka fasalka: kuwa ardayda fasalkaas ku diiwaangashan yihiin +
// maadada macallimiinta fasalkaas loo qoray. (Tartibka SUBJECT_OPTIONS)
function subjectsForGroup(students, teachers, classGroup) {
  const target = String(classGroup || "").trim().toLowerCase();
  const set = new Set();
  // Maadooyinka rasmiga ah ee fasalka (sida warqadda ku qoran) marka hore.
  const resolved = resolveGroupLabel(classGroup);
  if (resolved) subjectsFor(resolved.classId, resolved.subId).forEach((x) => set.add(x));
  studentsInGroup(students, classGroup).forEach((s) => {
    (Array.isArray(s.subjects) ? s.subjects : s.subjects ? [s.subjects] : []).forEach((x) => set.add(x));
  });
  // Maadooyinka macallimiinta fasalkan loo qoray (class kasta maadooyinkiisa)
  (teachers || []).forEach((t) => {
    teacherAssignments(t)
      .filter((a) => String(a.className).trim().toLowerCase() === target || sameGroup(a.className, classGroup))
      .forEach((a) => a.subjects.forEach((x) => x && set.add(x)));
  });
  const ordered = SUBJECT_OPTIONS.filter((x) => set.has(x));
  const extra = [...set].filter((x) => !SUBJECT_OPTIONS.includes(x)).sort();
  return [...ordered, ...extra];
}

function studentsInGroup(students, classGroup) {
  return students
    .filter((s) => studentBelongsToGroup(s, classGroup))
    .sort((a, b) => String(a.studentId).localeCompare(String(b.studentId)));
}

export default function ExamsManager({ students, teachers = [], adminName }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyExam);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [classFilter, setClassFilter] = useState("");

  useEffect(() => {
    const unsub = subscribeExams(
      (list) => {
        setExams(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const selected = exams.find((e) => e.id === selectedId) || null;

  // ---------- Classes (multi-select) ----------
  function toggleClass(classGroup) {
    setError("");
    setForm((f) => {
      if (f.classes.some((c) => c.classGroup === classGroup)) {
        return { ...f, classes: f.classes.filter((c) => c.classGroup !== classGroup) };
      }
      const auto = subjectsForGroup(students, teachers, classGroup);
      return { ...f, classes: [...f.classes, { classGroup, subjects: auto, outOf: "" }] };
    });
  }

  function toggleGroupAll(groups) {
    setForm((f) => {
      const allOn = groups.every((g) => f.classes.some((c) => c.classGroup === g));
      if (allOn) return { ...f, classes: f.classes.filter((c) => !groups.includes(c.classGroup)) };
      const add = groups
        .filter((g) => !f.classes.some((c) => c.classGroup === g))
        .map((g) => ({ classGroup: g, subjects: subjectsForGroup(students, teachers, g), outOf: "" }));
      return { ...f, classes: [...f.classes, ...add] };
    });
  }

  function updateClass(classGroup, fn) {
    setForm((f) => ({ ...f, classes: f.classes.map((c) => (c.classGroup === classGroup ? fn(c) : c)) }));
  }

  function toggleClassSubject(classGroup, name) {
    updateClass(classGroup, (c) => ({
      ...c,
      subjects: c.subjects.includes(name) ? c.subjects.filter((x) => x !== name) : [...c.subjects, name],
    }));
  }

  // Lambarka "inta lagu saxayo" ee class (haddii aan gaar loo qorin -> kan guud)
  const outOfFor = (c) => (String(c.outOf).trim() !== "" ? c.outOf : form.outOf);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setNote("");
    const title = form.title.trim();
    if (!title) return setError("Geli magaca exam-ka (tusaale: Midterm Exam).");
    if (form.classes.length === 0) return setError("Dooro ugu yaraan hal class.");
    for (const c of form.classes) {
      if (!c.subjects.length) return setError(`${c.classGroup}: dooro ugu yaraan hal maado.`);
      if (!(Number(outOfFor(c)) > 0)) {
        return setError(`${c.classGroup}: geli inta exam-ka lagu saxayo (tusaale 50 ama 100).`);
      }
      const dup = exams.find(
        (ex) => ex.classGroup === c.classGroup && String(ex.title).trim().toLowerCase() === title.toLowerCase()
      );
      if (dup) return setError(`${c.classGroup} horey ayuu u lahaa exam la yiraahdo "${title}".`);
    }

    setCreating(true);
    try {
      const ids = [];
      for (const c of form.classes) {
        const outOf = Number(outOfFor(c));
        const ordered = [
          ...SUBJECT_OPTIONS.filter((x) => c.subjects.includes(x)),
          ...c.subjects.filter((x) => !SUBJECT_OPTIONS.includes(x)),
        ];
        ids.push(
          await createExam({
            title,
            classGroup: c.classGroup,
            term: form.term,
            examDate: form.examDate,
            outOf,
            subjects: ordered.map((name) => ({ name, maxMark: outOf })),
            createdBy: adminName,
          })
        );
      }
      const count = form.classes.length;
      setForm({ ...emptyExam, examDate: todayStr() });
      if (count === 1) setSelectedId(ids[0]);
      else setNote(`✓ "${title}" waxaa loo sameeyay ${count} class. Macallimiintu hadda way arkayaan si ay dhibcaha u soo gudbiyaan.`);
    } catch (err) {
      setError(err.message || "Exam-ka lama samayn karin.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(exam) {
    const ok = window.confirm(
      `Ma tirtiraysaa exam-ka "${exam.title}" (${exam.classGroup}) iyo natiijooyinkiisa oo dhan?\n\nArdayda portal-kooda way ka baxaysaa.`
    );
    if (!ok) return;
    try {
      await deleteExam(exam.id);
      if (selectedId === exam.id) setSelectedId(null);
      setNote(`Exam-ka "${exam.title}" waa la tirtiray.`);
    } catch (err) {
      setError(err.message || "Lama tirtiri karin.");
    }
  }

  const examClasses = [...new Set(exams.map((e) => e.classGroup).filter(Boolean))].sort();
  const shownExams = classFilter ? exams.filter((e) => e.classGroup === classFilter) : exams;

  if (selected) {
    return (
      <ResultsEntry
        exam={selected}
        students={studentsInGroup(students, selected.classGroup)}
        teachers={teachers}
        adminName={adminName}
        onBack={() => setSelectedId(null)}
        onDelete={() => handleDelete(selected)}
      />
    );
  }

  return (
    <div className="stack">
      <form className="panel form ex-form" onSubmit={handleCreate}>
        <div className="panel-head">
          <div className="panel-icon"><ClipboardList size={20} /></div>
          <div>
            <h2>Create Exam</h2>
            <p>Hal mar dooro classes badan — class kasta exam gooni ah ayaa loo sameynayaa, macallimiintuna maadadooda ayay soo gudbiyaan.</p>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="form-grid">
          <label>
            Exam name (Magaca imtixaanka)
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Midterm Exam"
              required
            />
          </label>
          <label>
            Marked out of (Inta lagu saxayo)
            <div className="ex-outof">
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={form.outOf}
                onChange={(e) => setForm({ ...form, outOf: e.target.value })}
                placeholder="e.g. 100"
              />
              <span>/ maado kasta</span>
            </div>
          </label>
          <label>
            Term (optional)
            <input
              value={form.term}
              onChange={(e) => setForm({ ...form, term: e.target.value })}
              placeholder="e.g. Term 1 — 2026"
            />
          </label>
          <label>
            Exam date
            <input type="date" value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
          </label>
        </div>

        <div className="field">
          <span className="field-label ex-label-row">
            <span>Classes (Fasallada) — dooro hal ama dhawr</span>
            <b className={`ex-count ${form.classes.length ? "on" : ""}`}>{form.classes.length} selected</b>
          </span>
          <div className="ex-picker">
            {CLASS_PICKER.map((c) => {
              const multi = c.groups.length > 1;
              const allOn = c.groups.every((g) => form.classes.some((x) => x.classGroup === g));
              return (
                <div key={c.id} className="ex-picker-group">
                  <div className="ex-picker-head">
                    <strong>{c.name}</strong>
                    {multi && (
                      <button type="button" className="ex-all" onClick={() => toggleGroupAll(c.groups)}>
                        {allOn ? "Clear" : "Select all"}
                      </button>
                    )}
                  </div>
                  <div className="ex-chips">
                    {c.groups.map((g) => {
                      const on = form.classes.some((x) => x.classGroup === g);
                      const n = studentsInGroup(students, g).length;
                      const label = multi
                        ? g
                            .replace(`${c.name} – `, "")
                            .replace(/^Preparation /, "Class ")
                            .replace(/ English (Elementary|Intermediate)$/, " $1")
                        : g;
                      return (
                        <button key={g} type="button" className={`ex-chip ${on ? "on" : ""}`} onClick={() => toggleClass(g)} title={g}>
                          {on && <Check size={13} />}
                          {label}
                          <em>{n}</em>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {form.classes.length > 0 && (
          <div className="ex-selected">
            {form.classes.map((c) => {
              const options = SUBJECT_OPTIONS.filter((x) => !c.subjects.includes(x));
              const effective = outOfFor(c);
              return (
                <div key={c.classGroup} className="ex-class-card">
                  <div className="ex-class-head">
                    <div>
                      <strong>{c.classGroup}</strong>
                      <span>{studentsInGroup(students, c.classGroup).length} students • {c.subjects.length} subjects</span>
                    </div>
                    <div className="ex-class-outof">
                      <label>
                        Out of
                        <input
                          type="number"
                          min="1"
                          inputMode="numeric"
                          value={c.outOf}
                          placeholder={form.outOf || "100"}
                          onChange={(e) => updateClass(c.classGroup, (x) => ({ ...x, outOf: e.target.value }))}
                        />
                      </label>
                      <button type="button" className="btn btn-ghost btn-sm" title="Ka saar" onClick={() => toggleClass(c.classGroup)}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="ex-subjects">
                    {c.subjects.map((name) => (
                      <button key={name} type="button" className="ex-subject on" onClick={() => toggleClassSubject(c.classGroup, name)} title="Ka saar maadadan">
                        {name}
                        {effective ? <em>/{effective}</em> : null}
                        <X size={12} />
                      </button>
                    ))}
                    {options.length > 0 && (
                      <select
                        className="ex-add-subject"
                        value=""
                        onChange={(e) => e.target.value && toggleClassSubject(c.classGroup, e.target.value)}
                      >
                        <option value="">+ Add subject</option>
                        {options.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    )}
                    {!c.subjects.length && <span className="ex-warn">Dooro ugu yaraan hal maado</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-lg" disabled={creating}>
          <Plus size={16} />{" "}
          {creating
            ? "Creating..."
            : form.classes.length > 1
            ? `Create Exam for ${form.classes.length} classes`
            : "Create Exam & Enter Results"}
        </button>
      </form>

      {note && <p className="banner banner-green" style={{ margin: 0 }}>{note}</p>}

      <div className="panel">
        <div className="section-head">
          <div>
            <h2>All Exams ({shownExams.length})</h2>
            <p className="muted-sm">Natiijada fasal kasta — macallimiintu maadadooda ayay soo gudbiyaan.</p>
          </div>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ maxWidth: 260 }}>
            <option value="">All classes</option>
            {examClasses.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : shownExams.length === 0 ? (
          <div className="empty">
            <ClipboardList size={34} />
            <strong>No exams yet</strong>
            <span>Samee exam-ka ugu horreeya kor.</span>
          </div>
        ) : (
          <div className="table-scroll fit">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Class</th>
                  <th>Date</th>
                  <th>Subjects</th>
                  <th>Submitted</th>
                  <th>Students</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shownExams.map((ex) => (
                  <tr key={ex.id}>
                    <td>
                      <div className="cell-stack">
                        <strong>{ex.title}</strong>
                        {ex.term && <span className="muted-sm">{ex.term}</span>}
                      </div>
                    </td>
                    <td><span className="tag tag-soft">{ex.classGroup}</span></td>
                    <td>{ex.examDate ? formatDate(ex.examDate) : "—"}</td>
                    <td>
                      <div className="tag-list">
                        {(ex.subjects || []).map((s) => (
                          <span key={s.name} className="tag">{s.name} /{s.maxMark}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {(() => {
                        const n = (ex.subjects || []).filter((s) => ex.submissions?.[s.name]).length;
                        const all = (ex.subjects || []).length;
                        return (
                          <span className={`pill pill-sm ${n === all && all ? "pill-green" : n ? "pill-amber" : "pill-red"}`}>
                            {n}/{all}
                          </span>
                        );
                      })()}
                    </td>
                    <td>{studentsInGroup(students, ex.classGroup).length}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => setSelectedId(ex.id)}>
                          <Trophy size={14} /> Results
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDelete(ex)} title="Delete exam">
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
    </div>
  );
}

function ResultsEntry({ exam, students, teachers = [], adminName, onBack, onDelete }) {
  const [results, setResults] = useState([]);
  const [marks, setMarks] = useState({}); // { sid: { subject: value } }
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const unsub = subscribeExamResults(
      exam.id,
      (list) => {
        setResults(list);
        setLoaded(true);
      },
      () => setLoaded(true)
    );
    return unsub;
  }, [exam.id]);

  // Buuxi dhibcihii horey loo kaydiyay (kaliya haddii aan wax la beddelin)
  useEffect(() => {
    if (dirty) return;
    const next = {};
    results.forEach((r) => {
      next[r.studentId] = {};
      Object.entries(r.marks || {}).forEach(([k, v]) => {
        next[r.studentId][k] = v === null || v === undefined ? "" : String(v);
      });
    });
    setMarks(next);
  }, [results, dirty]);

  const resultById = useMemo(
    () => Object.fromEntries(results.map((r) => [r.studentId, r])),
    [results]
  );

  // Maado kasta: yaa gudbiyay / macallinka loo qoray
  const subjectStatus = (exam.subjects || []).map((sub) => {
    const done = exam.submissions?.[sub.name];
    const assigned = teachers
      .filter((t) =>
        teacherAssignments(t).some(
          (a) => sameGroup(a.className, exam.classGroup) && a.subjects.some((x) => String(x).toLowerCase() === sub.name.toLowerCase())
        )
      )
      .map((t) => t.fullName || t.username);
    return { name: sub.name, done, assigned };
  });

  function exportRows() {
    return buildResultRows(exam, students, results);
  }

  function setMark(sid, subject, value) {
    setDirty(true);
    setNote("");
    setMarks((m) => ({ ...m, [sid]: { ...(m[sid] || {}), [subject]: value } }));
  }

  async function handleSave() {
    setError("");
    setNote("");
    // Hubi in dhibcuhu ku jiraan 0 – max
    for (const s of students) {
      for (const sub of exam.subjects || []) {
        const raw = marks[s.studentId]?.[sub.name];
        if (raw === "" || raw === undefined) continue;
        const v = Number(raw);
        if (isNaN(v) || v < 0 || v > Number(sub.maxMark)) {
          return setError(`${s.fullName} — ${sub.name}: dhibcuhu waa inay u dhexeeyaan 0 iyo ${sub.maxMark}.`);
        }
      }
    }
    setSaving(true);
    try {
      const res = await saveExamResults(exam, students, marks, adminName);
      setDirty(false);
      setNote(`✓ Natiijooyinka ${res.saved} arday waa la kaydiyay — hadda waxay ka muuqdaan portal-ka ardayda.`);
    } catch (err) {
      setError(err.message || "Natiijooyinka lama kaydin karin.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <div className="panel">
        <div className="section-head">
          <div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 8 }}>
              <ArrowLeft size={14} /> All exams
            </button>
            <h2>{exam.title}</h2>
            <p className="muted-sm" style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
              <span><Users size={13} /> {exam.classGroup} — {students.length} students</span>
              {exam.examDate && <span><CalendarDays size={13} /> {formatDate(exam.examDate)}</span>}
              {exam.term && <span>{exam.term}</span>}
              <span><BookOpen size={13} /> {(exam.subjects || []).map((s) => `${s.name} /${s.maxMark}`).join(" · ")}</span>
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-light btn-sm" onClick={() => downloadResultsCsv(exam, exportRows())} disabled={!results.length}>
              <Download size={14} /> Download
            </button>
            <button type="button" className="btn btn-light btn-sm" onClick={() => printResults(exam, exportRows())} disabled={!results.length}>
              <Printer size={14} /> Print
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onDelete}>
              <Trash2 size={14} /> Delete exam
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || students.length === 0}>
              <Save size={16} /> {saving ? "Saving..." : "Save Results"}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 8, margin: "4px 0 14px" }}>
          {subjectStatus.map((s) => (
            <div
              key={s.name}
              style={{
                padding: "9px 12px",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                background: s.done ? "#f0fdf4" : "#fffbeb",
                fontSize: 12.5,
                lineHeight: 1.45,
              }}
            >
              <strong style={{ display: "flex", alignItems: "center", gap: 6, color: s.done ? "#166534" : "#92400e" }}>
                {s.done ? <CheckCircle2 size={14} /> : <Clock size={14} />} {s.name}
              </strong>
              <span style={{ color: "#475569" }}>
                {s.done
                  ? `Submitted by ${s.done.teacherName || "teacher"} • ${s.done.count ?? "?"}/${s.done.total ?? "?"}`
                  : s.assigned.length
                  ? `Waiting: ${s.assigned.join(", ")}`
                  : "No teacher assigned"}
              </span>
            </div>
          ))}
        </div>

        {error && <p className="error">{error}</p>}
        {note && (
          <p className="banner banner-green" style={{ margin: "0 0 12px" }}>
            <CheckCircle2 size={18} /> {note}
          </p>
        )}

        {!loaded ? (
          <p className="muted">Loading...</p>
        ) : students.length === 0 ? (
          <div className="empty">
            <Users size={34} />
            <strong>Fasalka {exam.classGroup} arday kuma jiraan</strong>
          </div>
        ) : (
          <div className="table-scroll fit">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  {(exam.subjects || []).map((s) => (
                    <th key={s.name} style={{ textAlign: "center" }}>{s.name}<br />/{s.maxMark}</th>
                  ))}
                  <th>Total</th>
                  <th>%</th>
                  <th>Grade</th>
                  <th>Rank</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => {
                  const row = marks[s.studentId] || {};
                  const live = computeResult(exam, row);
                  const saved = resultById[s.studentId];
                  return (
                    <tr key={s.studentId}>
                      <td>{i + 1}</td>
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
                      {(exam.subjects || []).map((sub) => (
                        <td key={sub.name} style={{ textAlign: "center" }}>
                          <input
                            type="number"
                            min="0"
                            max={sub.maxMark}
                            step="0.5"
                            value={row[sub.name] ?? ""}
                            onChange={(e) => setMark(s.studentId, sub.name, e.target.value)}
                            style={{ width: 70, textAlign: "center", padding: "7px 6px" }}
                          />
                        </td>
                      ))}
                      <td><strong>{live.filled ? `${live.total}/${live.maxTotal}` : "—"}</strong></td>
                      <td>{live.filled ? `${live.percent}%` : "—"}</td>
                      <td>
                        {live.grade ? (
                          <span className={`pill pill-${gradeTone(live.grade)}`}>{live.grade}</span>
                        ) : "—"}
                      </td>
                      <td>{saved?.rank && !dirty ? `${saved.rank}/${saved.classSize}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint" style={{ marginTop: 10 }}>
          Meelaha banaan lama tiriyo. Kaalinta (rank) waxaa la xisaabiyaa marka la keydiyo. Macallimiinta marka ay
          gudbiyaan dhibcaha halkan si toos ah ayay ugu soo dhacayaan.
        </p>
      </div>
    </div>
  );
}