// src/components/CashierEditModal.jsx
//
// Admin → Cashiers: wax ka beddel akoonka cashier-ka (magaca, phone, email/username,
// password iyo status). Document ID ee rssCashiers waa email-ka, marka haddii email-ka
// la beddelo: doc cusub ayaa la sameeyaa, kii hore waa la tirtiraa, rasiidyadii hore
// (rssPayments) waxaa loo beddelayaa cashier-ka cusub si report-ku u sii socdo.

import { useState } from "react";
import {
  collection, doc, getDoc, getDocs, query, where, writeBatch, serverTimestamp,
} from "firebase/firestore";
import { X, Save, RefreshCw, Pencil } from "lucide-react";
import { db } from "../firebase";
import { CASHIERS_COLLECTION, PAYMENTS_COLLECTION } from "../config/collections";
import { initials } from "./PortalLayout";

function makePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 8; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
  return p;
}

export default function CashierEditModal({ cashier, onClose, onSaved }) {
  const [form, setForm] = useState({
    fullName: cashier.fullName || "",
    phone: cashier.phone || "",
    email: cashier.email || cashier.username || "",
    password: cashier.password || "",
    active: cashier.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function save(e) {
    e.preventDefault();
    setError("");

    const fullName = form.fullName.trim();
    const email = form.email.trim().toLowerCase();
    const password = form.password.trim();
    if (!fullName) return setError("Full name is required.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");

    setSaving(true);
    try {
      const oldId = cashier.id;
      const oldEmail = String(cashier.email || cashier.username || "").toLowerCase();
      const emailChanged = email !== oldEmail || email !== oldId;

      const base = {
        fullName,
        phone: form.phone.trim(),
        email,
        password,
        active: form.active,
        updatedAt: serverTimestamp(),
      };

      if (!emailChanged) {
        // Isla doc-ga ayaa la cusboonaysiiyaa
        const batch = writeBatch(db);
        batch.update(doc(db, CASHIERS_COLLECTION, oldId), base);
        await syncPayments(batch, oldId, oldId, { fullName, email });
        await batch.commit();
      } else {
        // Hubi in email-ka cusub uusan hore u jirin
        if (email !== oldId) {
          const exists = await getDoc(doc(db, CASHIERS_COLLECTION, email));
          if (exists.exists()) throw new Error(`Email "${email}" is already used by another cashier.`);
        }
        const legacy = await getDocs(
          query(collection(db, CASHIERS_COLLECTION), where("username", "==", email))
        );
        if (legacy.docs.some((d) => d.id !== oldId)) {
          throw new Error(`Email "${email}" is already used by another cashier.`);
        }

        const newId = email;
        const batch = writeBatch(db);
        const { password: _p, ...rest } = cashier; // eslint-disable-line no-unused-vars
        const { id: _id, ...old } = rest; // eslint-disable-line no-unused-vars
        batch.set(doc(db, CASHIERS_COLLECTION, newId), {
          ...old,
          ...base,
          cashierId: newId,
          role: "cashier",
        });
        if (newId !== oldId) batch.delete(doc(db, CASHIERS_COLLECTION, oldId));
        await syncPayments(batch, oldId, newId, { fullName, email });
        await batch.commit();
      }

      onSaved?.({ fullName, email, password });
    } catch (err) {
      setError(err.message || "Failed to save cashier.");
      setSaving(false);
    }
  }

  // Rasiidyadii cashier-kan ayaa loo beddelayaa magaca/email-ka cusub
  async function syncPayments(batch, oldId, newId, { fullName, email }) {
    const snap = await getDocs(
      query(collection(db, PAYMENTS_COLLECTION), where("cashierId", "==", oldId))
    );
    snap.docs.slice(0, 450).forEach((d) => {
      batch.update(d.ref, { cashierId: newId, cashierName: fullName, cashierEmail: email });
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onSubmit={save} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="record-student">
            <span className="avatar avatar-placeholder">{initials(cashier.fullName)}</span>
            <div>
              <strong>Edit cashier</strong>
              <span>{cashier.email || cashier.username}</span>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {error && <p className="error">{error}</p>}

        <label>
          Full Name
          <input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} required />
        </label>
        <label>
          Phone
          <input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="061xxxxxxx" />
        </label>
        <label>
          Email (login username)
          <input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value.trim().toLowerCase())}
            required
          />
        </label>
        <label>
          Password
          <div className="input-icon no-lead">
            <input value={form.password} onChange={(e) => update("password", e.target.value)} required />
            <button
              type="button"
              className="input-toggle"
              title="Generate new password"
              onClick={() => update("password", makePassword())}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </label>

        <div className="field">
          <span className="field-label">Status</span>
          <div className="day-picker">
            <button type="button" className={`day-chip ${form.active ? "active" : ""}`} onClick={() => update("active", true)}>Active</button>
            <button type="button" className={`day-chip ${!form.active ? "active" : ""}`} onClick={() => update("active", false)}>Disabled</button>
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-lg full" disabled={saving}>
          <Save size={16} /> {saving ? "Saving..." : "Save changes"}
        </button>
        <p className="hint" style={{ margin: 0 }}>
          <Pencil size={12} /> Haddii email-ka la beddelo, cashier-ku wuxuu u galayaa email-ka cusub; rasiidyadii hore way raacayaan.
        </p>
      </form>
    </div>
  );
}