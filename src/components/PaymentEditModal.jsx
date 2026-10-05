// src/components/PaymentEditModal.jsx
//
// Wax ka beddelka lacag horey loo qaaday — Admin iyo Cashier labaduba.
// Waxaa la beddeli karaa: cadadka, bisha, habka lacag bixinta iyo note-ka.
// Balance-ka si toos ah ayaa dib loo xisaabiyaa (lacagaha kale ee ardaygaas
// ee isla bishaas waa la tixgeliyaa). Isbeddel kasta waxaa lagu kaydiyaa
// editHistory (cidda beddeshay, goorta, iyo qiimihii hore).

import { useMemo, useState } from "react";
import { arrayUnion, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { X, Save, Pencil } from "lucide-react";
import { db } from "../firebase";
import { PAYMENTS_COLLECTION } from "../config/collections";
import { PAYMENT_METHODS } from "../config/schoolOptions";
import { formatMonth, money } from "../utils/payments";
import { initials } from "./PortalLayout";
import { logActivity } from "../utils/cashierActivity";

export default function PaymentEditModal({ payment, payments = [], student, editor, onClose, onSaved }) {
  const [amount, setAmount] = useState(String(payment.amount ?? ""));
  const [month, setMonth] = useState(payment.month || "");
  const [method, setMethod] = useState(payment.method || PAYMENT_METHODS[0]);
  const [note, setNote] = useState(payment.note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Lacagta bisha: haddii ardaygu hadda leeyahay monthly fee, kaas; haddii kale kii rasiidka
  const amountDue = Number(student?.monthlyFee ?? payment.amountDue) || 0;

  // Lacagaha kale ee ardaygan ee bisha la doortay (rasiidkan mooyee)
  const otherPaid = useMemo(
    () =>
      payments
        .filter((p) => p.id !== payment.id && p.studentId === payment.studentId && p.month === month)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [payments, payment, month]
  );

  const value = Number(amount) || 0;
  const maxAllowed = Math.max(0, amountDue - otherPaid);
  const newBalance = Math.max(0, amountDue - otherPaid - value);

  async function save(e) {
    e.preventDefault();
    setError("");
    if (!(value > 0)) return setError("Geli cadad ka badan 0.");
    if (!month) return setError("Dooro bisha.");
    if (amountDue > 0 && value > maxAllowed) {
      return setError(`Cadadku wuxuu ka badan yahay inta ka hartay bishaas (${money(maxAllowed)}).`);
    }

    setSaving(true);
    try {
      const before = {
        amount: Number(payment.amount) || 0,
        month: payment.month || "",
        method: payment.method || "",
        note: payment.note || "",
        balance: Number(payment.balance) || 0,
      };
      const by = {
        role: editor?.role || "",
        id: editor?.id || editor?.username || editor?.email || "",
        name: editor?.fullName || editor?.username || editor?.email || "",
      };
      const updates = {
        amount: value,
        month,
        method,
        note: note.trim(),
        amountDue,
        paidBefore: otherPaid,
        balance: newBalance,
        edited: true,
        editedAt: serverTimestamp(),
        editedBy: by,
        editHistory: arrayUnion({ ...before, changedAt: new Date().toISOString(), by }),
      };
      await updateDoc(doc(db, PAYMENTS_COLLECTION, payment.id), updates);

      const changes = [];
      if (before.amount !== value) changes.push(`amount ${money(before.amount)} → ${money(value)}`);
      if (before.month !== month) changes.push(`month ${formatMonth(before.month)} → ${formatMonth(month)}`);
      if (before.method !== method) changes.push(`method ${before.method} → ${method}`);
      if (before.note !== note.trim()) changes.push("note changed");
      logActivity({
        actor: editor,
        type: "payment_edit",
        payment: { ...payment, ...updates },
        summary: `Edited ${payment.receiptNo} (${payment.studentName}): ${changes.join(", ") || "no visible change"}`,
      });
      onSaved?.({ ...payment, ...updates, editedAt: null, editHistory: undefined });
    } catch (err) {
      setError(err.message || "Lama kaydin karin.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onSubmit={save} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="record-student">
            <span className="avatar avatar-placeholder">{initials(payment.studentName)}</span>
            <div>
              <strong><Pencil size={14} /> Edit payment — {payment.receiptNo}</strong>
              <span>{payment.studentName} • ID {payment.studentId}</span>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="fee-summary">
          <div><span>Monthly fee</span><strong>{money(amountDue)}</strong></div>
          <div><span>Other payments</span><strong>{money(otherPaid)}</strong></div>
          <div className="hl"><span>New balance</span><strong>{money(newBalance)}</strong></div>
        </div>

        {error && <p className="error">{error}</p>}

        <label>
          Amount ($)
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            required
          />
        </label>
        <label>
          Month (bisha) — {formatMonth(month)}
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} required />
        </label>
        <div className="field">
          <span className="field-label">Payment method</span>
          <div className="day-picker">
            {PAYMENT_METHODS.map((m) => (
              <button key={m} type="button" className={`day-chip ${method === m ? "active" : ""}`} onClick={() => setMethod(m)}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <label>
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {Array.isArray(payment.editHistory) && payment.editHistory.length > 0 && (
          <p className="hint">
            Horey ayaa wax looga beddelay {payment.editHistory.length} jeer
            {payment.editedBy?.name ? ` — ugu dambeyn: ${payment.editedBy.name}` : ""}.
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-lg full" disabled={saving}>
          <Save size={16} /> {saving ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}