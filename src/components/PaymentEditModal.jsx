// src/components/PaymentEditModal.jsx
//
// Wax ka beddelka lacag horey loo qaaday.
//  • Admin: wuxuu beddeli karaa lacagta, bisha, method-ka iyo note-ka.
//    Amount = 0 → payment-ka waa laga noqonayaa (UNPAID) — sidan ayuu maamulku
//    u "amraa" in lacagta dib loo qaado.
//  • Cashier: method-ka iyo note-ka oo keliya (lacagta iyo bisha waa xiran yihiin),
//    si aan lacag la qaaday loo tirtirin oo mar kale looga qaadin ardayga.
// Wax walba waxay maraan updatePayment() (transaction) — utils/payments.js.

import { useMemo, useState } from "react";
import { X, Save, Pencil, Lock } from "lucide-react";
import { PAYMENT_METHODS } from "../config/schoolOptions";
import { formatMonth, money, updatePayment } from "../utils/payments";
import { initials } from "./PortalLayout";

export default function PaymentEditModal({ payment, payments = [], student, editor, onClose, onSaved }) {
  const isAdmin = editor?.role === "admin";
  const [amount, setAmount] = useState(String(payment.amount ?? ""));
  const [month, setMonth] = useState(payment.month || "");
  const [method, setMethod] = useState(payment.method || PAYMENT_METHODS[0]);
  const [note, setNote] = useState(payment.note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const amountDue = Number(student?.monthlyFee ?? payment.amountDue) || 0;

  // Lacagaha kale ee ardaygan ee isla bisha (rasiidkan laga reebay)
  const otherPaid = useMemo(
    () =>
      payments
        .filter((p) => p.id !== payment.id && p.studentId === payment.studentId && p.month === month && !p.reversed)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [payments, payment, month]
  );

  const value = amount === "" ? 0 : Number(amount) || 0;
  const maxAllowed = Math.max(0, amountDue - otherPaid);
  const newBalance = Math.max(0, amountDue - otherPaid - value);

  async function save(e) {
    e.preventDefault();
    setError("");
    if (amount === "" || Number.isNaN(Number(amount))) return setError("Geli lacagta (0 = ka noqo).");
    if (value < 0) return setError("Lacagtu ma noqon karto taban (negative).");
    if (!month) return setError("Dooro bisha.");
    if (isAdmin && value > 0 && amountDue > 0 && value > maxAllowed) {
      return setError(`Lacagtu waxay ka badan tahay inta ka hartay bishaas (${money(maxAllowed)}).`);
    }

    setSaving(true);
    try {
      const saved = await updatePayment({
        payment,
        amount: isAdmin ? value : Number(payment.amount) || 0,
        month: isAdmin ? month : payment.month,
        method,
        note,
        amountDue,
        editor,
      });
      onSaved?.(saved);
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
              <strong>
                <Pencil size={14} /> Edit payment — {payment.receiptNo}
              </strong>
              <span>
                {payment.studentName} • ID {payment.studentId}
              </span>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="fee-summary">
          <div>
            <span>Monthly fee</span>
            <strong>{money(amountDue)}</strong>
          </div>
          <div>
            <span>Other payments</span>
            <strong>{money(otherPaid)}</strong>
          </div>
          <div className="hl">
            <span>{value === 0 ? "Unpaid balance" : "New balance"}</span>
            <strong>{money(newBalance)}</strong>
          </div>
        </div>

        {!isAdmin && (
          <div className="notice notice-amber">
            <Lock size={16} />
            <div>
              <strong>Lacagta iyo bisha waa xiran yihiin</strong>
              <span>
                Cashier-ku wuxuu beddeli karaa habka lacag-bixinta iyo note-ka oo keliya. Haddii lacagta khalad tahay,
                la xiriir maamulka (Admin).
              </span>
            </div>
          </div>
        )}

        {isAdmin && value === 0 && (
          <div className="notice notice-amber">
            <div>
              <strong>Payment-kan wuxuu noqonayaa UNPAID</strong>
              <span>Lacagtii hore waa laga noqonayaa — cashier-ku markaas ayuu mar kale qaadi karaa.</span>
            </div>
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <label>
          Amount ($)
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!isAdmin}
            autoFocus={isAdmin}
            required
          />
        </label>

        <label>
          Month (bisha) — {formatMonth(month)}
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            disabled={!isAdmin}
            required
          />
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
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={value === 0 ? "Payment reversed" : ""} />
        </label>

        {Array.isArray(payment.editHistory) && payment.editHistory.length > 0 && (
          <p className="hint">
            Horey ayaa wax looga beddelay {payment.editHistory.length} jeer
            {payment.editedBy?.name ? ` — ugu dambeyn: ${payment.editedBy.name}` : ""}.
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-lg full" disabled={saving}>
          <Save size={16} />
          {saving ? "Saving..." : isAdmin && value === 0 ? "Save as Unpaid" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
