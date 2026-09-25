import { useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

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

  async function getNextTeacherNumber() {
    /*
     * Waxaan ka bilaabaynaa teacher1.
     * Waxaa la eegayaa teacher1, teacher2, teacher3...
     * ilaa laga helo mid aan jirin.
     */

    let number = 1;

    while (true) {
      const teacherId = `teacher${number}`;

      const { getDoc } = await import(
        "firebase/firestore"
      );

      const teacherRef = doc(
        db,
        "teacher1",
        teacherId
      );

      const snapshot = await getDoc(teacherRef);

      if (!snapshot.exists()) {
        return teacherId;
      }

      number++;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setCreated(null);

    if (!form.fullName.trim()) {
      setError("Full Name is required.");
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
      setError("Attendance Day is required.");
      return;
    }

    setSaving(true);

    try {
      /*
       * Generate:
       * teacher1
       * teacher2
       * teacher3...
       */
      const teacherUsername =
        await getNextTeacherNumber();

      const password = generatePassword();

      /*
       * Firestore:
       *
       * teacher1
       *    └── teacher1
       *
       * teacher1
       *    └── teacher2
       *
       * teacher1
       *    └── teacher3
       */

      await setDoc(
        doc(
          db,
          "teacher1",
          teacherUsername
        ),
        {
          teacherId: teacherUsername,

          username: teacherUsername,

          password: password,

          fullName:
            form.fullName.trim(),

          phone:
            form.phone.trim(),

          className:
            form.className.trim(),

          subject:
            form.subject.trim(),

          subjects: [
            form.subject.trim(),
          ],

          attendanceDay:
            form.attendanceDay,

          role: "teacher",

          createdAt:
            serverTimestamp(),
        }
      );

      /*
       * Display credentials after registration
       */
      setCreated({
        teacherId: teacherUsername,
        username: teacherUsername,
        password: password,
        fullName:
          form.fullName.trim(),
        className:
          form.className.trim(),
        subject:
          form.subject.trim(),
        attendanceDay:
          form.attendanceDay,
      });

      setForm(emptyForm);

      onRegistered?.(
        teacherUsername
      );
    } catch (err) {
      console.error(
        "Teacher registration error:",
        err
      );

      setError(
        err.message ||
          "Failed to register teacher."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="card form"
      onSubmit={handleSubmit}
    >
      <h2>
        Register New Teacher
      </h2>

      {created && (
        <div className="success">
          <h3>
            Teacher Registered Successfully
          </h3>

          <p>
            <strong>
              Teacher ID:
            </strong>{" "}
            {created.teacherId}
          </p>

          <p>
            <strong>
              Username:
            </strong>{" "}
            {created.username}
          </p>

          <p>
            <strong>
              Password:
            </strong>{" "}
            {created.password}
          </p>

          <p>
            <strong>
              Full Name:
            </strong>{" "}
            {created.fullName}
          </p>

          <p>
            <strong>
              Class:
            </strong>{" "}
            {created.className}
          </p>

          <p>
            <strong>
              Subject:
            </strong>{" "}
            {created.subject}
          </p>

          <p>
            <strong>
              Attendance Day:
            </strong>{" "}
            {created.attendanceDay}
          </p>

          <hr />

          <p>
            <strong>
              Teacher Login:
            </strong>
          </p>

          <p>
            Username:{" "}
            <strong>
              {created.username}
            </strong>
            <br />

            Password:{" "}
            <strong>
              {created.password}
            </strong>
          </p>
        </div>
      )}

      {error && (
        <p className="error">
          {error}
        </p>
      )}

      <label>
        Full Name

        <input
          type="text"
          value={form.fullName}
          onChange={(e) =>
            update(
              "fullName",
              e.target.value
            )
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
            update(
              "phone",
              e.target.value
            )
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
            update(
              "className",
              e.target.value
            )
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
            update(
              "subject",
              e.target.value
            )
          }
          placeholder="Example: Mathematics"
          required
        />
      </label>

      <label>
        Attendance Day

        <select
          value={
            form.attendanceDay
          }
          onChange={(e) =>
            update(
              "attendanceDay",
              e.target.value
            )
          }
          required
        >
          <option value="">
            Select day
          </option>

          {DAYS.map((day) => (
            <option
              key={day}
              value={day}
            >
              {day}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={saving}
      >
        {saving
          ? "Registering..."
          : "Register Teacher"}
      </button>
    </form>
  );
}