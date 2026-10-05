// src/utils/recycleBin.js
//
// Recycle Bin-ka ardayda. Marka admin-ku arday "delete" ka dhigo, ardayga lagama
// tirtirayo database-ka — waxaa laga guuriyaa `students1` una guuraa
// `rssStudentRecycleBin` (xogtiisa oo dhan waa la ilaaliyaa). Wuxuu halkaas ku
// sugnaanayaa ilaa admin-ku (1) dib u soo celiyo, ama (2) gacanta ugu tirtiro
// "Delete forever". Rasiidyada, natiijooyinka iyo attendance-ka lama taabto.
// Cashier-ada recycle bin ma leh — marka la tirtiro si toos ah ayaa loo tirtiraa.

import {
  collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { deleteObject, ref as storageRef } from "firebase/storage";
import { db, storage } from "../firebase";
import { STUDENTS_COLLECTION, STUDENT_RECYCLE_COLLECTION } from "../config/collections";

export async function moveStudentToBin(student, deletedBy) {
  const id = student.docId || String(student.studentId);
  const { docId: _d, ...data } = student; // eslint-disable-line no-unused-vars
  const batch = writeBatch(db);
  batch.set(doc(db, STUDENT_RECYCLE_COLLECTION, id), {
    student: data,
    studentId: String(student.studentId || id),
    fullName: student.fullName || "",
    deletedBy: deletedBy || "admin",
    deletedAt: serverTimestamp(),
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

// Tirtir weligiis — database-ka ayaa laga saaraa (iyo sawirka haddii uu jiro)
export async function deleteStudentForever(item) {
  await deleteDoc(doc(db, STUDENT_RECYCLE_COLLECTION, item.id));
  try {
    await deleteObject(storageRef(storage, `student-photos/${item.studentId}`));
  } catch {
    // sawir ma jirin — waa caadi
  }
}

export function subscribeBin(onData, onError) {
  return onSnapshot(
    collection(db, STUDENT_RECYCLE_COLLECTION),
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.deletedAt?.seconds || 0) - (a.deletedAt?.seconds || 0));
      onData(list);
    },
    onError
  );
}