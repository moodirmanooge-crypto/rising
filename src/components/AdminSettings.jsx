// src/components/AdminSettings.jsx
//
// Admin → Settings
//  1) Akoonka: magaca, username-ka iyo password-ka (password-ka hadda jira ayaa
//     loo baahan yahay si wax loo beddelo).
//  2) Digniinaha: Allow (browser-ka), Test, iyo shid / dami cod + fariin.

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { Bell, BellOff, CheckCircle2, Eye, EyeOff, KeyRound, Save, ShieldCheck, UserCog, Volume2 } from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  alertsMuted, enableAdminAlerts, notifPermission, notifSupported, playAlarm, setAlertsMuted, systemNotify,
} from "../utils/adminAlerts";
import { VAPID_KEY } from "../config/push";

const ADMIN_COLLECTION = "admin";
const USERNAME_RE = /^[a-z0-9][a-z0-9._@-]{2,39}$/i;

function PassInput({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="as-pass">
      <KeyRound size={16} />
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Qari" : "Muuji"}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export default function AdminSettings() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    fullName: user?.fullName || "",
    username: user?.username || "",
    current: "",
    next: "",
    confirm: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const [perm, setPerm] = useState(notifPermission());
  const [muted, setMuted] = useState(alertsMuted());
  const [pushOn, setPushOn] = useState(false);

  useEffect(() => {
    const sync = () => {
      setPerm(notifPermission());
      setMuted(alertsMuted());
    };
    window.addEventListener("rss-alerts-changed", sync);
    return () => window.removeEventListener("rss-alerts-changed", sync);
  }, []);

  const set = (k, v) => {
    setError("");
    setNote("");
    setForm((f) => ({ ...f, [k]: v }));
  };

  async function save(e) {
    e.preventDefault();
    setError("");
    setNote("");
    const username = form.username.trim();
    const fullName = form.fullName.trim();
    if (!user?.id) return setError("Akoonka lama aqoonsan — dib u gal (login).");
    if (!USERNAME_RE.test(username)) return setError("Username: ugu yaraan 3 xaraf, meel bannaan ma laha (a–z, 0–9, . _ - @).");
    if (!form.current) return setError("Geli password-kaaga HADDA si aad u keydiso isbeddelka.");
    if (form.next || form.confirm) {
      if (form.next.length < 4) return setError("Password-ka cusub: ugu yaraan 4 xaraf/lambar.");
      if (/\s/.test(form.next)) return setError("Password-ku waa inuusan lahayn meel bannaan.");
      if (form.next !== form.confirm) return setError("Password-ka cusub iyo xaqiijintu isma laha.");
    }

    setSaving(true);
    try {
      const ref = doc(db, ADMIN_COLLECTION, user.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error("Akoonka admin-ka lama helin.");
      if (String(snap.data().password ?? "").trim() !== form.current.trim()) {
        throw new Error("Password-ka hadda (current) waa khalad.");
      }
      if (username !== snap.data().username) {
        const taken = await getDocs(query(collection(db, ADMIN_COLLECTION), where("username", "==", username)));
        if (taken.docs.some((d) => d.id !== user.id)) throw new Error(`Username-ka "${username}" horey ayaa loo qaatay.`);
      }
      const patch = { username, fullName, updatedAt: serverTimestamp() };
      if (form.next) patch.password = form.next;
      await updateDoc(ref, patch);
      updateUser({ username, fullName });
      setForm((f) => ({ ...f, current: "", next: "", confirm: "" }));
      setNote(
        form.next
          ? `✓ Waa la keydiyay. Login-ka xiga: username "${username}" iyo password-ka cusub.`
          : `✓ Waa la keydiyay. Login-ka xiga: username "${username}".`
      );
    } catch (err) {
      setError(err.message || "Lama keydin karin.");
    } finally {
      setSaving(false);
    }
  }

  async function allow() {
    const r = await enableAdminAlerts(user);
    setPerm(r.permission);
    setPushOn(r.push);
    if (r.permission === "granted") {
      setAlertsMuted(false);
      playAlarm(1);
      systemNotify("🔔 Digniinaha waa la shiday", "Marka macallin exam soo diro, cod iyo fariin ayaad heli doontaa.", "rss-test");
    }
    window.dispatchEvent(new Event("rss-alerts-changed"));
  }

  function toggleMute() {
    const next = !muted;
    setAlertsMuted(next);
    setMuted(next);
    if (!next) playAlarm(1);
  }

  const permText = {
    granted: { cls: "ok", text: "La ogolaaday (Allowed)" },
    default: { cls: "wait", text: "Weli lama ogolaan" },
    denied: { cls: "bad", text: "Waa la xannibay (Blocked)" },
    unsupported: { cls: "bad", text: "Browser-kan ma taageero" },
  }[perm] || { cls: "wait", text: perm };

  return (
    <div className="stack as-wrap">
      {/* ---------------- Account ---------------- */}
      <form className="panel form" onSubmit={save}>
        <div className="panel-head">
          <div className="panel-icon"><UserCog size={20} /></div>
          <div>
            <h2>Akoonka admin-ka</h2>
            <p>Beddel magacaaga, username-ka iyo password-ka aad ku gasho.</p>
          </div>
        </div>

        {error && <p className="error">{error}</p>}
        {note && <p className="banner banner-green" style={{ margin: 0 }}><CheckCircle2 size={18} /> {note}</p>}

        <div className="form-grid">
          <label>
            Magaca (Full name)
            <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="e.g. Guuleed Ibraahim" />
          </label>
          <label>
            Username
            <input value={form.username} onChange={(e) => set("username", e.target.value.replace(/\s+/g, ""))} autoComplete="username" required />
          </label>
        </div>

        <div className="as-divider"><ShieldCheck size={14} /> Password</div>
        <div className="form-grid">
          <label>
            Password-ka cusub (optional)
            <PassInput value={form.next} onChange={(v) => set("next", v)} placeholder="Ka tag bannaan haddii aadan beddelayn" autoComplete="new-password" />
          </label>
          <label>
            Xaqiiji password-ka cusub
            <PassInput value={form.confirm} onChange={(v) => set("confirm", v)} placeholder="Mar kale qor" autoComplete="new-password" />
          </label>
        </div>
        <label className="as-current">
          Password-ka HADDA (waajib si loo keydiyo)
          <PassInput value={form.current} onChange={(v) => set("current", v)} placeholder="Password-kaaga hadda" autoComplete="current-password" />
        </label>

        <div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            <Save size={16} /> {saving ? "Keydinaya…" : "Keydi isbeddelka"}
          </button>
        </div>
      </form>

      {/* ---------------- Notifications ---------------- */}
      <div className="panel">
        <div className="panel-head">
          <div className="panel-icon"><Bell size={20} /></div>
          <div>
            <h2>Digniinaha (Notifications)</h2>
            <p>Cod dheer + fariin marka macallin exam soo diro ama natiijo gudbiyo.</p>
          </div>
        </div>

        <div className="as-rows">
          <div className="as-row">
            <div>
              <strong>Ogolaanshaha browser-ka</strong>
              <span className={`as-state ${permText.cls}`}>{permText.text}</span>
              {perm === "denied" && (
                <small>Browser-ka: guji 🔒 (address bar-ka bidixdiisa) → Notifications → Allow, kadib dib u furo bogga.</small>
              )}
            </div>
            {perm !== "granted" && perm !== "unsupported" && notifSupported() && (
              <button type="button" className="btn btn-primary" onClick={allow} disabled={perm === "denied"}>
                <Bell size={16} /> Allow
              </button>
            )}
          </div>

          <div className="as-row">
            <div>
              <strong>Digniinaha (cod + fariin)</strong>
              <span className={`as-state ${muted ? "bad" : "ok"}`}>{muted ? "Dansan (Off)" : "Shidan (On)"}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!muted}
              className={`as-switch ${muted ? "" : "on"}`}
              onClick={toggleMute}
              title={muted ? "Shid" : "Dami"}
            >
              <i />
            </button>
          </div>

          <div className="as-row">
            <div>
              <strong>Tijaabi</strong>
              <span className="muted-sm">Cod-ka iyo fariinta system-ka hadda tijaabi.</span>
            </div>
            <button
              type="button"
              className="btn btn-light"
              onClick={() => {
                playAlarm(2);
                systemNotify("🔔 Tijaabo — Rising Star", "Digniinaha way shaqaynayaan.", "rss-test");
              }}
            >
              <Volume2 size={16} /> Test
            </button>
          </div>

          <div className="as-row">
            <div>
              <strong>Browser xiran (push)</strong>
              <span className={`as-state ${VAPID_KEY ? "ok" : "wait"}`}>
                {VAPID_KEY ? (pushOn ? "Waa la diiwaangeliyay" : "Diyaar — riix Allow") : "Lama dejin (VAPID_KEY)"}
              </span>
              <small>
                {VAPID_KEY
                  ? "Fariinta waxay imanaysaa xitaa marka browser-ka la xiro (functions/ waa in la deploy-gareeyay)."
                  : "Hadda: digniintu waxay timaadaa marka browser-ku furan yahay; exam-yadii intii aad maqnayd la soo diray waa lagu ogeysiinayaa marka aad soo gasho. Eeg ISBEDDELADA.md si push-ka loo dejiyo."}
              </small>
            </div>
            {perm === "granted" && VAPID_KEY && !pushOn && (
              <button type="button" className="btn btn-light" onClick={allow}>
                <BellOff size={16} /> Diiwaangeli
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}