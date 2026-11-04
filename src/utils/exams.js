// src/utils/exams.js
//
// IMTIXAANNADA (Exams) iyo NATIIJOOYINKA (Results)
//  • rssExams/{examId}            — exam-ka: magaca, fasalka (classGroup),
//                                   maadooyinka iyo dhibcaha ugu badan
//  • rssExamResults/{examId_sid}  — natiijada arday kasta: dhibcaha maado
//                                   kasta, total, %, grade iyo kaalinta (rank)
// HABKA:
//  1) MACALLINKA ayaa marka hore soo diraya exam-ka (createTeacherExam):
//     fasalkiisa + maadadiisa, magaca, taariikhda, inta lagu saxayo iyo
//     (ikhtiyaari) warqadda exam-ka (PDF / sawir).
//  2) Kadib wuxuu soo gudbiyaa NATIIJADA — exam-ka uu isagu sameeyay
//     OO KELIYA (submitSubjectMarks wuu hubiyaa).
//  3) Admin-ku wuu arkaa exam kasta: cidda dirtay, xaaladda (natiijo la
//     sugayo / la gudbiyay), warqadda, natiijada, Download iyo Print.
//  • rssExams/{examId}: createdByRole "teacher", teacherId, teacherName,
//    status "sent" | "results", paperUrl, paperName
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
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
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

// Macallinka aqoonsigiisa (isla kan exam-ka lagu kaydiyo)
export function teacherKey(teacher) {
  return String(teacher?.teacherId || teacher?.username || teacher?.id || "").trim();
}

// Exam-kan ma macallinkan ayaa sameeyay?
export function isOwnExam(exam, teacher) {
  const me = teacherKey(teacher);
  if (!me || exam?.createdByRole !== "teacher") return false;
  return [exam.teacherId, exam.teacherUsername].filter(Boolean).map(String).includes(me) ||
    (teacher?.username && String(exam.teacherUsername || "") === String(teacher.username));
}

// "sent" → exam-ka waa la diray, natiijo weli lama gudbin
// "results" → natiijada waa la gudbiyay
export function examStatus(exam) {
  const subs = exam?.subjects || [];
  const done = subs.filter((s) => exam?.submissions?.[s.name]).length;
  if (subs.length && done === subs.length) return "results";
  if (done > 0) return "partial";
  return "sent";
}

// Nooca exam-ka: Term ama Final oo keliya
export const EXAM_TYPES = [
  { value: "Term", label: "Term Exam", so: "Imtixaanka Term-ka" },
  { value: "Final", label: "Final Exam", so: "Imtixaanka Final-ka" },
];
export const examTypeLabel = (t) => EXAM_TYPES.find((x) => x.value === t)?.label || "";
// Exam-yadii hore (examType la'aan) → magaciisa ayaa la eegaa
export function examTypeOf(exam) {
  if (exam?.examType) return exam.examType;
  return /final/i.test(String(exam?.title || exam?.examTitle || "")) ? "Final" : "Term";
}

export const EXAM_STATUS = {
  sent: { label: "Waiting for results", so: "Natiijo la sugayo", tone: "amber" },
  partial: { label: "Partly submitted", so: "Qayb la gudbiyay", tone: "blue" },
  results: { label: "Results submitted", so: "Natiijada waa la gudbiyay", tone: "green" },
};

const isPdf = (f) => !!f && (/pdf/i.test(f.type || "") || /\.pdf$/i.test(f.name || ""));
const isWord = (f) =>
  !!f && (/word|officedocument\.wordprocessingml|msword/i.test(f.type || "") || /\.(docx?|rtf|odt)$/i.test(f.name || ""));

async function uploadPaper(examId, kind, file) {
  const safe = String(file.name || kind).replace(/[^\w.\-]+/g, "_");
  const fileRef = storageRef(storage, `exam-papers/${examId}/${kind}-${safe}`);
  await uploadBytes(fileRef, file, { contentType: file.type || undefined });
  return { url: await getDownloadURL(fileRef), name: file.name || safe, path: fileRef.fullPath };
}

// MACALLIN: soo dir exam-ka (fasalkiisa + maadada) — warqadda exam-ka LABADA qaab:
// Word (.doc/.docx) iyo PDF. Admin-ka ayaa arka, soo dejiya, si toos ahna u daabaca.
export async function createTeacherExam({ teacher, classGroup, subject, examType, term, examDate, maxMark, note, wordFile, pdfFile }) {
  const me = teacherKey(teacher);
  if (!me) throw new Error("Macallinka lama aqoonsan. Dib u gal (login).");
  if (!EXAM_TYPES.some((t) => t.value === examType)) throw new Error("Dooro nooca exam-ka: Term ama Final.");
  const title = examTypeLabel(examType);
  if (!classGroup) throw new Error("Dooro fasalka.");
  if (!subject) throw new Error("Dooro maadada exam-ka.");
  if (!(Number(maxMark) > 0)) throw new Error("Geli inta exam-ka lagu saxayo (tusaale 50 ama 100).");
  if (!wordFile) throw new Error("Soo geli warqadda exam-ka qaabka WORD (.docx).");
  if (!pdfFile) throw new Error("Soo geli warqadda exam-ka qaabka PDF (.pdf).");
  if (!isWord(wordFile)) throw new Error(`"${wordFile.name}" Word ma aha — dooro fayl .doc ama .docx ah.`);
  if (!isPdf(pdfFile)) throw new Error(`"${pdfFile.name}" PDF ma aha — dooro fayl .pdf ah.`);
  for (const f of [wordFile, pdfFile]) {
    if (f.size > 15 * 1024 * 1024) throw new Error(`"${f.name}" waa inuu ka yar yahay 15MB.`);
  }

  const teacherName = teacher?.fullName || teacher?.username || me;
  const ref = await addDoc(collection(db, EXAMS_COLLECTION), {
    title,
    examType,
    classGroup,
    term: String(term || "").trim(),
    examDate: examDate || "",
    outOf: Number(maxMark),
    subjects: [{ name: subject, maxMark: Number(maxMark) }],
    note: String(note || "").trim(),
    createdBy: teacherName,
    createdByRole: "teacher",
    teacherId: me,
    teacherUsername: teacher?.username || "",
    teacherName,
    status: "uploading",
    createdAt: serverTimestamp(),
  });

  try {
    const [word, pdf] = await Promise.all([uploadPaper(ref.id, "word", wordFile), uploadPaper(ref.id, "pdf", pdfFile)]);
    await updateDoc(ref, {
      paperWordUrl: word.url,
      paperWordName: word.name,
      paperPdfUrl: pdf.url,
      paperPdfName: pdf.name,
      paperUrl: pdf.url, // qaabkii hore
      paperName: pdf.name,
      status: "sent",
      sentAt: serverTimestamp(),
    });
  } catch (err) {
    // Faylasha lama soo gelin → exam-ka ha la tirtiro si aan nuss loo arag
    try {
      await deleteDoc(ref);
    } catch {
      /* ignore */
    }
    throw new Error(`Warqadaha exam-ka lama soo gelin karin: ${err.message || err}. Mar kale isku day.`);
  }
  return ref.id;
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
    createdByRole: "admin",
    status: "sent",
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
      examType: examTypeOf(exam),
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
  // Macallinku natiijo wuxuu u gudbin karaa exam-ka uu isagu marka hore soo diray oo keliya
  if (!isOwnExam(exam, teacher)) {
    throw new Error("Natiijada waxaad u gudbin kartaa oo keliya exam-ka adigu aad marka hore soo dirtay.");
  }
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

  const allDone = (exam.subjects || []).every((x) => x.name === subject || exam.submissions?.[x.name]);
  await updateDoc(
    doc(db, EXAMS_COLLECTION, exam.id),
    new FieldPath("submissions", subject),
    {
      teacherId: teacherKey(teacher),
      teacherName,
      count,
      total: students.length,
      submittedAt: serverTimestamp(),
    },
    "status",
    allDone ? "results" : "partial",
    "resultsAt",
    serverTimestamp()
  );

  return { ...res, count };
}