// src/components/ClassResults.jsx
//
// Admin → Exams & Results → "Results by class"
// ------------------------------------------------------------------
// Fasal dooro (ama exam gaar ah, tusaale "Monthly One") → natiijada fasalka
// oo dhan hal shax: arday kasta, exam/maado kasta dhibcihiisa, Total, %,
// Grade iyo Rank. Print → warqad A4 (portrait; tiirar badan → landscape)
// si toos ah, iyo Download (Excel / CSV).
// ------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import { Download, Printer, Trophy, Users, ClipboardList, BarChart3, Medal } from "lucide-react";
import { CLASS_GROUP_SECTIONS, studentBelongsToGroup } from "../config/schoolOptions";
import { gradeFor, gradeTone, subscribeExamResults } from "../utils/exams";
import { sameGroup } from "../utils/teacherClasses";
import { formatDate } from "../utils/attendance";
import { initials } from "./PortalLayout";

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const hasMark = (v) => v !== "" && v !== null && v !== undefined && !isNaN(Number(v));

function buildReport(exams, resultsByExam, students) {
  const columns = exams.flatMap((ex) =>
    (ex.subjects || []).map((s) => ({
      key: `${ex.id}|${s.name}`,
      examId: ex.id,
      title: ex.title,
      subject: s.name,
      max: Number(s.maxMark) || 0,
      date: ex.examDate || "",
    }))
  );

  const names = {};
  students.forEach((s) => (names[String(s.studentId)] = s.fullName || ""));
  const ids = new Set(students.map((s) => String(s.studentId)));
  const marksBy = {}; // sid -> { colKey: mark }
  exams.forEach((ex) => {
    (resultsByExam[ex.id] || []).forEach((r) => {
      const sid = String(r.studentId);
      ids.add(sid);
      if (!names[sid]) names[sid] = r.studentName || "";
      (ex.subjects || []).forEach((s) => {
        const m = r.marks?.[s.name];
        if (hasMark(m)) (marksBy[sid] = marksBy[sid] || {})[`${ex.id}|${s.name}`] = Number(m);
      });
    });
  });

  const rows = [...ids].map((sid) => {
    let total = 0;
    let maxTotal = 0;
    let filled = 0;
    columns.forEach((c) => {
      const m = marksBy[sid]?.[c.key];
      if (m === undefined) return;
      total += m;
      maxTotal += c.max;
      filled += 1;
    });
    const percent = maxTotal ? Math.round((total / maxTotal) * 1000) / 10 : 0;
    return {
      studentId: sid,
      name: names[sid] || "",
      marks: marksBy[sid] || {},
      total: Math.round(total * 100) / 100,
      maxTotal,
      filled,
      percent,
      grade: filled ? gradeFor(percent) : "",
      rank: null,
    };
  });

  // Rank: boqolkiiba ugu sarreeya → 1 (isku mid → isku rank)
  const ranked = rows.filter((r) => r.filled).sort((a, b) => b.percent - a.percent || b.total - a.total);
  ranked.forEach((r, i) => {
    const prev = ranked[i - 1];
    r.rank = prev && prev.percent === r.percent && prev.total === r.total ? prev.rank : i + 1;
  });
  rows.sort((a, b) => {
    if (a.rank && b.rank) return a.rank - b.rank;
    if (a.rank) return -1;
    if (b.rank) return 1;
    return a.studentId.localeCompare(b.studentId, undefined, { numeric: true });
  });

  const graded = rows.filter((r) => r.filled);
  const avg = graded.length ? Math.round((graded.reduce((n, r) => n + r.percent, 0) / graded.length) * 10) / 10 : 0;
  const pass = graded.filter((r) => r.percent >= 50).length;
  return { columns, rows, graded: graded.length, avg, pass };
}

function printReport({ classLabel, examLabel, report, exams }) {
  const { columns, rows } = report;
  const landscape = columns.length > 5;
  const w = window.open("", "_blank");
  if (!w) {
    window.alert("Browser-ku wuu xannibay daaqadda print-ka. Fadlan u ogolow pop-ups.");
    return;
  }
  const head = columns
    .map((c) => `<th>${examLabel ? "" : `<small>${esc(c.title)}</small><br>`}${esc(c.subject)}<br><small>/${esc(c.max)}</small></th>`)
    .join("");
  const body = rows
    .map(
      (r) => `<tr>
        <td>${r.rank || "—"}</td>
        <td>${esc(r.studentId)}</td>
        <td class="name">${esc(r.name)}</td>
        ${columns.map((c) => `<td>${r.marks[c.key] ?? "—"}</td>`).join("")}
        <td><b>${r.filled ? `${r.total}/${r.maxTotal}` : "—"}</b></td>
        <td>${r.filled ? `${r.percent}%` : "—"}</td>
        <td><b>${esc(r.grade) || "—"}</b></td>
      </tr>`
    )
    .join("");
  const teachers = [...new Set(exams.map((e) => e.teacherName || e.createdBy).filter(Boolean))].join(", ");
  const terms = [...new Set(exams.map((e) => e.term).filter(Boolean))].join(", ");

  w.document.write(`<!doctype html><html><head><meta charset="utf-8">
  <title>Results — ${esc(classLabel)}${examLabel ? ` — ${esc(examLabel)}` : ""}</title>
  <style>
    @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .head { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #15803d; padding-bottom: 10px; margin-bottom: 12px; }
    .head img { width: 58px; height: 58px; object-fit: contain; }
    h1 { margin: 0; font-size: 21px; letter-spacing: .02em; }
    h2 { margin: 3px 0 0; font-size: 15px; font-weight: 700; color: #166534; }
    .meta { font-size: 11.5px; color: #475569; margin: 3px 0 0; }
    .sum { display: flex; gap: 8px; margin: 0 0 10px; }
    .sum div { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; font-size: 11px; color: #475569; }
    .sum b { display: block; font-size: 15px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: ${columns.length > 9 ? 10 : 11.5}px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 4px; text-align: center; }
    th { background: #f0fdf4; font-size: 11px; }
    th small { font-weight: 500; color: #475569; }
    td.name { text-align: left; white-space: nowrap; }
    tr:nth-child(even) td { background: #f8fafc; }
    tr { page-break-inside: avoid; }
    .foot { margin-top: 30px; display: flex; justify-content: space-between; font-size: 12px; gap: 20px; }
    .sign { border-top: 1px solid #0f172a; padding-top: 4px; width: 190px; text-align: center; }
  </style></head><body>
    <div class="head">
      <img src="${window.location.origin}/logo.png" alt="">
      <div>
        <h1>RISING STAR SCHOOL</h1>
        <h2>Natiijada Fasalka — ${esc(classLabel)}${examLabel ? ` · ${esc(examLabel)}` : ""}</h2>
        <p class="meta">${terms ? `${esc(terms)} · ` : ""}${exams.length} exam · ${rows.length} arday${teachers ? ` · Macallin: ${esc(teachers)}` : ""}</p>
      </div>
    </div>
    <div class="sum">
      <div>Ardayda<b>${rows.length}</b></div>
      <div>La saxay<b>${report.graded}</b></div>
      <div>Celceliska fasalka<b>${report.avg}%</b></div>
      <div>Gudbay (≥50%)<b>${report.pass}</b></div>
    </div>
    <table>
      <thead><tr><th>Rank</th><th>ID</th><th>Magaca ardayga</th>${head}<th>Total</th><th>%</th><th>Grade</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
    <div class="foot">
      <span>Printed ${esc(new Date().toLocaleDateString("en-GB"))}</span>
      <span class="sign">Macallinka fasalka</span>
      <span class="sign">Maamulka (Admin)</span>
    </div>
    <script>window.onload = function () { setTimeout(function () { window.print(); }, 350); };</script>
  </body></html>`);
  w.document.close();
}

function downloadCsv({ classLabel, examLabel, report }) {
  const { columns, rows } = report;
  const header = ["Rank", "ID", "Student", ...columns.map((c) => `${examLabel ? "" : `${c.title} - `}${c.subject} (/${c.max})`), "Total", "Max", "%", "Grade"];
  const lines = rows.map((r) => [
    r.rank || "",
    r.studentId,
    r.name,
    ...columns.map((c) => r.marks[c.key] ?? ""),
    r.filled ? r.total : "",
    r.filled ? r.maxTotal : "",
    r.filled ? r.percent : "",
    r.grade,
  ]);
  const csv = [header, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Results_${classLabel}${examLabel ? `_${examLabel}` : ""}.csv`.replace(/[^\w.-]+/g, "_");
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 20000);
}

export default function ClassResults({ exams = [], students = [] }) {
  const examsByClass = useMemo(() => {
    const m = {};
    CLASS_GROUP_SECTIONS.forEach((sec) =>
      sec.groups.forEach((g) => (m[g] = exams.filter((e) => e.classGroup && sameGroup(e.classGroup, g))))
    );
    return m;
  }, [exams]);

  const firstWithExams = CLASS_GROUP_SECTIONS.flatMap((s) => s.groups).find((g) => examsByClass[g]?.length) || "";
  const [cls, setCls] = useState("");
  const [title, setTitle] = useState("");
  const classLabel = cls || firstWithExams;

  const classExams = useMemo(() => {
    const list = (examsByClass[classLabel] || []).slice();
    list.sort((a, b) => String(a.examDate || "").localeCompare(String(b.examDate || "")) || String(a.title).localeCompare(String(b.title)));
    return list;
  }, [examsByClass, classLabel]);
  const titles = [...new Set(classExams.map((e) => e.title))];
  const shownExams = title ? classExams.filter((e) => e.title === title) : classExams;

  // Natiijooyinka exam kasta (live)
  const [resultsByExam, setResultsByExam] = useState({});
  const idsKey = shownExams.map((e) => e.id).join(",");
  useEffect(() => {
    const unsubs = shownExams.map((ex) =>
      subscribeExamResults(
        ex.id,
        (list) => setResultsByExam((prev) => ({ ...prev, [ex.id]: list })),
        () => {}
      )
    );
    return () => unsubs.forEach((u) => u && u());
  }, [idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const classStudents = useMemo(
    () => (classLabel ? students.filter((s) => studentBelongsToGroup(s, classLabel)) : []),
    [students, classLabel]
  );
  const report = useMemo(
    () => buildReport(shownExams, resultsByExam, classStudents),
    [shownExams, resultsByExam, classStudents]
  );
  const top = report.rows.find((r) => r.rank === 1);
  const loading = shownExams.some((e) => !resultsByExam[e.id]);

  return (
    <div className="stack">
      <div className="panel cr-controls">
        <label>
          Fasalka
          <select
            value={classLabel}
            onChange={(e) => {
              setCls(e.target.value);
              setTitle("");
            }}
          >
            {!classLabel && <option value="">— Dooro fasal —</option>}
            {CLASS_GROUP_SECTIONS.map((sec) => (
              <optgroup key={sec.id} label={sec.label}>
                {sec.groups.map((g) => (
                  <option key={g} value={g}>
                    {g} {examsByClass[g]?.length ? `(${examsByClass[g].length} exam)` : "— exam ma jiro"}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          Exam
          <select value={title} onChange={(e) => setTitle(e.target.value)} disabled={!classExams.length}>
            <option value="">Dhammaan exam-yada ({classExams.length})</option>
            {titles.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <div className="cr-actions">
          <button
            type="button"
            className="btn btn-light"
            disabled={!report.rows.length || !shownExams.length}
            onClick={() => downloadCsv({ classLabel, examLabel: title, report })}
          >
            <Download size={16} /> Excel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!report.rows.length || !shownExams.length}
            onClick={() => printReport({ classLabel, examLabel: title, report, exams: shownExams })}
          >
            <Printer size={16} /> Print A4
          </button>
        </div>
      </div>

      {!classLabel || !shownExams.length ? (
        <div className="panel">
          <div className="empty">
            <ClipboardList size={34} />
            <strong>{classLabel ? `${classLabel}: exam weli lama soo dirin` : "Weli exam lama soo dirin"}</strong>
            <span>Marka macallinku exam soo diro oo natiijada gudbiyo, halkan ayay ka soo muuqanaysaa.</span>
          </div>
        </div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card tone-blue"><span className="stat-icon"><Users size={20} /></span><span className="stat-label">Ardayda<em>{report.graded} la saxay</em></span><strong className="stat-value">{report.rows.length}</strong></div>
            <div className="stat-card tone-violet"><span className="stat-icon"><ClipboardList size={20} /></span><span className="stat-label">Exams · maado<em>{report.columns.length} tiir</em></span><strong className="stat-value">{shownExams.length}</strong></div>
            <div className="stat-card tone-green"><span className="stat-icon"><BarChart3 size={20} /></span><span className="stat-label">Celceliska<em>{report.pass} gudbay (≥50%)</em></span><strong className="stat-value">{report.avg}%</strong></div>
            <div className="stat-card tone-amber"><span className="stat-icon"><Medal size={20} /></span><span className="stat-label">Kaalinta 1aad<em>{top ? `${top.percent}%` : "—"}</em></span><strong className="stat-value cr-top">{top ? top.name : "—"}</strong></div>
          </div>

          <div className="panel">
            <div className="section-head">
              <div>
                <h2>{classLabel}{title ? ` — ${title}` : ""}</h2>
                <p className="muted-sm">
                  {loading ? "Natiijada waa la soo rarayaa…" : "Live — marka macallinku natiijo gudbiyo halkan ayay isla markiiba ka muuqataa."}
                </p>
              </div>
            </div>
            <div className="table-wrap cr-table-wrap">
              <table className="cr-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th className="cr-name">Student</th>
                    {report.columns.map((c) => (
                      <th key={c.key}>
                        {!title && <small>{c.title}</small>}
                        <span>{c.subject}</span>
                        <small>/{c.max}{c.date ? ` · ${formatDate(c.date)}` : ""}</small>
                      </th>
                    ))}
                    <th>Total</th>
                    <th>%</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr key={r.studentId} className={r.rank && r.rank <= 3 ? `cr-top${r.rank}` : ""}>
                      <td className="cr-rank">{r.rank ? (r.rank <= 3 ? <Trophy size={14} /> : null) : null}{r.rank || "—"}</td>
                      <td className="cr-name">
                        <span className="avatar avatar-placeholder cr-avatar">{initials(r.name)}</span>
                        <span>
                          <strong>{r.name || "—"}</strong>
                          <small>ID {r.studentId}</small>
                        </span>
                      </td>
                      {report.columns.map((c) => (
                        <td key={c.key}>{r.marks[c.key] ?? <span className="muted">—</span>}</td>
                      ))}
                      <td><b>{r.filled ? `${r.total}/${r.maxTotal}` : "—"}</b></td>
                      <td>{r.filled ? `${r.percent}%` : "—"}</td>
                      <td>{r.grade ? <span className={`pill pill-${gradeTone(r.grade)}`}>{r.grade}</span> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}