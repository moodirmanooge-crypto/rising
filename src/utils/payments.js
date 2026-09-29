import { collection, doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { PAYMENTS_COLLECTION } from "../config/collections";
import { generateNextId } from "./generateId";
import { todayStr } from "./attendance";

// "2026-09"
export function currentMonth() {
  return todayStr().slice(0, 7);
}

// "2026-09" -> "September 2026"
export function formatMonth(month) {
  if (!month) return "";
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function money(n) {
  const v = Number(n) || 0;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// 125.5 -> "One Hundred Twenty-Five Dollars and 50 Cents"
export function amountInWords(n) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function below1000(x) {
    let out = "";
    if (x >= 100) {
      out += `${ones[Math.floor(x / 100)]} Hundred`;
      x %= 100;
      if (x) out += " ";
    }
    if (x >= 20) {
      out += tens[Math.floor(x / 10)];
      if (x % 10) out += `-${ones[x % 10]}`;
    } else if (x > 0) {
      out += ones[x];
    }
    return out;
  }
  const value = Math.round((Number(n) || 0) * 100);
  let dollars = Math.floor(value / 100);
  const cents = value % 100;
  if (dollars === 0 && cents === 0) return "Zero Dollars";
  const parts = [];
  const scales = [[1e6, "Million"], [1e3, "Thousand"]];
  scales.forEach(([size, name]) => {
    if (dollars >= size) {
      parts.push(`${below1000(Math.floor(dollars / size))} ${name}`);
      dollars %= size;
    }
  });
  if (dollars) parts.push(below1000(dollars));
  let text = parts.join(" ");
  const whole = Math.floor(value / 100);
  text = text ? `${text} ${whole === 1 ? "Dollar" : "Dollars"}` : "";
  if (cents) text += `${text ? " and " : ""}${cents} Cents`;
  return text;
}

// Live list of every payment, newest first.
export function subscribePayments(onData, onError) {
  return onSnapshot(
    collection(db, PAYMENTS_COLLECTION),
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0) || (a.receiptNo < b.receiptNo ? 1 : -1));
      onData(list);
    },
    onError
  );
}

// Records one payment. Document ID = receipt number (e.g. "RS-2026-004").
// Returns the saved payment (with a local date so the receipt can print at once).
export async function recordPayment({ student, month, amount, amountDue, paidBefore, method, note, cashier }) {
  const seq = await generateNextId("receipts");
  const receiptNo = `RS-${todayStr().slice(0, 4)}-${seq}`;
  const balance = Math.max(0, Number(amountDue) - Number(paidBefore) - Number(amount));

  const data = {
    receiptNo,
    studentId: student.studentId,
    studentName: student.fullName || "",
    className: student.className || "",
    classGroups: student.classGroups || [],
    parentPhone: student.parentPhone || "",
    month,
    amountDue: Number(amountDue) || 0,
    paidBefore: Number(paidBefore) || 0,
    amount: Number(amount) || 0,
    balance,
    method,
    note: note || "",
    cashierId: cashier?.id || cashier?.cashierId || "",
    cashierName: cashier?.fullName || cashier?.email || cashier?.username || "",
    cashierEmail: cashier?.email || "",
    date: todayStr(),
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, PAYMENTS_COLLECTION, receiptNo), data);
  return { ...data, id: receiptNo, createdAt: null, localTime: new Date().toISOString() };
}