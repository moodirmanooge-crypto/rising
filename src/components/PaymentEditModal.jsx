// src/components/PaymentEditModal.jsx
//
// Wax ka beddelka lacag horey loo qaaday — Admin iyo Cashier labaduba.
// Haddii Amount = 0 → payment-ka waxaa loo celinayaa UNPAID.
// Balance-ka si toos ah ayaa dib loo xisaabiyaa.
// Isbeddel kasta waxaa lagu kaydiyaa editHistory.

import { useMemo, useState } from "react";
import {
  arrayUnion,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { X, Save, Pencil } from "lucide-react";
import { db } from "../firebase";
import { PAYMENTS_COLLECTION } from "../config/collections";
import { PAYMENT_METHODS } from "../config/schoolOptions";
import { formatMonth, money } from "../utils/payments";
import { initials } from "./PortalLayout";
import { logActivity } from "../utils/cashierActivity";

export default function PaymentEditModal({
  payment,
  payments = [],
  student,
  editor,
  onClose,
  onSaved,
}) {
  const [amount, setAmount] = useState(String(payment.amount ?? ""));
  const [month, setMonth] = useState(payment.month || "");
  const [method, setMethod] = useState(
    payment.method || PAYMENT_METHODS[0]
  );
  const [note, setNote] = useState(payment.note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Lacagta bisha
  const amountDue =
    Number(student?.monthlyFee ?? payment.amountDue) || 0;

  // Lacagaha kale ee ardaygan ee isla bisha
  // Payment-ka hadda la edit-gareynayo waa laga reebayaa.
  const otherPaid = useMemo(
    () =>
      payments
        .filter(
          (p) =>
            p.id !== payment.id &&
            p.studentId === payment.studentId &&
            p.month === month &&
            !p.reversed
        )
        .reduce(
          (sum, p) => sum + Number(p.amount || 0),
          0
        ),
    [payments, payment, month]
  );

  const value = Number(amount) || 0;

  // Lacagta ugu badan ee la oggol yahay
  const maxAllowed = Math.max(
    0,
    amountDue - otherPaid
  );

  // Balance-ka cusub
  const newBalance = Math.max(
    0,
    amountDue - otherPaid - value
  );

  // Status-ka cusub
  const paymentStatus =
    value === 0
      ? "unpaid"
      : newBalance <= 0
      ? "paid"
      : "partial";

  async function save(e) {
    e.preventDefault();
    setError("");

    // Negative lama oggola.
    // 0 waa la oggol yahay, waxaana loo qaadanayaa UNPAID.
    if (value < 0) {
      setError("Amount cannot be negative.");
      return;
    }

    if (!month) {
      setError("Dooro bisha.");
      return;
    }

    // Haddii lacagtu ka badan tahay balance-ka.
    // 0 laguma qabanayo validation-kan.
    if (
      value > 0 &&
      amountDue > 0 &&
      value > maxAllowed
    ) {
      setError(
        `Cadadku wuxuu ka badan yahay inta ka hartay bishaas (${money(
          maxAllowed
        )}).`
      );
      return;
    }

    setSaving(true);

    try {
      const before = {
        amount: Number(payment.amount) || 0,
        month: payment.month || "",
        method: payment.method || "",
        note: payment.note || "",
        balance: Number(payment.balance) || 0,
        status: payment.status || "",
        reversed: payment.reversed || false,
      };

      const by = {
        role: editor?.role || "",
        id:
          editor?.id ||
          editor?.username ||
          editor?.email ||
          "",
        name:
          editor?.fullName ||
          editor?.username ||
          editor?.email ||
          "",
      };

      const isReversed = value === 0;

      const updates = {
        amount: value,
        month,
        method,
        note: note.trim(),

        amountDue,
        paidBefore: otherPaid,

        // Haddii 0 → balance-ku waa lacagta wali lagu leeyahay.
        balance: newBalance,

        // paid / partial / unpaid
        status: paymentStatus,

        // 0 = payment-ka waa laga noqday
        reversed: isReversed,

        edited: true,
        editedAt: serverTimestamp(),
        editedBy: by,

        editHistory: arrayUnion({
          ...before,
          newAmount: value,
          newBalance,
          newStatus: paymentStatus,
          reversed: isReversed,
          changedAt: new Date().toISOString(),
          by,
        }),
      };

      await updateDoc(
        doc(db, PAYMENTS_COLLECTION, payment.id),
        updates
      );

      const changes = [];

      if (before.amount !== value) {
        if (isReversed) {
          changes.push(
            `payment reversed: ${money(
              before.amount
            )} → ${money(0)}`
          );
        } else {
          changes.push(
            `amount ${money(
              before.amount
            )} → ${money(value)}`
          );
        }
      }

      if (before.month !== month) {
        changes.push(
          `month ${formatMonth(
            before.month
          )} → ${formatMonth(month)}`
        );
      }

      if (before.method !== method) {
        changes.push(
          `method ${before.method} → ${method}`
        );
      }

      if (before.note !== note.trim()) {
        changes.push("note changed");
      }

      changes.push(
        `status → ${paymentStatus.toUpperCase()}`
      );

      logActivity({
        actor: editor,
        type: isReversed
          ? "payment_reversed"
          : "payment_edit",
        payment: {
          ...payment,
          ...updates,
        },
        summary: isReversed
          ? `Reversed payment ${payment.receiptNo} (${payment.studentName}) → UNPAID`
          : `Edited ${payment.receiptNo} (${payment.studentName}): ${
              changes.join(", ") ||
              "no visible change"
            }`,
      });

      onSaved?.({
        ...payment,
        ...updates,
        editedAt: null,
        editHistory: undefined,
      });

      onClose?.();
    } catch (err) {
      setError(
        err.message || "Lama kaydin karin."
      );
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
    >
      <form
        className="modal"
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div className="record-student">
            <span className="avatar avatar-placeholder">
              {initials(payment.studentName)}
            </span>

            <div>
              <strong>
                <Pencil size={14} /> Edit payment —{" "}
                {payment.receiptNo}
              </strong>

              <span>
                {payment.studentName} • ID{" "}
                {payment.studentId}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
          >
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
            <span>
              {value === 0
                ? "Unpaid balance"
                : "New balance"}
            </span>

            <strong>
              {money(newBalance)}
            </strong>
          </div>
        </div>

        {value === 0 && (
          <div
            className="hint"
            style={{
              marginBottom: 14,
              padding: 12,
              borderRadius: 10,
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              color: "#9a3412",
            }}
          >
            <strong>
              Payment will become UNPAID
            </strong>

            <div style={{ marginTop: 4 }}>
              Lacagtii hore waa laga noqonayaa,
              ardayguna wuxuu dib ugu noqonayaa
              Unpaid.
            </div>
          </div>
        )}

        {error && (
          <p className="error">
            {error}
          </p>
        )}

        <label>
          Amount ($)
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value)
            }
            autoFocus
            required
          />
        </label>

        <label>
          Month (bisha) — {formatMonth(month)}
          <input
            type="month"
            value={month}
            onChange={(e) => {
              if (e.target.value) {
                setMonth(e.target.value);
              }
            }}
            required
          />
        </label>

        <div className="field">
          <span className="field-label">
            Payment method
          </span>

          <div className="day-picker">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                className={`day-chip ${
                  method === m ? "active" : ""
                }`}
                onClick={() => setMethod(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <label>
          Note (optional)
          <input
            value={note}
            onChange={(e) =>
              setNote(e.target.value)
            }
            placeholder={
              value === 0
                ? "Payment reversed"
                : ""
            }
          />
        </label>

        {Array.isArray(payment.editHistory) &&
          payment.editHistory.length > 0 && (
            <p className="hint">
              Horey ayaa wax looga beddelay{" "}
              {payment.editHistory.length} jeer
              {payment.editedBy?.name
                ? ` — ugu dambeyn: ${payment.editedBy.name}`
                : ""}
              .
            </p>
          )}

        <button
          type="submit"
          className="btn btn-primary btn-lg full"
          disabled={saving}
        >
          <Save size={16} />

          {saving
            ? "Saving..."
            : value === 0
            ? "Save as Unpaid"
            : "Save changes"}
        </button>
      </form>
    </div>
  );
}