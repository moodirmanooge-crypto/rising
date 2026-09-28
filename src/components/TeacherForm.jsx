import { useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { UserPlus, Clock, CalendarDays, BookOpen, CheckCircle2, Copy } from "lucide-react";
import { db } from "../firebase";
import { DAYS, SUBJECT_OPTIONS } from "../config/schoolOptions";
import { formatTime12 } from "../utils/attendance";

const emptyForm = {
  fullName: "",
  phone: "",
  className: "",
  subject: "",
  attendanceDays: [],
  startTime: "07:30",
  endTime: "08:30",
};

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

export default function TeacherForm({ onRegistered, classOptions = [] }) {
  const [form, setForm] = useState(emptyForm);
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
      const teacherRef = doc(db, "teacher1", username);
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

    if (!form.fullName.trim()) return setError("Full Name is required.");
    if (!form.className.trim()) return setError("Class is required.");
    if (!form.subject.trim()) return setError("Subject is required.");
    if (form.attendanceDays.length === 0) return setError("Select at least one attendance day.");
    if (!form.startTime || !form.endTime) return setError("Attendance start and end time are required.");
    if (form.startTime >= form.endTime) return setError("End time must be after start time.");

    setSaving(true);

    try {
      const teacherUsername = await generateUsername(form.fullName);
      const password = generatePassword();

      const data = {
        teacherId: teacherUsername,
        username: teacherUsername,
        password: password,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        className: form.className.trim(),
        subject: form.subject.trim(),
        subjects: [form.subject.trim()],
        attendanceDays: form.attendanceDays,
        // kept for older screens that still read a single day
        attendanceDay: form.attendanceDays[0],
        startTime: form.startTime,
        endTime: form.endTime,
        role: "teacher",
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "teacher1", teacherUsername), data);

      setCreated({ ...data, createdAt: null });
      setForm(emptyForm);
      onRegistered?.(teacherUsername);
    } catch (err) {
      console.error("Teacher registration error:", err);
      setError(err.message || "Failed to register teacher.");
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
    <form className="panel form" onSubmit={handleSubmit}>
      <div className="panel-head">
        <div className="panel-icon"><UserPlus size={20} /></div>
        <div>
          <h2>Register New Teacher</h2>
          <p>Diiwaan geli macalinka, maadada uu dhigo iyo goorta uu xaadirinayo.</p>
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
      </div>

      <div className="form-section-title"><BookOpen size={15} /> Class &amp; subject</div>
      <div className="form-grid">
        <label>
          Class
          <input
            type="text"
            list="teacher-class-options"
            value={form.className}
            onChange={(e) => update("className", e.target.value)}
            placeholder="Example: Grade 8A"
            required
          />
          <datalist id="teacher-class-options">
            {classOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
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
          <input
            type="time"
            value={form.startTime}
            onChange={(e) => update("startTime", e.target.value)}
            required
          />
        </label>
        <label>
          End time
          <input
            type="time"
            value={form.endTime}
            onChange={(e) => update("endTime", e.target.value)}
            required
          />
        </label>
      </div>
      <p className="hint">
        The teacher can only take attendance on the selected days, between the start and end time.
      </p>

      <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
        {saving ? "Registering..." : "Register Teacher"}
      </button>
    </form>
  );
}