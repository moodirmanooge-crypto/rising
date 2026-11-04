// src/components/TeacherResults.jsx
//
// Teacher Portal → Exams & Results
//  1) "Send exam": macallinku marka hore wuxuu soo diraa exam-ka — fasalkiisa,
//     maadadiisa, magaca, taariikhda, inta lagu saxayo iyo warqadda (optional).
//     Admin-ka isla markiiba wuu arkaa.
//  2) "My exams": exam-yada uu isagu diray OO KELIYA → Enter results → Submit.
//     Natiijada admin-ka ayay u tagtaa, ardayduna portal-kooda ayay ka arkaan.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, BookOpen, CalendarDays, CheckCircle2, Send, Trophy, Users, FileUp, FileText, Plus, Trash2, Clock, X,
} from "lucide-react";

import { initials } from "./PortalLayout";
import { formatDate, formatTimestamp, todayStr } from "../utils/attendance";
import {
  EXAM_STATUS, createTeacherExam, deleteExam, examStatus, gradeFor, gradeTone, isOwnExam,
  subscribeExamResults, subscribeExams, submitSubjectMarks,
} from "../utils/exams";
import { studentsForClass, teacherAssignments } from "../utils/teacherClasses";

function submittedText(sub) {
  if (!sub) return "";
  const when = sub.submittedAt?.toDate ? sub.submittedAt.toDate() : null;
  return when
    ? `${when.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${formatTimestamp(sub.submittedAt)}`
    : "";
}

const emptyExam = () => ({ classGroup: "", subject: "", title: "", term: "", examDate: todayStr(), maxMark: "", note: "" });

export default function TeacherResults({ teacher, students, loadingStudents }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // { examId, subject }
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

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

  const assignments = useMemo(() => teacherAssignments(teacher), [teacher]);

  // Exam-yada macallinkan uu isagu soo diray oo keliya
  const myExams = useMemo(() => exams.filter((e) => isOwnExam(e, teacher) && e.status !== "uploading"), [exams, teacher]);

  // Hawlaha: exam × maado (exam-yadiisa)
  const tasks = useMemo(
    () =>
      myExams.flatMap((exam) =>
        (exam.subjects || []).map((sub) => ({ exam, subject: sub.name, maxMark: sub.maxMark }))
      ),
    [myExams]
  );

  const active = selected
    ? tasks.find((t) => t.exam.id === selected.examId && t.subject === selected.subject)
    : null;

  if (active) {
    return (
      <MarksEntry
        task={active}
        teacher={teacher}
        students={studentsForClass(students, active.exam.classGroup, [active.subject])}
        onBack={() => setSelected(null)}
      />
    );
  }

  const pending = tasks.filter((t) => !t.exam.submissions?.[t.subject]).length;

  async function removeExam(exam) {
    setError("");
    setNote("");
    if (Object.keys(exam.submissions || {}).length) {
      setError("Exam-kan natiijadiisa waa la gudbiyay — kaliya admin-ka ayaa tirtiri kara.");
      return;
    }
    if (!window.confirm(`Ma tirtiraysaa exam-ka "${exam.title}" (${exam.classGroup})?`)) return;
    try {
      await deleteExam(exam.id);
      setNote(`Exam-ka "${exam.title}" waa la tirtiray.`);
    } catch (err) {
      setError(err.message || "Lama tirtiri karin.");
    }
  }

  return (
    <div className="stack">
      {/* ---------- 1) Send exam ---------- */}
      {showForm ? (
        <SendExamForm
          teacher={teacher}
          assignments={assignments}
          students={students}
          exams={myExams}
          onCancel={() => setShowForm(false)}
          onSent={(t) => {
            setShowForm(false);
            setError("");
            setNote(`✓ Exam-ka "${t}" waa la diray — admin-ka wuu arkaa. Hadda geli natiijada marka la saxo.`);
          }}
        />
      ) : (
        <div className="tp-send-cta">
          <div>
            <strong>1. Soo dir exam-ka</strong>
            <span>Marka hore soo dir exam-ka fasalkaaga iyo maadadaada. Kadib ayaad natiijada u gudbin kartaa.</span>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)} disabled={!assignments.length}>
            <Plus size={16} /> Send exam
          </button>
        </div>
      )}

      {note && (
        <p className="banner banner-green" style={{ margin: 0 }}>
          <CheckCircle2 size={18} /> {note}
        </p>
      )}
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}

      {/* ---------- 2) My exams → results ---------- */}
      <div className="panel">
        <div className="section-head">
          <div>
            <h2>2. My exams — results ({tasks.length})</h2>
            <p className="muted-sm">
              Kaliya exam-yada aad adigu soo dirtay ayaa halkan ka muuqda. Geli dhibcaha, kadib Submit — admin-ka ayay u
              gudbaysaa, ardayduna portal-kooda ayay ka arkaan.
            </p>
          </div>
          {tasks.length > 0 && (
            <span className={`pill ${pending ? "pill-amber" : "pill-green"}`}>
              <span className="pill-dot" />
              {pending ? `${pending} results pending` : "All submitted"}
            </span>
          )}
        </div>

        {loading || loadingStudents ? (
          <p className="muted">Loading...</p>
        ) : tasks.length === 0 ? (
          <div className="empty">
            <Trophy size={34} />
            <strong>Weli exam ma aadan soo dirin</strong>
            <span>Riix "Send exam" si aad exam u soo dirto — kadib ayaad natiijadiisa halkan ka gelin kartaa.</span>
          </div>
        ) : (
          <div className="tp-exam-list">
            {tasks.map((t) => {
              const sub = t.exam.submissions?.[t.subject];
              const st = EXAM_STATUS[examStatus(t.exam)];
              const count = studentsForClass(students, t.exam.classGroup, [t.subject]).length;
              return (
                <div key={`${t.exam.id}_${t.subject}`} className="tp-exam">
                  <div className="tp-exam-title">
                    <strong>{t.exam.title}</strong>
                    <span>
                      {t.exam.term ? `${t.exam.term} • ` : ""}
                      {t.exam.examDate ? formatDate(t.exam.examDate) : ""}
                      {` • ${count} students`}
                    </span>
                  </div>
                  <div className="tp-exam-tags">
                    <span className="tag tag-soft">{t.exam.classGroup}</span>
                    <span className="tag">{t.subject} /{t.maxMark}</span>
                    {(t.exam.paperPdfUrl || t.exam.paperUrl) && (
                      <a className="tag tag-link" href={t.exam.paperPdfUrl || t.exam.paperUrl} target="_blank" rel="noreferrer">
                        <FileText size={12} /> PDF
                      </a>
                    )}
                    {t.exam.paperWordUrl && (
                      <a className="tag tag-link" href={t.exam.paperWordUrl} target="_blank" rel="noreferrer">
                        <FileText size={12} /> Word
                      </a>
                    )}
                  </div>
                  <div>
                    {sub ? (
                      <span className="approved-tag sm" title={submittedText(sub)}>
                        <CheckCircle2 size={14} /> Submitted {sub.count ?? ""}/{sub.total ?? count}
                      </span>
                    ) : (
                      <span className={`pill pill-sm pill-${st.tone}`}>
                        <Clock size={12} /> {st.label}
                      </span>
                    )}
                  </div>
                  <div className="tp-exam-actions">
                    <button
                      type="button"
                      className={`btn btn-sm ${sub ? "btn-light" : "btn-primary"}`}
                      onClick={() => setSelected({ examId: t.exam.id, subject: t.subject })}
                    >
                      {sub ? "View / Edit results" : "Enter results"}
                    </button>
                    {!sub && (
                      <button type="button" className="btn btn-ghost btn-sm" title="Tirtir exam-ka" onClick={() => removeExam(t.exam)}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Hal fayl (Word ama PDF)
// ------------------------------------------------------------------
function PaperPick({ kind, label, hint, accept, file, onFile }) {
  const ref = useRef(null);
  return (
    <div className={`tp-paper ${kind} ${file ? "has" : ""}`}>
      <span className="tp-paper-ico">{kind === "pdf" ? "PDF" : "W"}</span>
      <div className="tp-paper-body">
        <strong>{label} <small>{hint}</small></strong>
        {file ? (
          <span className="tp-file-name">
            <CheckCircle2 size={13} /> {file.name}
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove ${label}`}
              onClick={() => {
                onFile(null);
                if (ref.current) ref.current.value = "";
              }}
            >
              <X size={13} />
            </button>
          </span>
        ) : (
          <span className="muted-sm">Lama dooran</span>
        )}
      </div>
      <label className="btn btn-light btn-sm">
        <FileUp size={15} /> {file ? "Beddel" : "Dooro"}
        <input ref={ref} type="file" accept={accept} hidden onChange={(e) => onFile(e.target.files?.[0] || null)} />
      </label>
    </div>
  );
}

// ------------------------------------------------------------------
// Send exam form
// ------------------------------------------------------------------
function SendExamForm({ teacher, assignments, students, exams, onCancel, onSent }) {
  const [form, setForm] = useState(() => {
    const f = emptyExam();
    if (assignments.length === 1) {
      f.classGroup = assignments[0].className;
      if (assignments[0].subjects.length === 1) f.subject = assignments[0].subjects[0];
    }
    return f;
  });
  const [wordFile, setWordFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const assignment = assignments.find((a) => a.className === form.classGroup) || null;
  const subjects = assignment?.subjects || [];
  const studentCount = form.classGroup
    ? studentsForClass(students, form.classGroup, form.subject ? [form.subject] : []).length
    : 0;

  function set(field, value) {
    setError("");
    setForm((f) => ({ ...f, [field]: value }));
  }

  function pickClass(className) {
    const a = assignments.find((x) => x.className === className);
    setError("");
    setForm((f) => ({ ...f, classGroup: className, subject: a?.subjects.length === 1 ? a.subjects[0] : "" }));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    const title = form.title.trim();
    const dup = exams.find(
      (x) =>
        x.classGroup === form.classGroup &&
        String(x.title).trim().toLowerCase() === title.toLowerCase() &&
        (x.subjects || []).some((s) => s.name === form.subject)
    );
    if (dup) return setError(`"${title}" (${form.subject}) horey ayaad ugu dirtay ${form.classGroup}.`);
    setSaving(true);
    try {
      await createTeacherExam({ teacher, ...form, title, wordFile, pdfFile });
      onSent(title);
    } catch (err) {
      setError(err.message || "Exam-ka lama diri karin.");
      setSaving(false);
    }
  }

  return (
    <form className="panel form" onSubmit={submit}>
      <div className="panel-head">
        <div className="panel-icon"><Send size={20} /></div>
        <div>
          <h2>Send exam</h2>
          <p>Fasalkaaga iyo maadadaada dooro — exam-ka admin-ka ayaa isla markiiba arka.</p>
        </div>
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="Close" style={{ marginLeft: "auto" }}>
          <X size={18} />
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="form-grid">
        <label>
          Class (Fasalka)
          <select value={form.classGroup} onChange={(e) => pickClass(e.target.value)} required>
            <option value="">— Dooro fasalka —</option>
            {assignments.map((a) => (
              <option key={a.className} value={a.className}>{a.className}</option>
            ))}
          </select>
        </label>
        <label>
          Subject (Maadada)
          <select value={form.subject} onChange={(e) => set("subject", e.target.value)} disabled={!assignment} required>
            <option value="">{assignment ? "— Dooro maadada —" : "— Marka hore dooro fasalka —"}</option>
            {subjects.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Exam name (Magaca)
          <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Monthly One" required />
        </label>
        <label>
          Marked out of (Inta lagu saxayo)
          <input
            type="number"
            min="1"
            inputMode="numeric"
            value={form.maxMark}
            onChange={(e) => set("maxMark", e.target.value)}
            placeholder="e.g. 100"
            required
          />
        </label>
        <label>
          Exam date
          <input type="date" value={form.examDate} onChange={(e) => set("examDate", e.target.value)} />
        </label>
        <label>
          Term (optional)
          <input value={form.term} onChange={(e) => set("term", e.target.value)} placeholder="e.g. Term 1 — 2026" />
        </label>
      </div>

      <div className="field">
        <span className="field-label">Warqadda exam-ka — labada qaab waa waajib</span>
        <div className="tp-papers">
          <PaperPick
            kind="word"
            label="Word"
            hint=".doc / .docx"
            accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            file={wordFile}
            onFile={setWordFile}
          />
          <PaperPick kind="pdf" label="PDF" hint=".pdf" accept=".pdf,application/pdf" file={pdfFile} onFile={setPdfFile} />
        </div>
      </div>

      <label>
        Note to admin (optional)
        <input value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="e.g. Chapters 1–3" />
      </label>

      {form.classGroup && (
        <p className="hint" style={{ margin: 0 }}>
          <Users size={13} /> {form.classGroup}{form.subject ? ` · ${form.subject}` : ""} — {studentCount} students
        </p>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
          <Send size={16} /> {saving ? "Uploading Word + PDF..." : "Send exam to Admin"}
        </button>
        <button type="button" className="btn btn-ghost btn-lg" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function MarksEntry({ task, teacher, students, onBack }) {
  const { exam, subject, maxMark } = task;
  const [results, setResults] = useState([]);
  const [marks, setMarks] = useState({}); // { sid: value }
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

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

  // Dhibcihii horey loo keydiyay (kaliya haddii aan wax la beddelin)
  useEffect(() => {
    if (dirty) return;
    const next = {};
    results.forEach((r) => {
      const v = r.marks?.[subject];
      next[r.studentId] = v === null || v === undefined ? "" : String(v);
    });
    setMarks(next);
  }, [results, dirty, subject]);

  const sub = exam.submissions?.[subject];
  const filled = students.filter((s) => marks[s.studentId] !== "" && marks[s.studentId] !== undefined).length;

  function setMark(sid, value) {
    setDirty(true);
    setNote("");
    setMarks((m) => ({ ...m, [sid]: value }));
  }

  async function handleSubmit() {
    setError("");
    setNote("");
    if (filled === 0) return setError("Geli dhibcaha ugu yaraan hal arday.");
    if (filled < students.length) {
      const ok = window.confirm(
        `${students.length - filled} arday dhibco looma gelin. Ma u gudbinaysaa sidaas?\n\n(Meelaha banaan waa "Not graded".)`
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const res = await submitSubjectMarks(exam, subject, students, marks, teacher);
      setDirty(false);
      setNote(`✓ ${subject} — dhibcaha ${res.count} arday waa la gudbiyay. Admin-ka iyo ardaydaba hadda way arkayaan.`);
    } catch (err) {
      setError(err.message || "Lama gudbin karin.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <div className="section-head">
        <div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 8 }}>
            <ArrowLeft size={14} /> My exams
          </button>
          <h2>{exam.title} — {subject}</h2>
          <p className="muted-sm" style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
            <span><Users size={13} /> {exam.classGroup} — {students.length} students</span>
            <span><BookOpen size={13} /> Max {maxMark}</span>
            {exam.paperUrl && (
              <a href={exam.paperUrl} target="_blank" rel="noreferrer"><FileText size={13} /> Exam paper</a>
            )}
            {exam.examDate && <span><CalendarDays size={13} /> {formatDate(exam.examDate)}</span>}
            {sub && <span><CheckCircle2 size={13} /> Last submitted {submittedText(sub)}</span>}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={saving || students.length === 0}>
          <Send size={16} /> {saving ? "Submitting..." : sub ? "Update & Submit" : "Submit to Admin"}
        </button>
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
          <strong>{exam.classGroup}: arday {subject} qaata lama helin</strong>
        </div>
      ) : (
        <div className="tp-marks">
          {students.map((s, i) => {
            const raw = marks[s.studentId] ?? "";
            const has = raw !== "" && !isNaN(Number(raw));
            const pct = has ? Math.round((Number(raw) / Number(maxMark)) * 100) : null;
            const g = has ? gradeFor(pct) : "";
            const bad = has && (Number(raw) < 0 || Number(raw) > Number(maxMark));
            return (
              <div key={s.studentId} className="tp-mark-row">
                <div className="record-student">
                  <span className="row-num">{i + 1}</span>
                  {s.photoUrl ? (
                    <img src={s.photoUrl} alt={s.fullName} className="avatar" />
                  ) : (
                    <span className="avatar avatar-placeholder">{initials(s.fullName)}</span>
                  )}
                  <div>
                    <strong>{s.fullName}</strong>
                    <span>ID {s.studentId}</span>
                  </div>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max={maxMark}
                  step="0.5"
                  placeholder={`/${maxMark}`}
                  value={raw}
                  onChange={(e) => setMark(s.studentId, e.target.value)}
                  className={`tp-mark-input ${bad ? "bad" : ""}`}
                  aria-label={`${s.fullName} ${subject}`}
                />
                <div className="tp-mark-grade">
                  {g ? <span className={`pill pill-${gradeTone(g)}`}>{g}</span> : <span>—</span>}
                  <span>{has ? `${pct}%` : ""}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="hint" style={{ marginTop: 10 }}>
        {filled}/{students.length} filled • Meelaha banaan lama tiriyo. Maadooyinka macallimiinta kale waa la ilaaliyaa.
      </p>
    </div>
  );
}