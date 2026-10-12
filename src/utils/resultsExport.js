// src/utils/resultsExport.js
//
// Natiijooyinka fasalka (hal exam) — Download (Excel/CSV) iyo Print.
// rows = [{ studentId, studentName, marks, total, maxTotal, percent, grade, rank, classSize }]

import { computeResult } from "./exams";
import { formatDate } from "./attendance";

// Ardayda fasalka + natiijooyinka la keydiyay -> safaf la daabici karo
// (rank-ga ayaa lagu kala horreysiiyaa; ardayda aan dhibco lahayn dambe).
export function buildResultRows(exam, students, results) {
  const byId = Object.fromEntries(results.map((r) => [String(r.studentId), r]));
  const ids = new Set([...students.map((s) => String(s.studentId)), ...results.map((r) => String(r.studentId))]);
  const nameById = Object.fromEntries(students.map((s) => [String(s.studentId), s.fullName || ""]));

  const rows = [...ids].map((sid) => {
    const saved = byId[sid];
    const marks = saved?.marks || {};
    const live = computeResult(exam, marks);
    return {
      studentId: sid,
      studentName: nameById[sid] || saved?.studentName || "",
      marks,
      total: live.total,
      maxTotal: live.maxTotal,
      percent: live.percent,
      grade: live.grade,
      filled: live.filled,
      rank: saved?.rank || null,
      classSize: saved?.classSize || null,
    };
  });

  return rows.sort((a, b) => {
    if (a.rank && b.rank) return a.rank - b.rank;
    if (a.rank) return -1;
    if (b.rank) return 1;
    return a.studentId.localeCompare(b.studentId, undefined, { numeric: true });
  });
}

const markText = (v) => (v === null || v === undefined || v === "" ? "" : String(v));

function safeName(text) {
  return String(text || "results").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
}

export function downloadResultsCsv(exam, rows) {
  const subjects = exam.subjects || [];
  const header = [
    "Rank",
    "Student ID",
    "Student Name",
    ...subjects.map((s) => `${s.name} (/${s.maxMark})`),
    "Total",
    "Max",
    "Percent",
    "Grade",
  ];
  const lines = rows.map((r) => [
    r.rank || "",
    r.studentId,
    r.studentName,
    ...subjects.map((s) => markText(r.marks?.[s.name])),
    r.filled ? r.total : "",
    r.filled ? r.maxTotal : "",
    r.filled ? `${r.percent}%` : "",
    r.grade || "",
  ]);

  const esc = (v) => {
    const t = String(v ?? "");
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const title = [`${exam.title || "Exam"} — ${exam.classGroup || ""}${exam.term ? ` — ${exam.term}` : ""}`];
  const csv = [title, [], header, ...lines].map((row) => row.map(esc).join(",")).join("\r\n");

  // BOM -> Excel wuxuu si sax ah u akhriyaa xarfaha
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName(exam.title)}_${safeName(exam.classGroup)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const html = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function printResults(exam, rows) {
  const subjects = exam.subjects || [];
  const submissions = exam.submissions || {};
  const w = window.open("", "_blank");
  if (!w) {
    window.alert("Browser-ku wuu xannibay daaqadda print-ka. Fadlan u ogolow pop-ups.");
    return;
  }

  const body = rows
    .map(
      (r, i) => `<tr>
        <td>${r.rank || "—"}</td>
        <td>${html(r.studentId)}</td>
        <td class="name">${html(r.studentName)}</td>
        ${subjects.map((s) => `<td>${html(markText(r.marks?.[s.name])) || "—"}</td>`).join("")}
        <td><b>${r.filled ? `${r.total}/${r.maxTotal}` : "—"}</b></td>
        <td>${r.filled ? `${r.percent}%` : "—"}</td>
        <td><b>${html(r.grade) || "—"}</b></td>
      </tr>`
    )
    .join("");

  const teacherLine = subjects
    .map((s) => `${html(s.name)}: ${submissions[s.name]?.teacherName ? html(submissions[s.name].teacherName) : "—"}`)
    .join(" &nbsp;·&nbsp; ");

  w.document.write(`<!doctype html><html><head><meta charset="utf-8">
  <title>${html(exam.title)} — ${html(exam.classGroup)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; }
    .head { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #15803d; padding-bottom: 10px; margin-bottom: 12px; }
    .head img { width: 54px; height: 54px; object-fit: contain; }
    h1 { margin: 0; font-size: 20px; }
    h2 { margin: 2px 0 0; font-size: 15px; font-weight: 600; color: #334155; }
    .meta { font-size: 12px; color: #475569; margin: 4px 0 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 5px; text-align: center; }
    th { background: #f0fdf4; }
    td.name { text-align: left; }
    tr:nth-child(even) td { background: #f8fafc; }
    .foot { margin-top: 26px; display: flex; justify-content: space-between; font-size: 12px; }
    .sign { border-top: 1px solid #0f172a; padding-top: 4px; width: 200px; text-align: center; }
  </style></head><body>
    <div class="head">
      <img src="${window.location.origin}/logo.png" alt="">
      <div>
        <h1>Rising Star School</h1>
        <h2>${html(exam.title)} — ${html(exam.classGroup)}</h2>
        <p class="meta">${exam.term ? `${html(exam.term)} · ` : ""}${exam.examDate ? html(formatDate(exam.examDate)) + " · " : ""}${rows.length} students</p>
        <p class="meta">${teacherLine}</p>
      </div>
    </div>
    <table>
      <thead><tr>
        <th>Rank</th><th>ID</th><th>Student</th>
        ${subjects.map((s) => `<th>${html(s.name)}<br>/${html(s.maxMark)}</th>`).join("")}
        <th>Total</th><th>%</th><th>Grade</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
    <div class="foot">
      <span>Printed ${html(new Date().toLocaleDateString("en-GB"))}</span>
      <span class="sign">Admin signature</span>
    </div>
    <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
  </body></html>`);
  w.document.close();
}