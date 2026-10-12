// src/components/TeacherResults.jsx
//
// Teacher Portal → Results
//  • Exams-ka admin-ku u sameeyay classes-ka macallinka ayaa soo baxa
//  • Macallinku wuxuu geliyaa dhibcaha MAADADIISA oo kaliya (class kasta)
//  • Submit → natiijada ardayda waa la cusbooneysiiyaa (total, %, grade, rank)
//    admin-ka ayay u tagtaa, ardayduna portal-kooda ayay ka arkaan.

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CalendarDays, CheckCircle2, Send, Trophy, Users, AlertTriangle } from "lucide-react";

import { initials } from "./PortalLayout";
import { formatDate, formatTimestamp } from "../utils/attendance";
import { gradeFor, gradeTone, subscribeExamResults, subscribeExams, submitSubjectMarks } from "../utils/exams";
import { sameGroup, sameSubject, studentsForClass, teacherAssignments } from "../utils/teacherClasses";

function submittedText(sub) {
  if (!sub) return "";
  const when = sub.submittedAt?.toDate ? sub.submittedAt.toDate() : null;
  return when
    ? `${when.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${formatTimestamp(sub.submittedAt)}`
    : "";
}

export default function TeacherResults({ teacher, students, loadingStudents }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // { examId, subject }

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

  // Hawlaha: exam × maado ee macallinkan u qoran
  const tasks = useMemo(() => {
    const out = [];
    exams.forEach((exam) => {
      const a = assignments.find((x) => sameGroup(x.className, exam.classGroup));
      if (!a) return;
      (exam.subjects || []).forEach((sub) => {
        if (!a.subjects.some((s) => sameSubject(s, sub.name))) return;
        out.push({ exam, subject: sub.name, maxMark: sub.maxMark, assignment: a });
      });
    });
    return out;
  }, [exams, assignments]);

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

  const myId = teacher?.teacherId || teacher?.username;
  const pending = tasks.filter((t) => !t.exam.submissions?.[t.subject]).length;

  return (
    <div className="panel">
      <div className="section-head">
        <div>
          <h2>Exams to grade ({tasks.length})</h2>
          <p className="muted-sm">
            Geli dhibcaha maadadaada ee class kasta, kadib Submit. Admin-ka ayay u gudbaysaa, ardayduna portal-kooda ayay ka arkaan.
          </p>
        </div>
        {tasks.length > 0 && (
          <span className={`pill ${pending ? "pill-amber" : "pill-green"}`}>
            <span className="pill-dot" />
            {pending ? `${pending} pending` : "All submitted"}
          </span>
        )}
      </div>

      {loading || loadingStudents ? (
        <p className="muted">Loading...</p>
      ) : tasks.length === 0 ? (
        <div className="empty">
          <Trophy size={34} />
          <strong>No exams yet</strong>
          <span>Marka admin-ku exam u sameeyo classes-kaaga, halkan ayay ka soo muuqan doonaan.</span>
        </div>
      ) : (
        <div className="tp-exam-list">
          {tasks.map((t) => {
            const sub = t.exam.submissions?.[t.subject];
            const mine = sub && (sub.teacherId === myId || !sub.teacherId);
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
                </div>
                <div>
                  {sub ? (
                    <span className="approved-tag sm" title={submittedText(sub)}>
                      <CheckCircle2 size={14} /> Submitted {sub.count ?? ""}/{sub.total ?? count}
                      {!mine && sub.teacherName ? ` by ${sub.teacherName}` : ""}
                    </span>
                  ) : (
                    <span className="pending-tag">Not submitted</span>
                  )}
                </div>
                <button
                  type="button"
                  className={`btn btn-sm ${sub ? "btn-light" : "btn-primary"}`}
                  onClick={() => setSelected({ examId: t.exam.id, subject: t.subject })}
                >
                  {sub ? "View / Edit" : "Enter marks"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
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
  const myId = teacher?.teacherId || teacher?.username;
  const otherTeacher = sub && sub.teacherId && sub.teacherId !== myId ? sub.teacherName : "";
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
            <ArrowLeft size={14} /> All exams
          </button>
          <h2>{exam.title} — {subject}</h2>
          <p className="muted-sm" style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
            <span><Users size={13} /> {exam.classGroup} — {students.length} students</span>
            <span><BookOpen size={13} /> Max {maxMark}</span>
            {exam.examDate && <span><CalendarDays size={13} /> {formatDate(exam.examDate)}</span>}
            {sub && <span><CheckCircle2 size={13} /> Last submitted {submittedText(sub)}</span>}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={saving || students.length === 0}>
          <Send size={16} /> {saving ? "Submitting..." : sub ? "Update & Submit" : "Submit to Admin"}
        </button>
      </div>

      {otherTeacher && (
        <p className="banner banner-amber" style={{ margin: "0 0 12px" }}>
          <AlertTriangle size={18} /> {subject} waxaa horey u gudbiyay {otherTeacher}. Haddii aad gudbiso, dhibcahaaga ayaa bedelaya.
        </p>
      )}
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