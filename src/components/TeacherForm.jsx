import { useState } from "react";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { UserPlus, Clock, CalendarDays, BookOpen, CheckCircle2, Copy, KeyRound, Shuffle, Save, X } from "lucide-react";
import { db } from "../firebase";
import { DAYS, SUBJECT_OPTIONS, CLASS_GROUPS } from "../config/schoolOptions";
import { TEACHERS_COLLECTION } from "../config/collections";
import { formatTime12, getTeacherDays } from "../utils/attendance";
import TimePicker12 from "./TimePicker12";

const emptyForm = {
  fullName: "",
  phone: "",
  password: "",
  className: "",
  subject: "",
  attendanceDays: [],
  startTime: "07:30",
  endTime: "08:30",
};

const MIN_PASSWORD = 4;

function generatePassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

  let password = "";

  for (let i = 0; i < 8; i++) {
    password += chars.charAt(
      Math.floor(Math.random() * chars.length)
    );
  }

  return password;
}

function formFromTeacher(t) {
  if (!t) return emptyForm;
  return {
    fullName: t.fullName || "",
    phone: t.phone || "",
    password: t.password ? String(t.password) : "",
    className: t.className || t.class || "",
    subject: t.subject || (Array.isArray(t.subjects) && t.subjects.length ? t.subjects[0] : ""),
    attendanceDays: getTeacherDays(t),
    startTime: t.startTime || "",
    endTime: t.endTime || "",
  };
}

// editTeacher: haddii la soo diro, foomku wuxuu noqonayaa "Edit Teacher"
// (username-ka lama beddelo — waa document ID-ga).
export default function TeacherForm({ onRegistered, editTeacher = null, onDone, onCancel }) {
  const isEdit = !!editTeacher;
  const [form, setForm] = useState(() => formFromTeacher(editTeacher));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  function update(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function toggleDay(day) {
    setForm((prev) => ({
      ...prev,
      attendanceDays: prev.attendanceDays.includes(day)
        ? prev.attendanceDays.filter((d) => d !== day)
        : DAYS.filter((d) => d === day || prev.attendanceDays.includes(d)),
    }));
  }

  async function generateUsername(fullName) {
    /*
     * Username-ka waxaa laga sameeyaa magaca koowaad ee macalinka
     * + 3 lambar (tusaale: "Ahmed Jama" -> "ahmed482").
     * Username-kaas ayaa noqonaya document ID-ga collection-ka teacher1.
     * Waxaa la hubinayaa inuusan hore u jirin.
     */
    const firstName = fullName.trim().split(/\s+/)[0] || "";
    const base =
      firstName.toLowerCase().replace(/[^a-z]/g, "") || "teacher";

    while (true) {
      const number = Math.floor(100 + Math.random() * 900);
      const username = `${base}${number}`;
      const teacherRef = doc(db, TEACHERS_COLLECTION, username);
      const snapshot = await getDoc(teacherRef);

      if (!snapshot.exists()) {
        return username;
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setCreated(null);
    setCopied(false);

    const password = form.password.trim();

    if (!form.fullName.trim()) return setError("Full Name is required.");
    if (password.length < MIN_PASSWORD) {
      return setError(`Geli password-ka macalinka (ugu yaraan ${MIN_PASSWORD} xaraf/lambar).`);
    }
    if (/\s/.test(password)) return setError("Password-ku waa inuusan lahayn meel bannaan (space).");
    if (!form.className.trim()) return setError("Class is required.");
    if (!form.subject.trim()) return setError("Subject is required.");
    if (form.attendanceDays.length === 0) return setError("Select at least one attendance day.");
    if (!form.startTime || !form.endTime) return setError("Attendance start and end time are required (dooro AM ama PM).");
    if (form.startTime >= form.endTime) return setError("End time must be after start time.");

    setSaving(true);

    try {
      const schedule = {
        password,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        className: form.className.trim(),
        subject: form.subject.trim(),
        subjects: [form.subject.trim()],
        attendanceDays: form.attendanceDays,
        // kept for older screens that still read a single day
        attendanceDay: form.attendanceDays[0],
        // 24-saac: 1:00 PM = "13:00" (TimePicker12)
        startTime: form.startTime,
        endTime: form.endTime,
      };

      if (isEdit) {
        const id = editTeacher.username || editTeacher.teacherId;
        await updateDoc(doc(db, TEACHERS_COLLECTION, id), {
          ...schedule,
          updatedAt: serverTimestamp(),
        });
        onDone?.({ username: id, password });
        return;
      }

      const teacherUsername = await generateUsername(form.fullName);

      const data = {
        teacherId: teacherUsername,
        username: teacherUsername,
        ...schedule,
        role: "teacher",
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, TEACHERS_COLLECTION, teacherUsername), data);

      setCreated({ ...data, createdAt: null });
      setForm(emptyForm);
      onRegistered?.(teacherUsername);
    } catch (err) {
      console.error("Teacher save error:", err);
      setError(err.message || "Failed to save teacher.");
    } finally {
      setSaving(false);
    }
  }

  function copyCredentials() {
    if (!created) return;
    const text = `Rising Star School — Teacher Login\nUsername: ${created.username}\nPassword: ${created.password}`;
    navigator.clipboard?.writeText(text).then(() => setCopied(true));
  }

  return (
    <form className={isEdit ? "form" : "panel form"} onSubmit={handleSubmit}>
      <div className="panel-head">
        <div className="panel-icon"><UserPlus size={20} /></div>
        <div>
          <h2>{isEdit ? `Edit Teacher — ${editTeacher.username || editTeacher.teacherId}` : "Register New Teacher"}</h2>
          <p>
            {isEdit
              ? "Wax ka beddel xogta macalinka, password-ka iyo goorta xaadirinta."
              : "Diiwaan geli macalinka, maadada uu dhigo iyo goorta uu xaadirinayo."}
          </p>
        </div>
      </div>

      {created && (
        <div className="credential-card">
          <div className="credential-head">
            <CheckCircle2 size={22} />
            <div>
              <strong>Teacher registered successfully</strong>
              <span>{created.fullName} — {created.subject} • {created.className}</span>
            </div>
          </div>
          <div className="credential-grid">
            <div><span>Username</span><strong>{created.username}</strong></div>
            <div><span>Password</span><strong>{created.password}</strong></div>
            <div><span>Days</span><strong>{created.attendanceDays.join(", ")}</strong></div>
            <div><span>Time</span><strong>{formatTime12(created.startTime)} – {formatTime12(created.endTime)}</strong></div>
          </div>
          <button type="button" className="btn btn-light" onClick={copyCredentials}>
            <Copy size={15} /> {copied ? "Copied!" : "Copy login details"}
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="form-section-title">Personal info</div>
      <div className="form-grid">
        <label>
          Full Name
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => update("fullName", e.target.value)}
            placeholder="Teacher full name"
            required
          />
        </label>

        <label>
          Phone
          <input
            type="text"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="061xxxxxxx"
          />
        </label>

        {isEdit && (
          <label>
            Username (login)
            <input type="text" value={editTeacher.username || editTeacher.teacherId} readOnly disabled />
          </label>
        )}

        <label>
          Portal Password (Password-ka macalinka)
          <div style={{ display: "flex", gap: 8 }}>
            <div className="input-icon" style={{ flex: 1 }}>
              <KeyRound size={17} />
              <input
                type="text"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="Maamulka ayaa gelinaya"
                autoComplete="new-password"
                required
              />
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              title="Samee password"
              onClick={() => update("password", generatePassword())}
            >
              <Shuffle size={14} /> Generate
            </button>
          </div>
        </label>
      </div>
      {!isEdit && (
        <p className="hint">
          Username-ka si toos ah ayaa loo sameeyaa (tusaale: ahmed482). Macalinku wuxuu Teacher
          Portal-ka ku galayaa username-kaas iyo password-ka aad halkan geliso.
        </p>
      )}

      <div className="form-section-title"><BookOpen size={15} /> Class &amp; subject</div>
      <div className="form-grid">
        <label>
          Class
          <select
            value={form.className}
            onChange={(e) => update("className", e.target.value)}
            required
          >
            <option value="">Select class</option>
            {CLASS_GROUPS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            {form.className && !CLASS_GROUPS.includes(form.className) && (
              <option value={form.className}>{form.className}</option>
            )}
          </select>
        </label>

        <label>
          Subject (maadada)
          <select
            value={form.subject}
            onChange={(e) => update("subject", e.target.value)}
            required
          >
            <option value="">Select subject</option>
            {SUBJECT_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            {form.subject && !SUBJECT_OPTIONS.includes(form.subject) && (
              <option value={form.subject}>{form.subject}</option>
            )}
          </select>
        </label>
      </div>

      <div className="form-section-title"><CalendarDays size={15} /> Attendance days (maalmaha)</div>
      <div className="day-picker">
        {DAYS.map((day) => (
          <button
            key={day}
            type="button"
            className={`day-chip ${form.attendanceDays.includes(day) ? "active" : ""}`}
            onClick={() => toggleDay(day)}
          >
            {day.slice(0, 3)}
          </button>
        ))}
      </div>

      <div className="form-section-title"><Clock size={15} /> Attendance time (goorta xaadirinta)</div>
      <div className="form-grid">
        <label>
          Start time
          <TimePicker12 value={form.startTime} onChange={(v) => update("startTime", v)} />
        </label>
        <label>
          End time
          <TimePicker12 value={form.endTime} onChange={(v) => update("endTime", v)} />
        </label>
      </div>
      <p className="hint">
        Dooro AM (subax) ama PM (galab). PM wuxuu ka bilaabmaa 12:00 duhurnimo — 1:00 PM = 13:00.
        The teacher can only take attendance on the selected days, between the start and end time.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
          {isEdit ? <Save size={16} /> : null}
          {saving ? "Saving..." : isEdit ? "Save Changes" : "Register Teacher"}
        </button>
        {isEdit && (
          <button type="button" className="btn btn-ghost btn-lg" onClick={onCancel} disabled={saving}>
            <X size={16} /> Cancel
          </button>
        )}
      </div>
    </form>
  );
}