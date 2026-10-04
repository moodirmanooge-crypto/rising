// src/utils/exams.js
//
// IMTIXAANNADA (Exams) iyo NATIIJOOYINKA (Results)
//  • rssExams/{examId}            — exam-ka: magaca, fasalka (classGroup),
//                                   maadooyinka iyo dhibcaha ugu badan
//  • rssExamResults/{examId_sid}  — natiijada arday kasta: dhibcaha maado
//                                   kasta, total, %, grade iyo kaalinta (rank)
// Admin-ka ayaa sameeya exam-ka oo geliya natiijooyinka; arday kasta wuxuu
// natiijadiisa ku arkaa Student Portal-kiisa (live).

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { EXAMS_COLLECTION, EXAM_RESULTS_COLLECTION } from "../config/collections";

export const DEFAULT_MAX_MARK = 100;

// Grade-ka boqolleyda (%)
export function gradeFor(percent) {
  const p = Number(percent) || 0;
  if (p >= 90) return "A";
  if (p >= 80) return "B";
  if (p >= 70) return "C";
  if (p >= 60) return "D";
  if (p >= 50) return "E";
  return "F";
}

export function gradeTone(grade) {
  return { A: "green", B: "green", C: "blue", D: "amber", E: "amber", F: "red" }[grade] || "gray";
}

export const resultDocId = (examId, studentId) => `${examId}_${studentId}`;

// marks = { [subject]: number|"" } — kaliya maadooyinka la buuxiyay ayaa la tiriyaa
export function computeResult(exam, marks) {
  let total = 0;
  let maxTotal = 0;
  let filled = 0;
  (exam.subjects || []).forEach((s) => {
    const raw = marks?.[s.name];
    if (raw === "" || raw === null || raw === undefined || isNaN(Number(raw))) return;
    total += Number(raw);
    maxTotal += Number(s.maxMark) || DEFAULT_MAX_MARK;
    filled += 1;
  });
  const percent = maxTotal ? Math.round((total / maxTotal) * 1000) / 10 : 0;
  return { total, maxTotal, filled, percent, grade: filled ? gradeFor(percent) : "" };
}

export function subscribeExams(onData, onError) {
  return onSnapshot(
    collection(db, EXAMS_COLLECTION),
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      onData(list);
    },
    onError
  );
}

export function subscribeExamResults(examId, onData, onError) {
  return onSnapshot(
    query(collection(db, EXAM_RESULTS_COLLECTION), where("examId", "==", examId)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export function subscribeStudentResults(studentId, onData, onError) {
  return onSnapshot(
    query(collection(db, EXAM_RESULTS_COLLECTION), where("studentId", "==", String(studentId))),
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => String(b.examDate || "").localeCompare(String(a.examDate || "")));
      onData(list);
    },
    onError
  );
}

export async function createExam({ title, classGroup, term, examDate, subjects, createdBy }) {
  const ref = await addDoc(collection(db, EXAMS_COLLECTION), {
    title: String(title).trim(),
    classGroup,
    term: String(term || "").trim(),
    examDate: examDate || "",
    subjects: subjects.map((s) => ({
      name: s.name,
      maxMark: Number(s.maxMark) || DEFAULT_MAX_MARK,
    })),
    createdBy: createdBy || "admin",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// Tirtir exam-ka iyo natiijooyinkiisa oo dhan
export async function deleteExam(examId) {
  const snap = await getDocs(
    query(collection(db, EXAM_RESULTS_COLLECTION), where("examId", "==", examId))
  );
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, EXAMS_COLLECTION, examId));
}

// Kaydi natiijooyinka ardayda oo dhan (marksByStudent = { sid: { subject: mark } }).
// Kaalinta (rank) waxaa lagu xisaabiyaa total-ka, ardayda wax dhibco ah leh.
export async function saveExamResults(exam, students, marksByStudent, savedBy) {
  const rows = students.map((s) => {
    const marks = {};
    (exam.subjects || []).forEach((sub) => {
      const raw = marksByStudent?.[s.studentId]?.[sub.name];
      marks[sub.name] = raw === "" || raw === undefined || raw === null ? null : Number(raw);
    });
    const r = computeResult(exam, marks);
    return { student: s, marks, ...r };
  });

  const ranked = rows
    .filter((r) => r.filled > 0)
    .sort((a, b) => b.total - a.total);
  const rankById = {};
  ranked.forEach((r, i) => {
    // Isku dhibco -> isku kaalin
    const prev = ranked[i - 1];
    rankById[r.student.studentId] = prev && prev.total === r.total ? rankById[prev.student.studentId] : i + 1;
  });

  const writes = rows.map((r) => (batch) => {
    const ref = doc(db, EXAM_RESULTS_COLLECTION, resultDocId(exam.id, r.student.studentId));
    if (r.filled === 0) {
      batch.delete(ref);
      return;
    }
    batch.set(ref, {
      examId: exam.id,
      examTitle: exam.title || "",
      term: exam.term || "",
      examDate: exam.examDate || "",
      classGroup: exam.classGroup || "",
      studentId: String(r.student.studentId),
      studentName: r.student.fullName || "",
      subjects: exam.subjects || [],
      marks: r.marks,
      total: r.total,
      maxTotal: r.maxTotal,
      percent: r.percent,
      grade: r.grade,
      rank: rankById[r.student.studentId] || null,
      classSize: ranked.length,
      savedBy: savedBy || "admin",
      updatedAt: serverTimestamp(),
    });
  });

  for (let i = 0; i < writes.length; i += 400) {
    const batch = writeBatch(db);
    writes.slice(i, i + 400).forEach((w) => w(batch));
    await batch.commit();
  }

  return { saved: ranked.length };
}