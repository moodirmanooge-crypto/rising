// src/utils/paperPrint.js
//
// Warqadda exam-ka: Print (PDF, si toos ah) · Open · Download (Word / PDF).
// Faylku wuxuu ku jiri karaa Firebase Storage ama Firestore (qaybo) — loadPaperBlob
// ayaa labadaba soo dejiya. Blob-ka (isla origin) → iframe → print() isla markiiba.

import { loadPaperBlob } from "./exams";

const paperUrlOf = (exam) => exam?.paperUrl || exam?.paperPdfUrl || exam?.paperWordUrl || "";

export const paperKind = (exam) =>
  exam?.paperKind ||
  (exam?.paperPdfUrl || /\.pdf$/i.test(exam?.paperName || "") ? "pdf" : exam?.paperWordUrl || /\.docx?$/i.test(exam?.paperName || "") ? "word" : "");

export const hasPaper = (exam) => exam?.paperStore === "firestore" || !!paperUrlOf(exam);

async function blobUrl(exam) {
  const blob = await loadPaperBlob(exam);
  return URL.createObjectURL(blob);
}

function printUrl(url, title) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  frame.title = title || "Exam paper";
  frame.src = url;
  frame.onload = () => {
    setTimeout(() => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch {
        window.open(url, "_blank");
      }
      setTimeout(() => frame.remove(), 60_000);
    }, 400);
  };
  document.body.appendChild(frame);
}

// PDF → daaqadda print-ka isla markiiba
export async function printExamPaper(exam) {
  try {
    const url = await blobUrl(exam);
    printUrl(url, exam.title);
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  } catch {
    const url = paperUrlOf(exam);
    if (url) window.open(url, "_blank", "noopener");
    else window.alert("Warqadda exam-ka lama soo dejin karin.");
  }
}

// PDF → tab cusub
export async function openExamPaper(exam) {
  const w = window.open("", "_blank");
  try {
    const url = await blobUrl(exam);
    if (w) w.location.href = url;
    else window.open(url, "_blank");
  } catch {
    const url = paperUrlOf(exam);
    if (url && w) w.location.href = url;
    else {
      w?.close();
      window.alert("Warqadda exam-ka lama furi karin.");
    }
  }
}

// Word / PDF → soo deji (magaciisa saxda ah)
export async function downloadExamPaper(exam) {
  const name = exam.paperName || exam.paperWordName || exam.paperPdfName || `${exam.title || "exam"}.${paperKind(exam) === "pdf" ? "pdf" : "docx"}`;
  try {
    const url = await blobUrl(exam);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } catch {
    const url = paperUrlOf(exam);
    if (url) window.open(url, "_blank", "noopener");
    else window.alert("Warqadda exam-ka lama soo dejin karin.");
  }
}