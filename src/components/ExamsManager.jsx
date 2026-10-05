// src/components/ExamsManager.jsx
//
// Admin → Exams:
//  1) Samee exam fasal (magaca, fasalka, term, taariikhda, maadooyinka iyo
//     dhibcaha ugu badan ee maado kasta)
//  2) Dooro exam-ka → ardayda fasalkaas oo dhan ayaa si toos ah u soo baxaya
//  3) Geli dhibcaha arday kasta → Save Results
//  4) Arday kasta natiijadiisa wuxuu ku arkayaa Student Portal-kiisa (live)

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList, Plus, Trash2, Save, ArrowLeft, Users, CalendarDays, BookOpen, Trophy, CheckCircle2,
} from "lucide-react";
import { CLASSES, CLASS_BY_ID, SUBJECT_OPTIONS, groupLabel, studentGroups } from "../config/schoolOptions";
import {
  computeResult, createExam, deleteExam, gradeTone,
  saveExamResults, subscribeExamResults, subscribeExams,
} from "../utils/exams";
import { todayStr, formatDate } from "../utils/attendance";
import { initials } from "./PortalLayout";

const emptyExam = {
  title: "",
  classId: "",
  subId: "",
  classGroup: "",
  term: "",
  examDate: todayStr(),
  subjects: [], // [{ name, maxMark }]
  allMax: "", // dhibcaha ugu badan ee la dhex dhigi karo dhammaan maadooyinka
};

// Maadooyinka fasalka: kuwa ardayda fasalkaas ku diiwaangashan yihiin +
// maadada macallimiinta fasalkaas loo qoray. (Tartibka SUBJECT_OPTIONS)
function subjectsForGroup(students, teachers, classGroup) {
  const target = String(classGroup || "").trim().toLowerCase();
  const set = new Set();
  studentsInGroup(students, classGroup).forEach((s) => {
    (Array.isArray(s.subjects) ? s.subjects : s.subjects ? [s.subjects] : []).forEach((x) => set.add(x));
  });
  (teachers || []).forEach((t) => {
    if (String(t.className || "").trim().toLowerCase() !== target) return;
    const subs = t.subject ? [t.subject] : Array.isArray(t.subjects) ? t.subjects : [];
    subs.forEach((x) => x && set.add(x));
  });
  const ordered = SUBJECT_OPTIONS.filter((x) => set.has(x));
  const extra = [...set].filter((x) => !SUBJECT_OPTIONS.includes(x)).sort();
  return [...ordered, ...extra];
}

function studentsInGroup(students, classGroup) {
  const target = String(classGroup || "").trim().toLowerCase();
  return students
    .filter((s) => studentGroups(s).some((g) => String(g).trim().toLowerCase() === target))
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
  const [autoNote, setAutoNote] = useState("");

  // Fasalka (iyo qaybta haddii uu leeyahay) -> classGroup + maadooyinka si toos ah
  function applyClass(classId, subId) {
    const cls = CLASS_BY_ID[classId];
    const sub = cls?.subs ? cls.subs.find((x) => x.id === subId) : null;
    const classGroup = !cls ? "" : cls.subs ? (sub ? groupLabel(cls, sub) : "") : cls.name;

    setForm((f) => {
      let subjects = f.subjects;
      if (classGroup) {
        const auto = subjectsForGroup(students, teachers, classGroup);
        if (auto.length) {
          subjects = auto.map((name) => {
            const prev = f.subjects.find((x) => x.name === name);
            return { name, maxMark: prev ? prev.maxMark : "" };
          });
          setAutoNote(`Maadooyinka ${classGroup} si toos ah ayaa loo doortay (${auto.length}) — waad beddeli kartaa.`);
        } else {
          setAutoNote(`${classGroup}: maadooyin loo qoray lama helin — gacanta ku dooro.`);
        }
      } else {
        setAutoNote("");
      }
      return { ...f, classId, subId: sub ? sub.id : "", classGroup, subjects };
    });
  }

  function toggleSubject(name) {
    setForm((f) => {
      const has = f.subjects.some((s) => s.name === name);
      return {
        ...f,
        subjects: has
          ? f.subjects.filter((s) => s.name !== name)
          : [...f.subjects, { name, maxMark: f.allMax || "" }],
      };
    });
  }

  function setMax(name, value) {
    setForm((f) => ({
      ...f,
      subjects: f.subjects.map((s) => (s.name === name ? { ...s, maxMark: value } : s)),
    }));
  }

  // Hal lambar ku buuxi maadooyinka la doortay dhammaan
  function setAllMax(value) {
    setForm((f) => ({
      ...f,
      allMax: value,
      subjects: f.subjects.map((s) => ({ ...s, maxMark: value })),
    }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setNote("");
    if (!form.title.trim()) return setError("Geli magaca exam-ka (tusaale: Midterm Exam).");
    if (!form.classId) return setError("Dooro fasalka exam-ka.");
    if (CLASS_BY_ID[form.classId]?.subs && !form.classGroup) {
      return setError(`Dooro qaybta ${CLASS_BY_ID[form.classId].name} (tusaale: ${CLASS_BY_ID[form.classId].subs.map((x) => x.name).join(" / ")}).`);
    }
    if (!form.classGroup) return setError("Dooro fasalka exam-ka.");
    if (form.subjects.length === 0) return setError("Dooro ugu yaraan hal maado.");
    const bad = form.subjects.find((s) => !(Number(s.maxMark) > 0));
    if (bad) return setError(`Geli dhibcaha ugu badan ee ${bad.name} (tusaale: 20, 50 ama 100) — waa inay ka badan tahay 0.`);

    setCreating(true);
    try {
      const id = await createExam({ ...form, createdBy: adminName });
      setForm({ ...emptyExam, examDate: todayStr() });
      setAutoNote("");
      setSelectedId(id);
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

  if (selected) {
    return (
      <ResultsEntry
        exam={selected}
        students={studentsInGroup(students, selected.classGroup)}
        adminName={adminName}
        onBack={() => setSelectedId(null)}
        onDelete={() => handleDelete(selected)}
      />
    );
  }

  return (
    <div className="stack">
      <form className="panel form" onSubmit={handleCreate}>
        <div className="panel-head">
          <div className="panel-icon"><ClipboardList size={20} /></div>
          <div>
            <h2>Create Class Exam</h2>
            <p>Samee exam fasal — kadibna ardayda fasalkaas ayaa soo baxaya si aad natiijooyinka u geliso.</p>
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
            Class (Fasalka)
            <select
              value={form.classId}
              onChange={(e) => applyClass(e.target.value, "")}
              required
            >
              <option value="">Select class</option>
              {CLASSES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.subs ? " — dooro qaybta" : ` (${studentsInGroup(students, c.name).length} students)`}
                </option>
              ))}
            </select>
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
            <input
              type="date"
              value={form.examDate}
              onChange={(e) => setForm({ ...form, examDate: e.target.value })}
            />
          </label>
        </div>

        {CLASS_BY_ID[form.classId]?.subs && (
          <div className="field">
            <span className="field-label">
              {CLASS_BY_ID[form.classId].name} — kee qaybta? (Which level / section?)
            </span>
            <div className="sub-picker">
              {CLASS_BY_ID[form.classId].subs.map((sub) => {
                const label = groupLabel(CLASS_BY_ID[form.classId], sub);
                return (
                  <button
                    key={sub.id}
                    type="button"
                    className={`day-chip ${form.subId === sub.id ? "active" : ""}`}
                    onClick={() => applyClass(form.classId, sub.id)}
                  >
                    {sub.name} ({studentsInGroup(students, label).length})
                  </button>
                );
              })}
            </div>
            {!form.subId && <p className="hint" style={{ marginTop: 6 }}>Fadlan dooro qaybta exam-ku u yahay.</p>}
          </div>
        )}

        {autoNote && <p className="hint" style={{ color: "var(--accent-dark)", fontWeight: 600 }}>✓ {autoNote}</p>}

        <div className="field">
          <span className="field-label">Subjects (maadooyinka) — iyo dhibcaha ugu badan</span>
          <div className="subject-grid">
            {SUBJECT_OPTIONS.map((subj) => (
              <label key={subj} className="subject-chip">
                <input
                  type="checkbox"
                  checked={form.subjects.some((s) => s.name === subj)}
                  onChange={() => toggleSubject(subj)}
                />
                {subj}
              </label>
            ))}
          </div>
          {form.subjects.length > 0 && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: "0.82rem", fontWeight: 600 }}>
              Same max for all subjects
              <input
                type="number"
                min="1"
                placeholder="e.g. 50"
                value={form.allMax}
                onChange={(e) => setAllMax(e.target.value)}
                style={{ width: 96 }}
              />
            </label>
          )}
          {form.subjects.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
              {form.subjects.map((s) => (
                <label
                  key={s.name}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", fontWeight: 600 }}
                >
                  {s.name} — max
                  <input
                    type="number"
                    min="1"
                    placeholder="max"
                    value={s.maxMark}
                    onChange={(e) => setMax(s.name, e.target.value)}
                    required
                    style={{ width: 76 }}
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        <button type="submit" className="btn btn-primary btn-lg" disabled={creating}>
          <Plus size={16} /> {creating ? "Creating..." : "Create Exam & Enter Results"}
        </button>
      </form>

      {note && <p className="banner banner-green" style={{ margin: 0 }}>{note}</p>}

      <div className="panel">
        <div className="section-head">
          <h2>All Exams ({exams.length})</h2>
        </div>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : exams.length === 0 ? (
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
                  <th>Students</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {exams.map((ex) => (
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

function ResultsEntry({ exam, students, adminName, onBack, onDelete }) {
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
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onDelete}>
              <Trash2 size={14} /> Delete exam
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || students.length === 0}>
              <Save size={16} /> {saving ? "Saving..." : "Save Results"}
            </button>
          </div>
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
          Meelaha banaan lama tiriyo. Kaalinta (rank) waxaa la xisaabiyaa marka la keydiyo.
        </p>
      </div>
    </div>
  );
}