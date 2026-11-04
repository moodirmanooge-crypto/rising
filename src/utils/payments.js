import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { PAYMENTS_COLLECTION, COUNTERS_COLLECTION } from "../config/collections";
import { todayStr } from "./attendance";
import { logActivity } from "./cashierActivity";
import { isFreeStudent } from "../config/schoolOptions";

// "2026-09"
export function currentMonth() {
  return todayStr().slice(0, 7);
}

// "2026-09" -> "September 2026"
export function formatMonth(month) {
  if (!month) return "";
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function money(n) {
  const v = Number(n) || 0;
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// 125.5 -> "One Hundred Twenty-Five Dollars and 50 Cents"
export function amountInWords(n) {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function below1000(x) {
    let out = "";

    if (x >= 100) {
      out += `${ones[Math.floor(x / 100)]} Hundred`;
      x %= 100;

      if (x) out += " ";
    }

    if (x >= 20) {
      out += tens[Math.floor(x / 10)];

      if (x % 10) {
        out += `-${ones[x % 10]}`;
      }
    } else if (x > 0) {
      out += ones[x];
    }

    return out;
  }

  const value = Math.round((Number(n) || 0) * 100);
  let dollars = Math.floor(value / 100);
  const cents = value % 100;

  if (dollars === 0 && cents === 0) {
    return "Zero Dollars";
  }

  const parts = [];
  const scales = [
    [1e6, "Million"],
    [1e3, "Thousand"],
  ];

  scales.forEach(([size, name]) => {
    if (dollars >= size) {
      parts.push(`${below1000(Math.floor(dollars / size))} ${name}`);
      dollars %= size;
    }
  });

  if (dollars) {
    parts.push(below1000(dollars));
  }

  let text = parts.join(" ");
  const whole = Math.floor(value / 100);

  text = text
    ? `${text} ${whole === 1 ? "Dollar" : "Dollars"}`
    : "";

  if (cents) {
    text += `${text ? " and " : ""}${cents} Cents`;
  }

  return text;
}

// Live list of every ACTIVE payment, newest first.
// Payment-ka reversed/unpaid (amount = 0) laguma soo bandhigayo.
export function subscribePayments(onData, onError) {
  return onSnapshot(
    collection(db, PAYMENTS_COLLECTION),
    (snap) => {
      const list = snap.docs
        .map((d) => ({
          id: d.id,
          ...d.data(),
        }))
        .filter(
          (p) =>
            Number(p.amount || 0) > 0 &&
            !p.reversed
        );

      list.sort(
        (a, b) =>
          (b.createdAt?.seconds || 0) -
            (a.createdAt?.seconds || 0) ||
          (a.receiptNo < b.receiptNo ? 1 : -1)
      );

      onData(list);
    },
    onError
  );
}

// ============================================================
// LEDGER: hal doc oo arday kasta iyo bil kasta ah (rssCounters/fee_{id}_{month})
// oo haya rasiid kasta iyo lacagtiisa. Lacag qaadasho iyo wax ka beddel
// kasta waxay maraan Firestore transaction, sidaas darteed:
//   • laba cashier (ama laba click) isku mar ma qaadi karaan isla lacagta
//   • ardayga bishaas bixiyay lacag kale lagama qaadi karo
//   • lacag ka badan inta ka hartay lama qaadi karo
// Ledger-ku wuxuu ku jiraa rssCounters (collection horey u jirtay) si aan
// Firestore Rules cusub loogu baahan.
// ============================================================

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const sumOf = (map) => round2(Object.values(map || {}).reduce((s, v) => s + (Number(v) || 0), 0));

function ledgerRef(studentId, month) {
  return doc(db, COUNTERS_COLLECTION, `fee_${studentId}_${month}`);
}

// Ledger-ka marka ugu horreysa: ka dhis lacagaha horey u jiray ee bishaas.
async function receiptsFromPayments(studentId, month) {
  const snap = await getDocs(
    query(collection(db, PAYMENTS_COLLECTION), where("studentId", "==", String(studentId)))
  );
  const receipts = {};
  snap.docs.forEach((d) => {
    const p = d.data();
    if (p.month === month && !p.reversed && Number(p.amount) > 0) receipts[d.id] = round2(p.amount);
  });
  return receipts;
}

// Transaction gudihiisa: rasiid kasta oo ledger-ka (ama seed-ka) ku jira dib
// ayaa loo akhriyaa, si ledger-ku had iyo jeer u noqdo mid sax ah (is-sixa) —
// rasiid la tirtiray ama laga noqday lama tiriyo.
async function verifiedReceipts(tx, ledgerSnap, seed, month) {
  const stored = ledgerSnap.exists() ? ledgerSnap.data().receipts || {} : {};
  const ids = [...new Set([...Object.keys(stored), ...Object.keys(seed || {})])];
  const snaps = await Promise.all(ids.map((id) => tx.get(doc(db, PAYMENTS_COLLECTION, id))));
  const out = {};
  snaps.forEach((ps, i) => {
    if (!ps.exists()) return;
    const p = ps.data();
    if (p.month === month && !p.reversed && Number(p.amount) > 0) out[ids[i]] = round2(p.amount);
  });
  return out;
}

export const ALREADY_PAID_MSG =
  "Ardaygan bishan lacagtiisa oo dhan horey ayuu u bixiyay. Lacag kale lagama qaadi karo ilaa maamulku (Admin) wax ka beddelo.";

// Records one payment. Document ID = receipt number (e.g. "RS-2026-004").
export async function recordPayment({ student, month, amount, amountDue, method, note, cashier }) {
  const studentId = String(student.studentId);
  const value = round2(amount);
  const due = round2(amountDue);
  if (isFreeStudent(student)) throw new Error("Ardaygan waa Free (bilaash) — lacag lagama qaado.");
  if (!month) throw new Error("Dooro bisha.");
  if (!(value > 0)) throw new Error("Geli lacag ka badan 0.");
  if (!(due > 0)) throw new Error("Ardaygan lacag bille ah looma qorin.");

  const seed = await receiptsFromPayments(studentId, month);
  const counterRef = doc(db, COUNTERS_COLLECTION, "receipts");
  const lRef = ledgerRef(studentId, month);

  const data = await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const ledgerSnap = await tx.get(lRef);

    const receipts = await verifiedReceipts(tx, ledgerSnap, seed, month);
    const paidBefore = sumOf(receipts);
    const remaining = round2(due - paidBefore);

    if (remaining <= 0) throw new Error(ALREADY_PAID_MSG);
    if (value > remaining) {
      throw new Error(`Lacagtu waxay ka badan tahay inta ka hartay bishan (${money(remaining)}).`);
    }

    const seq = (counterSnap.exists() ? counterSnap.data().lastId : -1) + 1;
    const receiptNo = `RS-${todayStr().slice(0, 4)}-${String(seq).padStart(3, "0")}`;

    const payment = {
      receiptNo,
      studentId,
      studentName: student.fullName || "",
      className: student.className || "",
      classGroups: student.classGroups || [],
      parentPhone: student.parentPhone || "",
      month,
      amountDue: due,
      paidBefore,
      amount: value,
      balance: round2(Math.max(0, remaining - value)),
      status: value >= remaining ? "paid" : "partial",
      method,
      note: note || "",
      cashierId: cashier?.id || cashier?.cashierId || "",
      cashierName: cashier?.fullName || cashier?.email || cashier?.username || "",
      cashierEmail: cashier?.email || "",
      date: todayStr(),
      createdAt: serverTimestamp(),
    };

    receipts[receiptNo] = value;
    tx.set(counterRef, { lastId: seq }, { merge: true });
    tx.set(lRef, { studentId, month, amountDue: due, receipts, paid: sumOf(receipts), updatedAt: serverTimestamp() });
    tx.set(doc(db, PAYMENTS_COLLECTION, receiptNo), payment);
    return payment;
  });

  logActivity({
    actor: { ...cashier, role: "cashier" },
    type: "payment",
    payment: data,
    summary: `Received ${money(value)} from ${data.studentName} (ID ${studentId}) for ${formatMonth(month)} via ${method}`,
  });

  return { ...data, id: data.receiptNo, createdAt: null, localTime: new Date().toISOString() };
}

// Wax ka beddelka rasiid. Cashier-ku wuxuu beddeli karaa method + note oo keliya;
// lacagta (amount), bisha iyo ka-noqoshada (amount = 0) waa Admin oo keliya.
export async function updatePayment({ payment, amount, month, method, note, amountDue, editor }) {
  const isAdmin = editor?.role === "admin";
  const value = round2(amount);
  const due = round2(amountDue);
  const oldMonth = payment.month || "";
  const studentId = String(payment.studentId);

  if (value < 0) throw new Error("Lacagtu ma noqon karto taban (negative).");
  if (!month) throw new Error("Dooro bisha.");
  if (!isAdmin && (value !== round2(payment.amount) || month !== oldMonth)) {
    throw new Error("Lacagta iyo bisha waxaa beddeli kara maamulka (Admin) oo keliya.");
  }

  const [seedOld, seedNew] = await Promise.all([
    receiptsFromPayments(studentId, oldMonth),
    month === oldMonth ? null : receiptsFromPayments(studentId, month),
  ]);

  const by = {
    role: editor?.role || "",
    id: editor?.id || editor?.username || editor?.email || "",
    name: editor?.fullName || editor?.username || editor?.email || "",
  };

  const pRef = doc(db, PAYMENTS_COLLECTION, payment.id);
  const oldRef = ledgerRef(studentId, oldMonth);
  const newRef = ledgerRef(studentId, month);

  const updates = await runTransaction(db, async (tx) => {
    const pSnap = await tx.get(pRef);
    if (!pSnap.exists()) throw new Error("Rasiidkan lama helin.");
    const oldSnap = await tx.get(oldRef);
    const newSnap = month === oldMonth ? oldSnap : await tx.get(newRef);

    const current = pSnap.data();
    const oldReceipts = await verifiedReceipts(tx, oldSnap, seedOld, oldMonth);
    const newReceipts = month === oldMonth ? oldReceipts : await verifiedReceipts(tx, newSnap, seedNew, month);

    delete oldReceipts[payment.id];
    delete newReceipts[payment.id];
    const otherPaid = sumOf(newReceipts);
    const maxAllowed = round2(Math.max(0, due - otherPaid));

    if (value > 0 && due > 0 && value > maxAllowed) {
      throw new Error(`Lacagtu waxay ka badan tahay inta ka hartay bishaas (${money(maxAllowed)}).`);
    }

    const newBalance = round2(Math.max(0, due - otherPaid - value));
    const status = value === 0 ? "unpaid" : newBalance <= 0 ? "paid" : "partial";
    const isReversed = value === 0;

    const result = {
      amount: value,
      month,
      method,
      note: String(note || "").trim(),
      amountDue: due,
      paidBefore: otherPaid,
      balance: newBalance,
      status,
      reversed: isReversed,
      edited: true,
      editedAt: serverTimestamp(),
      editedBy: by,
    };

    tx.update(pRef, {
      ...result,
      editHistory: arrayUnion({
        amount: Number(current.amount) || 0,
        month: current.month || "",
        method: current.method || "",
        note: current.note || "",
        balance: Number(current.balance) || 0,
        status: current.status || "",
        newAmount: value,
        newMonth: month,
        newBalance,
        newStatus: status,
        reversed: isReversed,
        changedAt: new Date().toISOString(),
        by,
      }),
    });

    if (value > 0) newReceipts[payment.id] = value;
    tx.set(newRef, { studentId, month, amountDue: due, receipts: newReceipts, paid: sumOf(newReceipts), updatedAt: serverTimestamp() });
    if (month !== oldMonth) {
      tx.set(oldRef, { studentId, month: oldMonth, receipts: oldReceipts, paid: sumOf(oldReceipts), updatedAt: serverTimestamp() }, { merge: true });
    }
    return { ...result, before: current };
  });

  const before = updates.before;
  delete updates.before;

  const changes = [];
  if (round2(before.amount) !== value) {
    changes.push(value === 0 ? `payment reversed: ${money(before.amount)} → ${money(0)}` : `amount ${money(before.amount)} → ${money(value)}`);
  }
  if ((before.month || "") !== month) changes.push(`month ${formatMonth(before.month)} → ${formatMonth(month)}`);
  if ((before.method || "") !== method) changes.push(`method ${before.method} → ${method}`);
  if ((before.note || "") !== updates.note) changes.push("note changed");
  changes.push(`status → ${updates.status.toUpperCase()}`);

  logActivity({
    actor: editor,
    type: updates.reversed ? "payment_reversed" : "payment_edit",
    payment: { ...payment, ...updates },
    summary: updates.reversed
      ? `Reversed payment ${payment.receiptNo} (${payment.studentName}) → UNPAID`
      : `Edited ${payment.receiptNo} (${payment.studentName}): ${changes.join(", ")}`,
  });

  return { ...payment, ...updates, editedAt: null };
}
