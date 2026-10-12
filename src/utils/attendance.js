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

// ============================================================
// JADWALKA: maalin kasta waxay yeelan kartaa xiisado (periods) badan.
//   daySchedules[day] = { periods: [{ startTime, endTime }, ...],
//                         startTime, endTime }   // startTime/endTime = xiisadda 1aad
// Macallimiinta hore (daySchedules ma leh) -> teacher.startTime/endTime.
// ============================================================

function validPeriod(p) {
  return p && p.startTime && p.endTime;
}

export function periodsOf(entry) {
  if (!entry) return [];
  const list = Array.isArray(entry.periods) && entry.periods.length ? entry.periods : [entry];
  return list
    .filter(validPeriod)
    .map((p) => ({ startTime: p.startTime, endTime: p.endTime }))
    .sort((x, y) => x.startTime.localeCompare(y.startTime));
}

// -> { startTime, endTime, periods } ; startTime = bilowga xiisadda 1aad,
//    endTime = dhammaadka xiisadda ugu dambeysa.
export function getDaySchedule(teacher, dayName) {
  const map = teacher?.daySchedules;
  let periods = [];
  if (map && typeof map === "object") {
    const key = Object.keys(map).find((k) => k.toLowerCase() === String(dayName || "").toLowerCase());
    if (key) periods = periodsOf(map[key]);
  }
  if (!periods.length && teacher?.startTime && teacher?.endTime) {
    periods = [{ startTime: teacher.startTime, endTime: teacher.endTime }];
  }
  return {
    startTime: periods[0]?.startTime || "",
    endTime: periods[periods.length - 1]?.endTime || "",
    periods,
  };
}

export function getTodaySchedule(teacher, now = new Date()) {
  return getDaySchedule(teacher, JS_DAY_NAMES[now.getDay()]);
}

export function periodText(p) {
  return p?.startTime && p?.endTime ? `${formatTime12(p.startTime)} – ${formatTime12(p.endTime)}` : "";
}

// "7:30 AM – 8:30 AM" · "7:30 AM – 8:30 AM, 1:00 PM – 2:00 PM" · "Any time"
export function scheduleText(schedule) {
  const periods = schedule?.periods?.length ? schedule.periods : validPeriod(schedule) ? [schedule] : [];
  return periods.length ? periods.map(periodText).join(", ") : "Any time";
}

// Xiisadda hadda socota (ama null)
export function currentPeriod(teacher, now = new Date()) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return (
    getTodaySchedule(teacher, now).periods.find(
      (p) => nowMin >= toMinutes(p.startTime) && nowMin <= toMinutes(p.endTime)
    ) || null
  );
}

// Xiisadda xigta ee maanta (ama null)
export function nextPeriod(teacher, now = new Date()) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return getTodaySchedule(teacher, now).periods.find((p) => toMinutes(p.startTime) > nowMin) || null;
}

// Maalinta xigta ee xaadirinta (berri kadib) -> "Wednesday"
export function nextAttendanceDay(teacher, now = new Date()) {
  const days = getTeacherDays(teacher).map((d) => d.toLowerCase());
  for (let i = 1; i <= 7; i++) {
    const name = JS_DAY_NAMES[(now.getDay() + i) % 7];
    if (!days.length || days.includes(name.toLowerCase())) return name;
  }
  return "";
}

// Where the teacher currently stands against today's schedule:
// "not-today" | "before" | "open" | "between" | "after"
export function getWindowState(teacher, now = new Date()) {
  const days = getTeacherDays(teacher).map((d) => d.toLowerCase());
  const today = JS_DAY_NAMES[now.getDay()].toLowerCase();
  if (days.length && !days.includes(today)) return "not-today";

  const { periods } = getTodaySchedule(teacher, now);
  if (!periods.length) return "open"; // no time set → open all day

  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (periods.some((p) => nowMin >= toMinutes(p.startTime) && nowMin <= toMinutes(p.endTime))) return "open";
  if (nowMin < toMinutes(periods[0].startTime)) return "before";
  if (nowMin > toMinutes(periods[periods.length - 1].endTime)) return "after";
  return "between";
}

// One session doc per teacher per day. If it exists, that teacher has
// already saved attendance for today and the form should lock/close.
export async function getTodaySession(teacherId) {
  const sessionRef = doc(db, ATTENDANCE_SESSIONS_COLLECTION, `${teacherId}_${todayStr()}`);
  const snap = await getDoc(sessionRef);
  return snap.exists() ? snap.data() : null;
}

// Saves one attendance record per student for today, plus the session doc
// that locks that class for the teacher until the next attendance day.
// statuses is { [studentId]: "present" | "absent" | "late" | "excused" }.
// meta = { teacherName, className, classKey, subject, subjects, startTime,
//          endTime, studentNames }
//
// Macallin classes badan leh: class kasta session gooni ah ayuu leeyahay
// (`${teacherId}_${date}_${classKey}`), sidaas darteed mid mid ayuu u
// xaadirin karaa. Record id-ga waxaa ku jira teacherId + classKey si arday
// laba macallin (ama laba class) leh aanu mid kale u dul-qorin.
export async function saveTodayAttendance(teacherId, statuses, meta = {}) {
  const date = todayStr();
  const batch = writeBatch(db);
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  const suffix = meta.classKey ? `_${meta.classKey}` : "";

  // Quful: haddii class-kan maanta horey loo keydiyay, mar dambe lama keydin karo
  // (xitaa haddii bogga dib loo furo ama xiisad labaad la galo) — maalinta xigta sug.
  const existing = await getDoc(doc(db, ATTENDANCE_SESSIONS_COLLECTION, `${teacherId}_${date}${suffix}`));
  if (existing.exists()) {
    throw new Error("Xaadirinta class-kan maanta horey ayaa loo keydiyay — waxaad sugaysaa maalinta xaadirinta ee xigta.");
  }

  Object.entries(statuses).forEach(([studentId, status]) => {
    counts[status] = (counts[status] || 0) + 1;
    const recordRef = doc(db, ATTENDANCE_COLLECTION, `${studentId}_${date}_${teacherId}${suffix}`);
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
      classKey: meta.classKey || "",
      subject: meta.subject || "",
      subjects: meta.subjects || (meta.subject ? [meta.subject] : []),
      reviewed: false,
      createdAt: serverTimestamp(),
    });
  });

  const sessionRef = doc(db, ATTENDANCE_SESSIONS_COLLECTION, `${teacherId}_${date}${suffix}`);
  batch.set(sessionRef, {
    teacherId,
    teacherName: meta.teacherName || "",
    className: meta.className || "",
    classKey: meta.classKey || "",
    subject: meta.subject || "",
    subjects: meta.subjects || (meta.subject ? [meta.subject] : []),
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

// All of today's sessions for one teacher (one per class). Old sessions
// saved before classes were split (id without classKey) are included too —
// they still carry className, so the portal can match them to a class.
export function subscribeTeacherTodaySessions(teacherId, onData, onError) {
  const date = todayStr();
  const q = query(collection(db, ATTENDANCE_SESSIONS_COLLECTION), where("teacherId", "==", teacherId));
  return onSnapshot(
    q,
    (snap) => onData(mapDocs(snap).filter((s) => s.date === date)),
    onError
  );
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