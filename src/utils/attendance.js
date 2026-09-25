import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { ATTENDANCE_COLLECTION, ATTENDANCE_SESSIONS_COLLECTION } from "../config/collections";

// Local (not UTC) YYYY-MM-DD, so "today" matches the teacher's own day.
export function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// One session doc per teacher per day. If it exists, that teacher has
// already saved attendance for today and the form should lock/close.
export async function getTodaySession(teacherId) {
  const sessionRef = doc(db, ATTENDANCE_SESSIONS_COLLECTION, `${teacherId}_${todayStr()}`);
  const snap = await getDoc(sessionRef);
  return snap.exists() ? snap.data() : null;
}

// Saves one attendance record per student for today, plus the session doc
// that locks the teacher out of re-submitting the same day. statuses is
// { [studentId]: "present" | "absent" }.
export async function saveTodayAttendance(teacherId, statuses) {
  const date = todayStr();
  const batch = writeBatch(db);

  Object.entries(statuses).forEach(([studentId, status]) => {
    const recordRef = doc(db, ATTENDANCE_COLLECTION, `${studentId}_${date}`);
    batch.set(recordRef, {
      studentId,
      date,
      status,
      teacherId,
      createdAt: serverTimestamp(),
    });
  });

  const sessionRef = doc(db, ATTENDANCE_SESSIONS_COLLECTION, `${teacherId}_${date}`);
  batch.set(sessionRef, {
    teacherId,
    date,
    studentCount: Object.keys(statuses).length,
    submittedAt: serverTimestamp(),
  });

  await batch.commit();
}

// All attendance records for one student, newest first.
export async function getStudentAttendance(studentId) {
  const q = query(collection(db, ATTENDANCE_COLLECTION), where("studentId", "==", studentId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data()).sort((a, b) => (a.date < b.date ? 1 : -1));
}

// Every attendance record, newest first — used by the Admin Portal.
export async function getAllAttendance() {
  const snap = await getDocs(collection(db, ATTENDANCE_COLLECTION));
  return snap.docs.map((d) => d.data()).sort((a, b) => (a.date < b.date ? 1 : -1));
}
