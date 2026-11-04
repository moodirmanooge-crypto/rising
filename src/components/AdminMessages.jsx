// src/components/AdminMessages.jsx
//
// Admin → Messages
// ------------------------------------------------------------------
// Fariin kasta = exam macallin soo diray (iyo marka natiijo la gudbiyo).
// Fariinta: macallinka, fasalka, maadada, nooca (Term / Final), qoraalka
// macallinka, waqtiga — iyo warqadda exam-ka:
//   PDF  → 🖨 Print (si toos ah printer-ka) · Fur · Download
//   Word → Download (Word-ka browser-ku si toos ah uma daabici karo)
// Fariimaha aan la akhrin waxay leeyihiin calaamad "Cusub".
// ------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import {
  Inbox, Printer, FileText, Download, Search, CheckCircle2, Send, Clock, Trophy, Mail, MailOpen,
} from "lucide-react";
import { EXAM_STATUS, examStatus } from "../utils/exams";
import { printExamPaper, openExamPaper, downloadExamPaper, paperKind, hasPaper } from "../utils/paperPrint";
import { initials } from "./PortalLayout";
import { formatDate } from "../utils/attendance";

export const MSG_READ_KEY = "rss_admin_msgs_read";
const ms = (ts) => (ts?.toMillis ? ts.toMillis() : ts?.seconds ? ts.seconds * 1000 : 0);

export function readMark() {
  try {
    return Number(localStorage.getItem(MSG_READ_KEY)) || 0;
  } catch {
    return 0;
  }
}
export function setReadMark(v) {
  try {
    localStorage.setItem(MSG_READ_KEY, String(v));
  } catch {
    /* ignore */
  }
}

// Exam-yada → fariimo (exam la diray + natiijo la gudbiyay), kuwa ugu cusub kor
export function buildMessages(exams = []) {
  const out = [];
  exams.forEach((e) => {
    if (e.status === "uploading") return;
    const sentAt = Math.max(ms(e.sentAt), ms(e.createdAt));
    out.push({ id: `${e.id}:sent`, kind: "sent", exam: e, at: sentAt });
    Object.entries(e.submissions || {}).forEach(([subject, sub]) => {
      out.push({ id: `${e.id}:res:${subject}`, kind: "results", exam: e, subject, sub, at: ms(sub?.submittedAt) || sentAt });
    });
  });
  return out.sort((a, b) => b.at - a.at);
}

function whenText(t) {
  if (!t) return "";
  const d = new Date(t);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Maanta ${time}`;
  if (d.toDateString() === y.toDateString()) return `Shalay ${time}`;
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ${time}`;
}

function PaperActions({ exam }) {
  const [busy, setBusy] = useState("");
  if (!hasPaper(exam)) return <span className="msg-nopaper">Warqad lama soo gelin</span>;
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
    <div className={`msg-file ${kind}`}>
      <span className="msg-file-ico">{kind === "pdf" ? "PDF" : "W"}</span>
      <div className="msg-file-name">
        <strong>{exam.paperName || exam.paperPdfName || exam.paperWordName || (kind === "pdf" ? "exam.pdf" : "exam.docx")}</strong>
        <small>{kind === "pdf" ? "PDF" : "Word"}{exam.paperSize ? ` · ${(exam.paperSize / 1024 / 1024).toFixed(2)} MB` : ""}</small>
      </div>
      <div className="msg-file-actions">
        {kind === "pdf" && (
          <button type="button" className="msg-print" disabled={!!busy} onClick={() => run("print", printExamPaper)}>
            <Printer size={16} /> {busy === "print" ? "Diyaarinaya…" : "Print"}
          </button>
        )}
        {kind === "pdf" && (
          <button type="button" className="btn btn-light btn-sm" disabled={!!busy} onClick={() => run("open", openExamPaper)}>
            <FileText size={14} /> Fur
          </button>
        )}
        <button type="button" className="btn btn-light btn-sm" disabled={!!busy} onClick={() => run("dl", downloadExamPaper)}>
          <Download size={14} /> {busy === "dl" ? "…" : "Download"}
        </button>
      </div>
    </div>
  );
}

export default function AdminMessages({ exams = [], onOpenExams, onRead }) {
  const [lastRead] = useState(readMark); // calaamadda "Cusub" ha sii jirto inta bogga la joogo
  const [filter, setFilter] = useState("all"); // all | sent | results | unread
  const [teacher, setTeacher] = useState("");
  const [q, setQ] = useState("");

  const messages = useMemo(() => buildMessages(exams), [exams]);

  // Bogga la furay → dhammaan waa la akhriyay
  useEffect(() => {
    const newest = messages[0]?.at || Date.now();
    setReadMark(Math.max(newest, Date.now()));
    onRead?.();
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const teachers = [...new Set(messages.map((m) => m.exam.teacherName || m.exam.createdBy).filter(Boolean))].sort();
  const query = q.trim().toLowerCase();
  const shown = messages.filter((m) => {
    if (filter === "sent" && m.kind !== "sent") return false;
    if (filter === "results" && m.kind !== "results") return false;
    if (filter === "unread" && !(m.at > lastRead)) return false;
    if (teacher && (m.exam.teacherName || m.exam.createdBy) !== teacher) return false;
    if (query) {
      const hay = [m.exam.teacherName, m.exam.title, m.exam.classGroup, m.exam.note, ...(m.exam.subjects || []).map((s) => s.name)]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
  const unread = messages.filter((m) => m.at > lastRead).length;
  const pdfCount = messages.filter((m) => m.kind === "sent" && paperKind(m.exam) === "pdf").length;

  return (
    <div className="stack">
      <div className="msg-hero">
        <span className="msg-hero-ico"><Inbox size={26} /></span>
        <div>
          <strong>Fariimaha macallimiinta</strong>
          <span>Exam kasta oo macallin soo diro iyo natiijo kasta oo la gudbiyo halkan ayay ku soo dhacaan — live.</span>
        </div>
        <div className="msg-hero-stats">
          <div><b>{messages.filter((m) => m.kind === "sent").length}</b><span>Exams</span></div>
          <div><b>{pdfCount}</b><span>PDF (Print)</span></div>
          <div><b>{unread}</b><span>Cusub</span></div>
        </div>
      </div>

      <div className="panel msg-filters">
        <div className="msg-tabs" role="tablist">
          {[
            ["all", "Dhammaan", Mail],
            ["unread", `Cusub${unread ? ` (${unread})` : ""}`, MailOpen],
            ["sent", "Exam la diray", Send],
            ["results", "Natiijo", Trophy],
          ].map(([key, label, Icon]) => (
            <button key={key} type="button" className={filter === key ? "on" : ""} onClick={() => setFilter(key)}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <select value={teacher} onChange={(e) => setTeacher(e.target.value)}>
          <option value="">Dhammaan macallimiinta</option>
          {teachers.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <div className="search-box">
          <Search size={16} />
          <input placeholder="Raadi macallin, fasal, maado…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="panel empty">
          <Inbox size={34} />
          <strong>{messages.length ? "Fariin lama helin" : "Weli fariin ma jirto"}</strong>
          <span>Marka macallin exam soo diro, halkan ayay ka soo muuqan doontaa.</span>
        </div>
      ) : (
        <div className="msg-list">
          {shown.map((m) => {
            const e = m.exam;
            const name = e.teacherName || e.createdBy || "Macallin";
            const isNew = m.at > lastRead;
            const st = EXAM_STATUS[examStatus(e)];
            const subj = (e.subjects || []).map((s) => `${s.name} /${s.maxMark}`).join(" · ");
            return (
              <article key={m.id} className={`msg ${m.kind} ${isNew ? "new" : ""}`}>
                <span className="msg-avatar">{initials(name)}</span>
                <div className="msg-body">
                  <div className="msg-head">
                    <strong>{name}</strong>
                    {isNew && <span className="msg-new">Cusub</span>}
                    <span className="msg-time"><Clock size={12} /> {whenText(m.at)}</span>
                  </div>
                  {m.kind === "sent" ? (
                    <>
                      <p className="msg-text">
                        Wuxuu soo diray <b>{e.title || "exam"}</b> — <b>{e.classGroup}</b>
                        {subj ? <> · {subj}</> : null}
                        {e.examDate ? <> · {formatDate(e.examDate)}</> : null}
                      </p>
                      {e.note && <p className="msg-note">“{e.note}”</p>}
                      <PaperActions exam={e} />
                      <div className="msg-foot">
                        <span className={`pill pill-sm pill-${st.tone}`}><span className="pill-dot" />{st.label}</span>
                        <button type="button" className="msg-link" onClick={onOpenExams}>Natiijada eeg →</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="msg-text">
                        <CheckCircle2 size={15} className="msg-ok" /> Wuxuu gudbiyay natiijada <b>{e.title || "exam"}</b> —{" "}
                        <b>{e.classGroup}</b> · {m.subject}
                        {m.sub?.count != null ? <> · {m.sub.count}/{m.sub.total ?? "?"} arday</> : null}
                      </p>
                      <div className="msg-foot">
                        <button type="button" className="msg-link" onClick={onOpenExams}>Natiijada eeg / daabac →</button>
                      </div>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}