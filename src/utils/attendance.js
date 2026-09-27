import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  writeBatch,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { ATTENDANCE_COLLECTION, ATTENDANCE_SESSIONS_COLLECTION } from "../config/collections";

const JS_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Local (not UTC) YYYY-MM-DD, so "today" matches the teacher's own day.
export function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayDayName() {
  return JS_DAY_NAMES[new Date().getDay()];
}

// "2026-09-27" -> "Sunday"
export function dayNameOf(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return JS_DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

// "2026-09-27" -> "27 Sep 2026"
export function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// "13:05" -> "1:05 PM"
export function formatTime12(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

// Firestore Timestamp -> "1:05 PM"
export function formatTimestamp(ts) {
  if (!ts?.toDate) return "";
  return ts.toDate().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
}

// Teachers may have attendanceDays (new, array) or attendanceDay (old,
// single string). Empty means "every day".
export function getTeacherDays(teacher) {
  if (Array.isArray(teacher?.attendanceDays) && teacher.attendanceDays.length) {
    return teacher.attendanceDays;
  }
  return teacher?.attendanceDay ? [teacher.attendanceDay] : [];
}

// Where the teacher currently stands against their schedule:
// "not-today" | "before" | "open" | "after"
export function getWindowState(teacher, now = new Date()) {
  const days = getTeacherDays(teacher).map((d) => d.toLowerCase());
  const today = JS_DAY_NAMES[now.getDay()].toLowerCase();
  if (days.length && !days.includes(today)) return "not-today";

  const start = teacher?.startTime;
  const end = teacher?.endTime;
  if (!start || !end) return "open"; // no time set → open all day

  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin < toMinutes(start)) return "before";
  if (nowMin > toMinutes(end)) return "after";
  return "open";
}

// One session doc per teacher per day. If it exists, that teacher has
// already saved attendance for today and the form should lock/close.
export async function getTodaySession(teacherId) {
  const sessionRef = doc(db, ATTENDANCE_SESSIONS_COLLECTION, `${teacherId}_${todayStr()}`);
  const snap = await getDoc(sessionRef);
  return snap.exists() ? snap.data() : null;
}

// Saves one attendance record per student for today, plus the session doc
// that locks the teacher out of re-submitting the same day.
// statuses is { [studentId]: "present" | "absent" | "late" | "excused" }.
// meta = { teacherName, className, subject, startTime, endTime, studentNames }
//
// The record id includes the teacherId so a student who has two different
// teachers (subjects) on the same day gets two separate records instead of
// one overwriting the other.
export async function saveTodayAttendance(teacherId, statuses, meta = {}) {
  const date = todayStr();
  const batch = writeBatch(db);
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };

  Object.entries(statuses).forEach(([studentId, status]) => {
    counts[status] = (counts[status] || 0) + 1;
    const recordRef = doc(db, ATTENDANCE_COLLECTION, `${studentId}_${date}_${teacherId}`);
    batch.set(recordRef, {
      studentId,
      studentName: meta.studentNames?.[studentId] || "",
      date,
      day: dayNameOf(date),
      status,
      originalStatus: status,
      teacherId,
      teacherName: meta.teacherName || "",
      className: meta.className || "",
      subject: meta.subject || "",
      reviewed: false,
      createdAt: serverTimestamp(),
    });
  });

  const sessionRef = doc(db, ATTENDANCE_SESSIONS_COLLECTION, `${teacherId}_${date}`);
  batch.set(sessionRef, {
    teacherId,
    teacherName: meta.teacherName || "",
    className: meta.className || "",
    subject: meta.subject || "",
    startTime: meta.startTime || "",
    endTime: meta.endTime || "",
    date,
    day: dayNameOf(date),
    studentCount: Object.keys(statuses).length,
    counts,
    submittedAt: serverTimestamp(),
  });

  await batch.commit();
}

function sortNewestFirst(list) {
  return list.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const at = a.createdAt?.seconds || 0;
    const bt = b.createdAt?.seconds || 0;
    return bt - at;
  });
}

function mapDocs(snap) {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// All attendance records for one student, newest first.
export async function getStudentAttendance(studentId) {
  const q = query(collection(db, ATTENDANCE_COLLECTION), where("studentId", "==", studentId));
  const snap = await getDocs(q);
  return sortNewestFirst(mapDocs(snap));
}

// Every attendance record, newest first — used by the Admin Portal.
export async function getAllAttendance() {
  const snap = await getDocs(collection(db, ATTENDANCE_COLLECTION));
  return sortNewestFirst(mapDocs(snap));
}

// ---- Live (real-time) listeners ----

export function subscribeAllAttendance(onData, onError) {
  return onSnapshot(
    collection(db, ATTENDANCE_COLLECTION),
    (snap) => onData(sortNewestFirst(mapDocs(snap))),
    onError
  );
}

export function subscribeStudentAttendance(studentId, onData, onError) {
  const q = query(collection(db, ATTENDANCE_COLLECTION), where("studentId", "==", studentId));
  return onSnapshot(q, (snap) => onData(sortNewestFirst(mapDocs(snap))), onError);
}

export function subscribeTeacherAttendance(teacherId, onData, onError) {
  const q = query(collection(db, ATTENDANCE_COLLECTION), where("teacherId", "==", teacherId));
  return onSnapshot(q, (snap) => onData(sortNewestFirst(mapDocs(snap))), onError);
}

export function subscribeTodaySession(teacherId, onData, onError) {
  const sessionRef = doc(db, ATTENDANCE_SESSIONS_COLLECTION, `${teacherId}_${todayStr()}`);
  return onSnapshot(sessionRef, (snap) => onData(snap.exists() ? snap.data() : null), onError);
}

export function subscribeSessions(onData, onError) {
  return onSnapshot(
    collection(db, ATTENDANCE_SESSIONS_COLLECTION),
    (snap) => onData(mapDocs(snap)),
    onError
  );
}

// ---- Admin review ----

// Admin changes a status. Only allowed while the record is not reviewed
// (the UI enforces this). The teacher's first answer is kept in
// originalStatus so the change is always visible.
export async function updateAttendanceStatus(record, status, adminName) {
  await updateDoc(doc(db, ATTENDANCE_COLLECTION, record.id), {
    status,
    originalStatus: record.originalStatus || record.status,
    editedBy: adminName || "admin",
    editedAt: serverTimestamp(),
  });
}

// Approve (lock) one or many records.
export async function reviewAttendance(recordIds, adminName) {
  const batch = writeBatch(db);
  recordIds.forEach((id) => {
    batch.update(doc(db, ATTENDANCE_COLLECTION, id), {
      reviewed: true,
      reviewedBy: adminName || "admin",
      reviewedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

// Unlock records again so the admin can change them.
export async function reopenAttendance(recordIds) {
  const batch = writeBatch(db);
  recordIds.forEach((id) => {
    batch.update(doc(db, ATTENDANCE_COLLECTION, id), {
      reviewed: false,
      reviewedBy: null,
      reviewedAt: null,
    });
  });
  await batch.commit();
}