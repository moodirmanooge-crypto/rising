// src/utils/recycleBin.js
//
// RECYCLE BIN — ardayda iyo macallimiinta.
//
// 1) Delete  → qofka waxaa laga guuriyaa liiska (students1 / teacher1) una
//              guuraa recycle bin-ka (xogtiisa oo dhan waa la ilaaliyaa).
//              Inta uu halkaas ku jiro portal-ka ma geli karo.
// 2) Restore → dib ayuu ugu laabanayaa liiska, portal-kuna wuu u shaqeynayaa.
// 3) Delete forever → app-ka oo dhan wuu ka baxayaa, LAAKIIN database-ka
//              wuu ku sii jirayaa:   permanentlyDeleted: true
//              Haddii Firestore-ka gacanta looga beddelo  permanentlyDeleted: false
//              dib ayuu ugu soo laabanayaa Recycle Bin-ka (kadibna Restore).
//
// Rasiidyada, natiijooyinka iyo attendance-ka lama taabto.

import {
  collection, doc, getDoc, onSnapshot, serverTimestamp, updateDoc, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  STUDENTS_COLLECTION, STUDENT_RECYCLE_COLLECTION,
  TEACHERS_COLLECTION, TEACHER_RECYCLE_COLLECTION,
} from "../config/collections";

// ---------- shared ----------

function subscribeCollection(name, onData, onError) {
  return onSnapshot(
    collection(db, name),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        // "Delete forever" -> lagama muujiyo meelna (database-ka wuu ku jiraa)
        .filter((item) => item.permanentlyDeleted !== true);
      list.sort((a, b) => (b.deletedAt?.seconds || 0) - (a.deletedAt?.seconds || 0));
      onData(list);
    },
    onError
  );
}

async function markForever(name, item, by) {
  await updateDoc(doc(db, name, item.id), {
    permanentlyDeleted: true,
    permanentlyDeletedAt: serverTimestamp(),
    permanentlyDeletedBy: by || "admin",
  });
}

// ---------- STUDENTS ----------

export async function moveStudentToBin(student, deletedBy) {
  const id = student.docId || String(student.studentId);
  const { docId: _d, ...data } = student; // eslint-disable-line no-unused-vars
  const batch = writeBatch(db);
  batch.set(doc(db, STUDENT_RECYCLE_COLLECTION, id), {
    type: "student",
    student: data,
    studentId: String(student.studentId || id),
    fullName: student.fullName || "",
    deletedBy: deletedBy || "admin",
    deletedAt: serverTimestamp(),
    permanentlyDeleted: false,
  });
  batch.delete(doc(db, STUDENTS_COLLECTION, id));
  await batch.commit();
}

export async function restoreStudent(item) {
  const target = doc(db, STUDENTS_COLLECTION, item.id);
  const exists = await getDoc(target);
  if (exists.exists()) {
    throw new Error(`Arday leh ID ${item.studentId} hadda ayaa jira — lama soo celin karo.`);
  }
  const batch = writeBatch(db);
  batch.set(target, item.student);
  batch.delete(doc(db, STUDENT_RECYCLE_COLLECTION, item.id));
  await batch.commit();
}

// Delete forever: app-ka ka saar, database-ka ku hay (permanentlyDeleted: true)
export async function deleteStudentForever(item, by) {
  await markForever(STUDENT_RECYCLE_COLLECTION, item, by);
}

export function subscribeBin(onData, onError) {
  return subscribeCollection(STUDENT_RECYCLE_COLLECTION, onData, onError);
}

// ---------- TEACHERS ----------

export async function moveTeacherToBin(teacher, deletedBy) {
  const id = teacher.docId || teacher.username || teacher.teacherId;
  const { docId: _d, ...data } = teacher; // eslint-disable-line no-unused-vars
  const batch = writeBatch(db);
  batch.set(doc(db, TEACHER_RECYCLE_COLLECTION, id), {
    type: "teacher",
    teacher: data,
    username: String(teacher.username || id),
    fullName: teacher.fullName || "",
    deletedBy: deletedBy || "admin",
    deletedAt: serverTimestamp(),
    permanentlyDeleted: false,
  });
  batch.delete(doc(db, TEACHERS_COLLECTION, id));
  await batch.commit();
}

export async function restoreTeacher(item) {
  const target = doc(db, TEACHERS_COLLECTION, item.id);
  const exists = await getDoc(target);
  if (exists.exists()) {
    throw new Error(`Macallin leh username "${item.username}" hadda ayaa jira — lama soo celin karo.`);
  }
  const batch = writeBatch(db);
  batch.set(target, item.teacher);
  batch.delete(doc(db, TEACHER_RECYCLE_COLLECTION, item.id));
  await batch.commit();
}

export async function deleteTeacherForever(item, by) {
  await markForever(TEACHER_RECYCLE_COLLECTION, item, by);
}

export function subscribeTeacherBin(onData, onError) {
  return subscribeCollection(TEACHER_RECYCLE_COLLECTION, onData, onError);
}

// Username-ku ma ku jiraa recycle bin-ka (xitaa "Delete forever")?
export async function teacherUsernameInBin(username) {
  const snap = await getDoc(doc(db, TEACHER_RECYCLE_COLLECTION, username));
  return snap.exists();
}