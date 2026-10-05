// src/components/FeeRow.jsx — safka ardayga ee lacagta bisha (Cashier Portal: Fees + Classes)

import { Printer, Pencil, DollarSign } from "lucide-react";
import { studentGroups } from "../config/schoolOptions";
import { money } from "../utils/payments";
import { initials } from "./PortalLayout";

export const STATUS = {
  paid: { label: "Paid", so: "Bixiyay", cls: "pill-green" },
  partial: { label: "Partial", so: "Qayb", cls: "pill-amber" },
  unpaid: { label: "Unpaid", so: "Lama bixin", cls: "pill-red" },
  free: { label: "No fee", so: "Bilaash", cls: "pill-blue" },
};

export default function FeeRow({ row, last, onReceipt, onEdit, onPay }) {
  const { student, due, paid, remaining, status } = row;
  const st = STATUS[status];
  const groups = studentGroups(student);
  return (
    <div className="record-row fee-row">
      <div className="record-student">
        {student.photoUrl ? (
          <img src={student.photoUrl} alt={student.fullName} className="avatar" />
        ) : (
          <span className="avatar avatar-placeholder">{initials(student.fullName)}</span>
        )}
        <div>
          <strong>{student.fullName}</strong>
          <span>ID {student.studentId} • {groups.join(", ") || "No class"}</span>
        </div>
      </div>
      <div className="fee-figures">
        <div><span>Fee</span><strong>{money(due)}</strong></div>
        <div><span>Paid</span><strong className="txt-green">{money(paid)}</strong></div>
        <div><span>Left</span><strong className={remaining ? "txt-red" : ""}>{money(remaining)}</strong></div>
      </div>
      <span className={`pill ${st.cls}`}><span className="pill-dot" />{st.label}</span>
      <div className="fee-actions">
        {last && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onReceipt(last)} title="Last receipt">
            <Printer size={14} />
          </button>
        )}
        {last && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(last)} title="Edit payment">
            <Pencil size={14} />
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={status === "paid" || status === "free"}
          onClick={() => onPay({ student, due, paid, remaining })}
        >
          <DollarSign size={14} /> {status === "paid" ? "Paid" : "Receive"}
        </button>
      </div>
    </div>
  );
}