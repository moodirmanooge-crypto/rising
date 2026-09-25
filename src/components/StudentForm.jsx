import { useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { generateNextStudentId } from "../utils/generateId";
import { generatePassword } from "../utils/generatePassword";
import { STUDENTS_COLLECTION } from "../config/collections";

const SHIFTS = ["Morning", "Afternoon", "Evening"];
const FEE_TYPES = ["Monthly", "Term", "Full Course", "Scholarship"];

const emptyForm = {
  fullName: "",
  motherName: "",
  studentPhone: "",
  parentPhone: "",
  subjects: "",
  shift: SHIFTS[0],
  feeType: FEE_TYPES[0],
};

export default function StudentForm({ onRegistered }) {
  const [form, setForm] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null); // { studentId, password }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    setSaving(true);
    try {
      const studentId = await generateNextStudentId();
      const password = generatePassword();

      // Photo is optional — only upload if the admin picked one.
      let photoUrl = null;
      if (photoFile) {
        const photoRef = ref(storage, `student-photos/${studentId}`);
        await uploadBytes(photoRef, photoFile);
        photoUrl = await getDownloadURL(photoRef);
      }

      await setDoc(doc(db, STUDENTS_COLLECTION, studentId), {
        studentId,
        password, // student logs into the Student Portal with studentId + this
        fullName: form.fullName.trim(),
        motherName: form.motherName.trim(),
        studentPhone: form.studentPhone.trim(),
        parentPhone: form.parentPhone.trim(),
        subjects: form.subjects
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        shift: form.shift,
        feeType: form.feeType,
        photoUrl,
        createdAt: serverTimestamp(),
      });

      setCreated({ studentId, password });
      setForm(emptyForm);
      setPhotoFile(null);
      setPhotoPreview(null);
      onRegistered?.(studentId);
    } catch (err) {
      setError(err.message || "Failed to register student.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h2>Register New Student</h2>

      {created && (
        <p className="success">
          Registered. Student ID: <strong>{created.studentId}</strong> — Password:{" "}
          <strong>{created.password}</strong>
          <br />
          <span>Share these with the student — they log into the Student Portal with them.</span>
        </p>
      )}
      {error && <p className="error">{error}</p>}

      <div className="photo-picker">
        <div className="photo-preview">
          {photoPreview ? (
            <img src={photoPreview} alt="Student preview" />
          ) : (
            <span className="photo-placeholder">📷</span>
          )}
        </div>
        <label className="photo-label">
          Student Photo (optional)
          <input type="file" accept="image/*" onChange={handlePhotoChange} />
        </label>
      </div>

      <div className="form-grid">
        <label>
          Full Name
          <input
            value={form.fullName}
            onChange={(e) => update("fullName", e.target.value)}
            required
          />
        </label>

        <label>
          Mother's Name
          <input
            value={form.motherName}
            onChange={(e) => update("motherName", e.target.value)}
          />
        </label>

        <label>
          Student Phone
          <input
            value={form.studentPhone}
            onChange={(e) => update("studentPhone", e.target.value)}
          />
        </label>

        <label>
          Parent Phone
          <input
            value={form.parentPhone}
            onChange={(e) => update("parentPhone", e.target.value)}
          />
        </label>

        <label className="span-2">
          Subjects (comma separated)
          <input
            value={form.subjects}
            onChange={(e) => update("subjects", e.target.value)}
            placeholder="English, Math, Science"
          />
        </label>

        <label>
          Shift
          <select value={form.shift} onChange={(e) => update("shift", e.target.value)}>
            {SHIFTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label>
          Fee Type
          <select value={form.feeType} onChange={(e) => update("feeType", e.target.value)}>
            {FEE_TYPES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </label>
      </div>

      <button type="submit" disabled={saving}>
        {saving ? "Saving..." : "Register Student"}
      </button>
    </form>
  );
}
