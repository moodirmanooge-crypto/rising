import { useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Wallet, CheckCircle2, Copy, RefreshCw } from "lucide-react";
import { db } from "../firebase";
import { CASHIERS_COLLECTION } from "../config/collections";

function makePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 8; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
  return p;
}

const emptyForm = () => ({ fullName: "", phone: "", username: "", password: makePassword() });

// Admin creates a cashier account. Document ID in rssCashiers = username.
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

    const username = form.username.trim().toLowerCase();
    if (!form.fullName.trim()) return setError("Full name is required.");
    if (!/^[a-z0-9._-]{3,}$/.test(username)) {
      return setError("Username: at least 3 characters — letters, numbers, dot, dash or underscore, no spaces.");
    }
    if (form.password.trim().length < 6) return setError("Password must be at least 6 characters.");

    setSaving(true);
    try {
      const ref = doc(db, CASHIERS_COLLECTION, username);
      const existing = await getDoc(ref);
      if (existing.exists()) throw new Error(`Username "${username}" is already taken.`);

      const data = {
        cashierId: username,
        username,
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
    const text = `Rising Star School — Cashier Login\nUsername: ${created.username}\nPassword: ${created.password}`;
    navigator.clipboard?.writeText(text).then(() => setCopied(true));
  }

  return (
    <form className="panel form" onSubmit={handleSubmit}>
      <div className="panel-head">
        <div className="panel-icon"><Wallet size={20} /></div>
        <div>
          <h2>Create Cashier Account</h2>
          <p>Samee cashier, sii username iyo password si uu u galo Cashier Portal.</p>
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
            <div><span>Username</span><strong>{created.username}</strong></div>
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
          Username
          <input
            value={form.username}
            onChange={(e) => update("username", e.target.value.replace(/\s/g, "").toLowerCase())}
            placeholder="e.g. hodan.cashier"
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