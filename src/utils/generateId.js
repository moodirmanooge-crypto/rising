import { doc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { COUNTERS_COLLECTION } from "../config/collections";

// Generic atomic counter, kept in its own rssCounters collection (separate
// from any counters collection other apps in this Firebase project might
// use). A Firestore transaction guarantees two people registering at the
// same moment never get the same ID. IDs are zero-padded to 3 digits:
// 000, 001, 002 ... 999, then 1000+.
export async function generateNextId(counterName) {
  const counterRef = doc(db, COUNTERS_COLLECTION, counterName);

  const nextId = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const current = counterSnap.exists() ? counterSnap.data().lastId : -1;
    const next = current + 1;
    transaction.set(counterRef, { lastId: next }, { merge: true });
    return next;
  });

  return String(nextId).padStart(3, "0");
}

export function generateNextStudentId() {
  return generateNextId("students1");
}

export function generateNextTeacherId() {
  return generateNextId("teacher1");
}
