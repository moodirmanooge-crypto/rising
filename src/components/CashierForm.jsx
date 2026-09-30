import { useState } from "react";
import { collection, doc, getDoc, getDocs, query, setDoc, serverTimestamp, where } from "firebase/firestore";
import { Wallet, CheckCircle2, Copy, RefreshCw } from "lucide-react";
import { db } from "../firebase";
import { CASHIERS_COLLECTION } from "../config/collections";

function makePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 8; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
  return p;
}

const emptyForm = () => ({ fullName: "", phone: "", email: "", password: makePassword() });

// Admin creates a cashier account. Document ID in rssCashiers = normalized email.
export default function CashierForm() {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setCreated(null);
    setCopied(false);

    const email = form.email.trim().toLowerCase();
    if (!form.fullName.trim()) return setError("Full name is required.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    if (form.password.trim().length < 6) return setError("Password must be at least 6 characters.");

    setSaving(true);
    try {
      const ref = doc(db, CASHIERS_COLLECTION, email);
      const existing = await getDoc(ref);
      if (existing.exists()) throw new Error(`Email "${email}" is already registered.`);

      // Also prevent a new email from colliding with an older cashier
      // account that still uses the old username field.
      const legacyMatch = await getDocs(
        query(collection(db, CASHIERS_COLLECTION), where("username", "==", email))
      );
      if (!legacyMatch.empty) throw new Error(`Email "${email}" is already used by an existing cashier account.`);

      const data = {
        cashierId: email,
        email,
        password: form.password.trim(),
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        role: "cashier",
        active: true,
        createdAt: serverTimestamp(),
      };
      await setDoc(ref, data);
      setCreated(data);
      setForm(emptyForm());
    } catch (err) {
      setError(err.message || "Failed to create cashier.");
    } finally {
      setSaving(false);
    }
  }

  function copyCredentials() {
    if (!created) return;
    const text = `Rising Institute — Cashier Login\nEmail: ${created.email}\nPassword: ${created.password}`;
    navigator.clipboard?.writeText(text).then(() => setCopied(true));
  }

  return (
    <form className="panel form" onSubmit={handleSubmit}>
      <div className="panel-head">
        <div className="panel-icon"><Wallet size={20} /></div>
        <div>
          <h2>Create Cashier Account</h2>
          <p>Samee cashier, sii email iyo password si uu ugu galo Cashier Portal.</p>
        </div>
      </div>

      {created && (
        <div className="credential-card">
          <div className="credential-head">
            <CheckCircle2 size={22} />
            <div>
              <strong>Cashier created</strong>
              <span>{created.fullName} can now sign in to the Cashier Portal.</span>
            </div>
          </div>
          <div className="credential-grid">
            <div><span>Email</span><strong>{created.email}</strong></div>
            <div><span>Password</span><strong>{created.password}</strong></div>
          </div>
          <button type="button" className="btn btn-light" onClick={copyCredentials}>
            <Copy size={15} /> {copied ? "Copied!" : "Copy login details"}
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="form-grid">
        <label>
          Full Name
          <input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} required />
        </label>
        <label>
          Phone
          <input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="061xxxxxxx" />
        </label>
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value.trim().toLowerCase())}
            placeholder="e.g. cashier@risingstar.so"
            autoComplete="email"
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
      </div>

      <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
        {saving ? "Creating..." : "Create Cashier"}
      </button>
    </form>
  );
}