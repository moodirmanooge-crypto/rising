import { useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { GraduationCap, Camera, CheckCircle2, Copy } from "lucide-react";
import { db, storage } from "../firebase";
import { generateNextStudentId } from "../utils/generateId";
import { generatePassword } from "../utils/generatePassword";
import { STUDENTS_COLLECTION } from "../config/collections";
import { SHIFTS, FEE_TYPES, SUBJECT_OPTIONS } from "../config/schoolOptions";

const emptyForm = {
  fullName: "",
  motherName: "",
  studentPhone: "",
  parentPhone: "",
  className: "",
  subjects: [],
  shift: SHIFTS[0],
  feeType: FEE_TYPES[0],
  registrationFee: "",
  monthlyFee: "",
};

export default function StudentForm({ onRegistered, classOptions = [] }) {
  const [form, setForm] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null); // { studentId, password, fullName }
  const [copied, setCopied] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleSubject(subject) {
    setForm((f) => {
      const has = f.subjects.includes(subject);
      return {
        ...f,
        subjects: has
          ? f.subjects.filter((s) => s !== subject)
          : [...f.subjects, subject],
      };
    });
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
    setCopied(false);

    if (!form.fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!form.className.trim()) {
      setError("Class is required — teachers see their students by class.");
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
        className: form.className.trim(),
        subjects: form.subjects,
        shift: form.shift,
        feeType: form.feeType,
        registrationFee: form.registrationFee ? Number(form.registrationFee) : 0,
        monthlyFee: form.monthlyFee ? Number(form.monthlyFee) : 0,
        photoUrl,
        createdAt: serverTimestamp(),
      });

      setCreated({ studentId, password, fullName: form.fullName.trim() });
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

  function copyCredentials() {
    if (!created) return;
    const text = `Rising Star School — Student Login\nStudent ID: ${created.studentId}\nPassword: ${created.password}`;
    navigator.clipboard?.writeText(text).then(() => setCopied(true));
  }

  return (
    <form className="panel form" onSubmit={handleSubmit}>
      <div className="panel-head">
        <div className="panel-icon"><GraduationCap size={20} /></div>
        <div>
          <h2>Register New Student</h2>
          <p>Diiwaan geli ardayga cusub.</p>
        </div>
      </div>

      {created && (
        <div className="credential-card">
          <div className="credential-head">
            <CheckCircle2 size={22} />
            <div>
              <strong>Student registered successfully</strong>
              <span>Share these with {created.fullName} — they log into the Student Portal with them.</span>
            </div>
          </div>
          <div className="credential-grid">
            <div><span>Student ID</span><strong>{created.studentId}</strong></div>
            <div><span>Password</span><strong>{created.password}</strong></div>
          </div>
          <button type="button" className="btn btn-light" onClick={copyCredentials}>
            <Copy size={15} /> {copied ? "Copied!" : "Copy login details"}
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      <div className="photo-picker">
        <div className="photo-preview">
          {photoPreview ? (
            <img src={photoPreview} alt="Student preview" />
          ) : (
            <Camera size={24} />
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

        <label>
          Class
          <input
            list="student-class-options"
            value={form.className}
            onChange={(e) => update("className", e.target.value)}
            placeholder="Example: Grade 8A"
            required
          />
          <datalist id="student-class-options">
            {classOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <label>
          Shift
          <select value={form.shift} onChange={(e) => update("shift", e.target.value)}>
            {SHIFTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <div className="span-2 field">
          <span className="field-label">Subjects</span>
          <div className="subject-grid">
            {SUBJECT_OPTIONS.map((subj) => (
              <label key={subj} className="subject-chip">
                <input
                  type="checkbox"
                  checked={form.subjects.includes(subj)}
                  onChange={() => toggleSubject(subj)}
                />
                {subj}
              </label>
            ))}
          </div>
        </div>

        <label>
          Fee Type
          <select value={form.feeType} onChange={(e) => update("feeType", e.target.value)}>
            {FEE_TYPES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </label>

        <label>
          Registration Fee
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.registrationFee}
            onChange={(e) => update("registrationFee", e.target.value)}
            placeholder="e.g. 20"
          />
        </label>

        <label>
          Monthly Fee
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.monthlyFee}
            onChange={(e) => update("monthlyFee", e.target.value)}
            placeholder="e.g. 15"
          />
        </label>
      </div>

      <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
        {saving ? "Saving..." : "Register Student"}
      </button>
    </form>
  );
}