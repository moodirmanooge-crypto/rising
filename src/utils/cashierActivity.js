// src/utils/cashierActivity.js
//
// Diiwaanka dhaqdhaqaaqa cashier-ka (rssCashierActivity). Mar kasta oo cashier-ku
// sameeyo wax muhiim ah (login, logout, lacag qaadasho, wax ka beddelka lacag,
// daabacaadda rasiid) halkan ayaa lagu qoraa; Admin-ku wuxuu ka arkaa
// Cashiers tab → Cashier activity log (live).

import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { CASHIER_ACTIVITY_COLLECTION } from "../config/collections";
import { todayStr } from "./attendance";

export const ACTIVITY_TYPES = {
  login: { label: "Login", so: "Gashay", tone: "blue" },
  logout: { label: "Logout", so: "Ka baxay", tone: "gray" },
  payment: { label: "Payment received", so: "Lacag qaaday", tone: "green" },
  payment_edit: { label: "Payment edited", so: "Wax ka beddelay", tone: "amber" },
  receipt_print: { label: "Receipt printed", so: "Rasiid daabacay", tone: "violet" },
};

// actor = user-ka login-ka ah (cashier ama admin). Waligeed ma tuurto error —
// haddii diiwaanku guuldareysto, shaqada cashier-ka lama hakinayo.
export async function logActivity({ actor, type, summary = "", payment = null }) {
  try {
    await addDoc(collection(db, CASHIER_ACTIVITY_COLLECTION), {
      type,
      summary,
      actorRole: actor?.role || "cashier",
      cashierId: actor?.id || actor?.cashierId || "",
      cashierName: actor?.fullName || actor?.email || actor?.username || "",
      cashierEmail: actor?.email || "",
      // Marka admin wax ka beddelo rasiidka cashier-ka, cashier-kaas ayaa lagu xiraa
      targetCashierId: payment?.cashierId || actor?.id || "",
      receiptNo: payment?.receiptNo || "",
      studentId: payment?.studentId || "",
      studentName: payment?.studentName || "",
      amount: payment ? Number(payment.amount) || 0 : null,
      date: todayStr(),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Activity log failed:", err);
  }
}

// 500-kii dhaqdhaqaaq ee ugu dambeeyay, kan ugu cusub ugu horreeya
export function subscribeActivity(onData, onError) {
  return onSnapshot(
    query(collection(db, CASHIER_ACTIVITY_COLLECTION), orderBy("createdAt", "desc"), limit(500)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}