import { useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { generateNextTeacherId } from "../utils/generateId";
import { generatePassword } from "../utils/generatePassword";
import { TEACHERS_COLLECTION } from "../config/collections";

const DAYS = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

const emptyForm = {
  fullName: "",
  phone: "",
  className: "",
  subject: "",
  attendanceDay: "",
};

export default function TeacherForm({ onRegistered }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  function update(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setCreated(null);

    if (!form.fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    if (!form.className.trim()) {
      setError("Class is required.");
      return;
    }

    if (!form.subject.trim()) {
      setError("Subject is required.");
      return;
    }

    if (!form.attendanceDay) {
      setError("Please select the attendance day.");
      return;
    }

    setSaving(true);

    try {
      const teacherId = await generateNextTeacherId();

      const username = `teacher${teacherId}`;
      const password = generatePassword();

      const teacherData = {
        teacherId,
        username,
        password,

        fullName: form.fullName.trim(),
        phone: form.phone.trim(),

        // Class-ka macalinku qaabilsan yahay
        className: form.className.trim(),

        // Maadada uu dhigayo
        subject: form.subject.trim(),

        // Maalinta uu xaadirinayo
        attendanceDay: form.attendanceDay,

        // Waxaa loo kaydinayaa array sidoo kale
        subjects: [form.subject.trim()],

        createdAt: serverTimestamp(),
      };

      await setDoc(
        doc(db, TEACHERS_COLLECTION, teacherId),
        teacherData
      );

      setCreated({
        teacherId,
        username,
        password,
        className: form.className.trim(),
        subject: form.subject.trim(),
        attendanceDay: form.attendanceDay,
      });

      setForm(emptyForm);

      onRegistered?.(teacherId);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to register teacher.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h2>Register New Teacher</h2>

      {created && (
        <div className="success">
          <h3>Teacher Registered Successfully</h3>

          <p>
            <strong>Teacher ID:</strong> {created.teacherId}
          </p>

          <p>
            <strong>Username:</strong> {created.username}
          </p>

          <p>
            <strong>Password:</strong> {created.password}
          </p>

          <p>
            <strong>Class:</strong> {created.className}
          </p>

          <p>
            <strong>Subject:</strong> {created.subject}
          </p>

          <p>
            <strong>Attendance Day:</strong> {created.attendanceDay}
          </p>

          <p>
            Teacher-ku wuxuu isticmaali karaa username-ka iyo password-kan
            marka uu galo Teacher Login.
          </p>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <label>
        Full Name
        <input
          type="text"
          value={form.fullName}
          onChange={(e) =>
            update("fullName", e.target.value)
          }
          placeholder="Teacher full name"
          required
        />
      </label>

      <label>
        Phone
        <input
          type="text"
          value={form.phone}
          onChange={(e) =>
            update("phone", e.target.value)
          }
          placeholder="061xxxxxxx"
        />
      </label>

      <label>
        Class
        <input
          type="text"
          value={form.className}
          onChange={(e) =>
            update("className", e.target.value)
          }
          placeholder="Example: Grade 8A"
          required
        />
      </label>

      <label>
        Subject
        <input
          type="text"
          value={form.subject}
          onChange={(e) =>
            update("subject", e.target.value)
          }
          placeholder="Example: Mathematics"
          required
        />
      </label>

      <label>
        Attendance Day
        <select
          value={form.attendanceDay}
          onChange={(e) =>
            update("attendanceDay", e.target.value)
          }
          required
        >
          <option value="">Select day</option>

          {DAYS.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
      </label>

      <button type="submit" disabled={saving}>
        {saving ? "Registering..." : "Register Teacher"}
      </button>
    </form>
  );
}