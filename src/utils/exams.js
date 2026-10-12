// src/utils/exams.js
//
// IMTIXAANNADA (Exams) iyo NATIIJOOYINKA (Results)
//  • rssExams/{examId}            — exam-ka: magaca, fasalka (classGroup),
//                                   maadooyinka iyo dhibcaha ugu badan
//  • rssExamResults/{examId_sid}  — natiijada arday kasta: dhibcaha maado
//                                   kasta, total, %, grade iyo kaalinta (rank)
// Admin-ka ayaa sameeya exam-ka. Macallin kasta wuxuu Teacher Portal-ka ka
// soo gudbiyaa dhibcaha MAADADIISA oo kaliya (submitSubjectMarks) — kadib
// total, %, grade iyo rank-ga ardayda oo dhan dib ayaa loo xisaabiyaa.
// Admin-ku wuu arkaa / beddeli karaa / soo dejin karaa / daabici karaa,
// arday kasta-na natiijadiisa wuxuu ku arkaa Student Portal-kiisa (live).
//  • rssExams/{examId}.submissions[subject] = { teacherId, teacherName,
//                                             count, submittedAt }

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  FieldPath,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { EXAMS_COLLECTION, EXAM_RESULTS_COLLECTION } from "../config/collections";

// Dhibcaha ugu badan waa la qoraa marka exam-ka la sameynayo — default 100 ma jiro.

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
    maxTotal += Number(s.maxMark) || 0;
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

export async function createExam({ title, classGroup, term, examDate, subjects, outOf, createdBy }) {
  const missing = subjects.find((s) => !(Number(s.maxMark) > 0));
  if (missing) throw new Error(`Geli dhibcaha ugu badan ee ${missing.name}.`);
  const ref = await addDoc(collection(db, EXAMS_COLLECTION), {
    title: String(title).trim(),
    classGroup,
    term: String(term || "").trim(),
    examDate: examDate || "",
    // "Inta lagu saxayo" — maado kasta waxaa lagu saxayaa lambarkan
    outOf: Number(outOf) || Number(subjects[0]?.maxMark) || null,
    subjects: subjects.map((s) => ({
      name: s.name,
      maxMark: Number(s.maxMark),
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

// rows = [{ studentId, studentName, marks: { subject: number|null } }]
// Wuxuu xisaabiyaa total/%/grade, kaalinta (rank) ardayda dhibcaha leh,
// kadibna wuxuu qoraa (ama tirtiraa haddii aan dhibco lahayn) result kasta.
async function writeExamRows(exam, rows, savedBy) {
  const computed = rows.map((r) => ({ ...r, ...computeResult(exam, r.marks) }));

  const ranked = computed.filter((r) => r.filled > 0).sort((a, b) => b.total - a.total);
  const rankById = {};
  ranked.forEach((r, i) => {
    // Isku dhibco -> isku kaalin
    const prev = ranked[i - 1];
    rankById[r.studentId] = prev && prev.total === r.total ? rankById[prev.studentId] : i + 1;
  });

  const writes = computed.map((r) => (batch) => {
    const ref = doc(db, EXAM_RESULTS_COLLECTION, resultDocId(exam.id, r.studentId));
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
      studentId: String(r.studentId),
      studentName: r.studentName || "",
      subjects: exam.subjects || [],
      marks: r.marks,
      total: r.total,
      maxTotal: r.maxTotal,
      percent: r.percent,
      grade: r.grade,
      rank: rankById[r.studentId] || null,
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

function toMark(raw) {
  return raw === "" || raw === undefined || raw === null || isNaN(Number(raw)) ? null : Number(raw);
}

// ADMIN: Kaydi natiijooyinka ardayda oo dhan (marksByStudent = { sid: { subject: mark } }).
export async function saveExamResults(exam, students, marksByStudent, savedBy) {
  const rows = students.map((s) => {
    const marks = {};
    (exam.subjects || []).forEach((sub) => {
      marks[sub.name] = toMark(marksByStudent?.[s.studentId]?.[sub.name]);
    });
    return { studentId: String(s.studentId), studentName: s.fullName || "", marks };
  });
  return writeExamRows(exam, rows, savedBy);
}

// MACALLIN: soo gudbi dhibcaha HAL maado (subject) ee ardayda fasalka.
// marksBySid = { sid: number|"" }. Maadooyinka kale ee ardayga (macallimiin
// kale) waa la ilaaliyaa; total/rank-ga oo dhan dib ayaa loo xisaabiyaa.
export async function submitSubjectMarks(exam, subject, students, marksBySid, teacher) {
  const sub = (exam.subjects || []).find((s) => s.name === subject);
  if (!sub) throw new Error(`${subject} kuma jiro exam-kan.`);

  for (const st of students) {
    const raw = marksBySid?.[st.studentId];
    if (raw === "" || raw === undefined || raw === null) continue;
    const v = Number(raw);
    if (isNaN(v) || v < 0 || v > Number(sub.maxMark)) {
      throw new Error(`${st.fullName || st.studentId}: dhibcuhu waa inay u dhexeeyaan 0 iyo ${sub.maxMark}.`);
    }
  }

  // Natiijooyinka hadda jira (maadooyinka macallimiinta kale)
  const snap = await getDocs(
    query(collection(db, EXAM_RESULTS_COLLECTION), where("examId", "==", exam.id))
  );
  const rowsById = new Map();
  snap.docs.forEach((d) => {
    const r = d.data();
    const marks = {};
    (exam.subjects || []).forEach((x) => (marks[x.name] = toMark(r.marks?.[x.name])));
    rowsById.set(String(r.studentId), { studentId: String(r.studentId), studentName: r.studentName || "", marks });
  });

  let count = 0;
  students.forEach((st) => {
    const sid = String(st.studentId);
    const row =
      rowsById.get(sid) ||
      {
        studentId: sid,
        studentName: st.fullName || "",
        marks: Object.fromEntries((exam.subjects || []).map((x) => [x.name, null])),
      };
    row.studentName = st.fullName || row.studentName;
    row.marks = { ...row.marks, [subject]: toMark(marksBySid?.[st.studentId]) };
    if (row.marks[subject] !== null) count += 1;
    rowsById.set(sid, row);
  });

  const teacherName = teacher?.fullName || teacher?.username || "teacher";
  const res = await writeExamRows(exam, [...rowsById.values()], teacherName);

  await updateDoc(doc(db, EXAMS_COLLECTION, exam.id), new FieldPath("submissions", subject), {
    teacherId: teacher?.teacherId || teacher?.username || teacher?.id || "",
    teacherName,
    count,
    total: students.length,
    submittedAt: serverTimestamp(),
  });

  return { ...res, count };
}