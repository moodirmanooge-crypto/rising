// src/components/ExamsManager.jsx
//
// Admin → Exams & Results
//  • Exam-yada MACALLIMIINTA ayaa soo dira (Teacher Portal → Send exam).
//    Admin-ku halkan wuxuu ku arkaa exam kasta: magaca, fasalka, maadada,
//    macallinka diray, warqadda exam-ka, iyo xaaladda natiijada:
//      – "Waiting for results"  → exam-ka waa la diray, natiijo weli ma iman
//      – "Results submitted"    → macallinku natiijada wuu gudbiyay
//  • Results → natiijada fasalka (total, %, grade, rank), Download (Excel),
//    Print, iyo haddii loo baahdo sixitaan dhibcaha.

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList, Trash2, Save, ArrowLeft, Users, CalendarDays, BookOpen, Trophy, CheckCircle2,
  Download, Printer, Clock, FileText, Search, Send, UserRound,
} from "lucide-react";
import "../styles/exams.css";
import { studentBelongsToGroup } from "../config/schoolOptions";
import {
  EXAM_STATUS, canonicalExams, computeResult, deleteExam, examStatus, gradeTone,
  saveExamResults, subscribeExamResults, subscribeExams,
} from "../utils/exams";
import { formatDate } from "../utils/attendance";
import { initials } from "./PortalLayout";
import { buildResultRows, downloadResultsCsv, printResults } from "../utils/resultsExport";
import { printExamPaper, openExamPaper, downloadExamPaper, paperKind, hasPaper } from "../utils/paperPrint";
import ClassResults from "./ClassResults";

// Warqadda exam-ka: PDF → Print · Open · Download;  Word → Download
function PaperButtons({ exam, compact = false }) {
  const [busy, setBusy] = useState("");
  if (!hasPaper(exam)) return compact ? <span className="tag tag-muted">No paper</span> : null;
  const kind = paperKind(exam);
  const run = async (key, fn) => {
    setBusy(key);
    try {
      await fn(exam);
    } finally {
      setBusy("");
    }
  };
  return (
    <span className="paper-btns">
      {kind === "pdf" && (
        <button type="button" className="paper-btn print" disabled={!!busy} onClick={() => run("print", printExamPaper)} title="Si toos ah u daabac (PDF)">
          <Printer size={13} /> {busy === "print" ? "Diyaarinaya…" : "Print"}
        </button>
      )}
      {kind === "pdf" && (
        <button type="button" className="paper-btn pdf" disabled={!!busy} onClick={() => run("open", openExamPaper)} title={exam.paperName || "PDF"}>
          <FileText size={13} /> {busy === "open" ? "…" : "PDF"}
        </button>
      )}
      <button
        type="button"
        className={`paper-btn ${kind === "pdf" ? "pdf" : "word"}`}
        disabled={!!busy}
        onClick={() => run("dl", downloadExamPaper)}
        title={exam.paperName || "Download"}
      >
        <Download size={13} /> {busy === "dl" ? "Soo dejinaya…" : kind === "pdf" ? "Download" : "Word"}
      </button>
    </span>
  );
}

function studentsInGroup(students, classGroup) {
  return students
    .filter((s) => studentBelongsToGroup(s, classGroup))
    .sort((a, b) => String(a.studentId).localeCompare(String(b.studentId), undefined, { numeric: true }));
}

const senderOf = (ex) =>
  ex.createdByRole === "teacher" ? ex.teacherName || ex.createdBy || "Teacher" : `${ex.createdBy || "Admin"} (admin)`;

function sentText(ex) {
  const d = ex.createdAt?.toDate ? ex.createdAt.toDate() : null;
  return d ? d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
}

export default function ExamsManager({ students, teachers = [], adminName }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [classFilter, setClassFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("exams"); // exams | byClass

  useEffect(() => {
    const unsub = subscribeExams(
      (list) => {
        setExams(canonicalExams(list));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const selected = exams.find((e) => e.id === selectedId) || null;

  const counts = useMemo(() => {
    const c = { all: exams.length, sent: 0, partial: 0, results: 0 };
    exams.forEach((e) => (c[examStatus(e)] += 1));
    return c;
  }, [exams]);

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
  const examTeachers = [...new Set(exams.map(senderOf))].sort();
  const q = search.trim().toLowerCase();
  const shownExams = exams.filter((e) => {
    if (e.status === "uploading") return false;
    if (classFilter && e.classGroup !== classFilter) return false;
    if (teacherFilter && senderOf(e) !== teacherFilter) return false;
    if (statusFilter && examStatus(e) !== statusFilter) return false;
    if (q && ![e.title, e.classGroup, senderOf(e), ...(e.subjects || []).map((x) => x.name)].join(" ").toLowerCase().includes(q)) return false;
    return true;
  });

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

  const tiles = [
    { key: "", label: "All exams", so: "Dhammaan", n: counts.all, tone: "slate", Icon: ClipboardList },
    { key: "sent", label: "Waiting for results", so: "Natiijo la sugayo", n: counts.sent, tone: "amber", Icon: Clock },
    { key: "partial", label: "Partly submitted", so: "Qayb", n: counts.partial, tone: "blue", Icon: Send },
    { key: "results", label: "Results submitted", so: "La gudbiyay", n: counts.results, tone: "green", Icon: CheckCircle2 },
  ];

  const tabs = (
    <div className="ex-tabs" role="tablist">
      <button type="button" role="tab" aria-selected={view === "exams"} className={view === "exams" ? "on" : ""} onClick={() => setView("exams")}>
        <ClipboardList size={16} /> Exams from teachers
      </button>
      <button type="button" role="tab" aria-selected={view === "byClass"} className={view === "byClass" ? "on" : ""} onClick={() => setView("byClass")}>
        <Trophy size={16} /> Results by class
      </button>
    </div>
  );

  if (view === "byClass") {
    return (
      <div className="stack">
        {tabs}
        <ClassResults exams={exams.filter((e) => e.status !== "uploading")} students={students} />
      </div>
    );
  }

  return (
    <div className="stack">
      {tabs}
      <div className="ex-flow">
        <div><b>1</b><span><strong>Macallinka</strong> ayaa soo diraya exam-ka (fasalkiisa + maadadiisa)</span></div>
        <div><b>2</b><span>Kadib wuxuu soo gudbiyaa <strong>natiijada exam-kaas</strong> oo keliya</span></div>
        <div><b>3</b><span><strong>Admin-ka</strong> ayaa halkan ka arka, soo dejiya ama daabaca</span></div>
      </div>

      <div className="stat-grid">
        {tiles.map((t) => (
          <button
            key={t.key || "all"}
            type="button"
            className={`stat-card tone-${t.tone} ${statusFilter === t.key ? "selected" : ""}`}
            onClick={() => setStatusFilter(t.key)}
          >
            <span className="stat-icon"><t.Icon size={20} /></span>
            <span className="stat-label">{t.label}<em>{t.so}</em></span>
            <strong className="stat-value">{t.n}</strong>
          </button>
        ))}
      </div>

      {note && <p className="banner banner-green" style={{ margin: 0 }}>{note}</p>}
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}

      <div className="panel">
        <div className="section-head">
          <div>
            <h2>Exams from teachers ({shownExams.length})</h2>
            <p className="muted-sm">Live — exam cusub ama natiijo cusub isla markiiba halkan ayay ka soo muuqdaan.</p>
          </div>
        </div>

        <div className="filter-bar" style={{ marginBottom: 14 }}>
          <div className="search-box">
            <Search size={16} />
            <input placeholder="Search exam, class, subject or teacher" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">All classes</option>
            {examClasses.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
            <option value="">All teachers</option>
            {examTeachers.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="muted">Loading...</p>
        ) : shownExams.length === 0 ? (
          <div className="empty">
            <ClipboardList size={34} />
            <strong>{exams.length ? "No exams match" : "Weli exam lama soo dirin"}</strong>
            <span>Macallimiintu waxay exam-ka ka soo diraan Teacher Portal → Exams &amp; Results → Send exam.</span>
          </div>
        ) : (
          <div className="ex-list">
            {shownExams.map((ex) => {
              const status = examStatus(ex);
              const st = EXAM_STATUS[status];
              const n = studentsInGroup(students, ex.classGroup).length;
              const graded = Math.max(0, ...Object.values(ex.submissions || {}).map((x) => Number(x.count) || 0));
              return (
                <div key={ex.id} className={`ex-item tone-${st.tone}`}>
                  <div className="ex-item-main">
                    <div className="ex-item-title">
                      <strong>{ex.title}</strong>
                      <span className={`pill pill-sm pill-${st.tone}`}><span className="pill-dot" />{st.label}</span>
                    </div>
                    <div className="ex-item-meta">
                      <span className="tag tag-soft">{ex.classGroup}</span>
                      {(ex.subjects || []).map((s) => (
                        <span key={s.name} className="tag">{s.name} /{s.maxMark}</span>
                      ))}
                      <PaperButtons exam={ex} compact />
                    </div>
                    <div className="ex-item-sub">
                      <span><UserRound size={13} /> {senderOf(ex)}</span>
                      {ex.examDate && <span><CalendarDays size={13} /> {formatDate(ex.examDate)}</span>}
                      {ex.term && <span>{ex.term}</span>}
                      <span><Users size={13} /> {status === "sent" ? `${n} students` : `${graded}/${n} graded`}</span>
                      {sentText(ex) && <span className="muted-sm">Sent {sentText(ex)}</span>}
                    </div>
                    {ex.note && <p className="ex-item-note">“{ex.note}”</p>}
                  </div>
                  <div className="ex-item-actions">
                    <button
                      type="button"
                      className={`btn btn-sm ${status === "sent" ? "btn-light" : "btn-primary"}`}
                      onClick={() => setSelectedId(ex.id)}
                    >
                      <Trophy size={14} /> {status === "sent" ? "Open" : "View results"}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDelete(ex)} title="Delete exam">
                      <Trash2 size={14} />
                    </button>
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

  // Maado kasta: macallinka exam-ka diray iyo in natiijada la gudbiyay
  const sender = senderOf(exam);
  const subjectStatus = (exam.subjects || []).map((sub) => ({
    name: sub.name,
    done: exam.submissions?.[sub.name],
  }));

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
              <span><UserRound size={13} /> {sender}</span>
              <PaperButtons exam={exam} />
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
              <Save size={16} /> {saving ? "Saving..." : "Save corrections"}
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
                  ? `Results submitted by ${s.done.teacherName || sender} • ${s.done.count ?? "?"}/${s.done.total ?? "?"}`
                  : `Exam sent by ${sender} — waiting for results`}
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
          Meelaha banaan lama tiriyo. Kaalinta (rank) waxaa la xisaabiyaa marka la keydiyo. Marka macallinku natiijada
          gudbiyo halkan si toos ah ayay ugu soo dhacaysaa; admin-ku wuu sixi karaa haddii loo baahdo.
        </p>
      </div>
    </div>
  );
}