import { useState } from "react";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { GraduationCap, Camera, CheckCircle2, Copy, KeyRound, Shuffle, Save, X } from "lucide-react";
import { db, storage } from "../firebase";
import { generateNextStudentId } from "../utils/generateId";
import { generatePassword } from "../utils/generatePassword";
import { STUDENTS_COLLECTION } from "../config/collections";
import { SHIFTS, FEE_TYPES, SUBJECT_OPTIONS, CLASSES, CLASS_BY_ID, groupLabel } from "../config/schoolOptions";

const emptyForm = {
  fullName: "",
  motherName: "",
  studentPhone: "",
  parentPhone: "",
  password: "",
  classId: "",
  subIds: [],
  subjects: [],
  shift: SHIFTS[0],
  feeType: FEE_TYPES[0],
  registrationFee: "",
  monthlyFee: "",
};

const MIN_PASSWORD = 4;

// Arday hore u diiwaangashan -> qiimaha foomka (Edit)
function formFromStudent(s) {
  if (!s) return emptyForm;

  // Fasalka: classId (cusub) ama className (hore)
  let cls = CLASS_BY_ID[s.classId];
  if (!cls && s.className) {
    cls = CLASSES.find((c) => c.name.toLowerCase() === String(s.className).toLowerCase()) || null;
  }

  // Qaybaha fasalka (Open Classes / English Department)
  let subIds = [];
  if (cls?.subs) {
    const names = Array.isArray(s.subClasses) ? s.subClasses : [];
    const groups = Array.isArray(s.classGroups) ? s.classGroups : [];
    subIds = cls.subs
      .filter((sub) => names.includes(sub.name) || groups.includes(groupLabel(cls, sub)))
      .map((sub) => sub.id);
  }

  return {
    fullName: s.fullName || "",
    motherName: s.motherName || "",
    studentPhone: s.studentPhone || "",
    parentPhone: s.parentPhone || "",
    password: s.password ? String(s.password) : "",
    classId: cls?.id || "",
    subIds,
    subjects: Array.isArray(s.subjects) ? s.subjects : s.subjects ? [s.subjects] : [],
    shift: s.shift || SHIFTS[0],
    feeType: s.feeType || FEE_TYPES[0],
    registrationFee: s.registrationFee !== undefined && s.registrationFee !== null ? String(s.registrationFee) : "",
    monthlyFee: s.monthlyFee !== undefined && s.monthlyFee !== null ? String(s.monthlyFee) : "",
  };
}

// editStudent: haddii la soo diro, foomku wuxuu noqonayaa "Edit Student"
// (xogta ardayga oo dhan waa la beddeli karaa, password-ka ku jiro).
export default function StudentForm({ onRegistered, editStudent = null, onDone, onCancel }) {
  const isEdit = !!editStudent;
  const [form, setForm] = useState(() => formFromStudent(editStudent));
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(editStudent?.photoUrl || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null); // { studentId, password, fullName }
  const [copied, setCopied] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function pickClass(classId) {
    setForm((f) => ({ ...f, classId, subIds: [] }));
  }

  function toggleSub(subId) {
    setForm((f) => {
      const cls = CLASS_BY_ID[f.classId];
      if (!cls?.multi) return { ...f, subIds: [subId] };
      return {
        ...f,
        subIds: f.subIds.includes(subId)
          ? f.subIds.filter((s) => s !== subId)
          : [...f.subIds, subId],
      };
    });
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
      setPhotoPreview(editStudent?.photoUrl || null);
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
    const password = form.password.trim();
    if (password.length < MIN_PASSWORD) {
      setError(`Geli password-ka ardayga (ugu yaraan ${MIN_PASSWORD} xaraf/lambar).`);
      return;
    }
    if (/\s/.test(password)) {
      setError("Password-ku waa inuusan lahayn meel bannaan (space).");
      return;
    }
    const cls = CLASS_BY_ID[form.classId];
    if (!cls) {
      setError("Select the student's class.");
      return;
    }
    if (cls.subs && form.subIds.length === 0) {
      setError(
        cls.multi
          ? "Choose Af-Somali, Xisaab or both."
          : "Choose the English level (Elementary, Intermediate or Classic)."
      );
      return;
    }
    const chosenSubs = cls.subs ? cls.subs.filter((s) => form.subIds.includes(s.id)) : [];
    const classGroups = cls.subs ? chosenSubs.map((s) => groupLabel(cls, s)) : [cls.name];

    setSaving(true);
    try {
      const studentId = isEdit ? String(editStudent.studentId) : await generateNextStudentId();

      // Photo is optional — only upload if the admin picked one.
      let photoUrl = isEdit ? editStudent.photoUrl || null : null;
      if (photoFile) {
        const photoRef = ref(storage, `student-photos/${studentId}`);
        await uploadBytes(photoRef, photoFile);
        photoUrl = await getDownloadURL(photoRef);
      }

      const fields = {
        password, // student logs into the Student Portal with studentId + this
        fullName: form.fullName.trim(),
        motherName: form.motherName.trim(),
        studentPhone: form.studentPhone.trim(),
        parentPhone: form.parentPhone.trim(),
        classId: cls.id,
        className: cls.name,
        subClasses: chosenSubs.map((s) => s.name),
        classGroups,
        subjects: form.subjects,
        shift: form.shift,
        feeType: form.feeType,
        registrationFee: form.registrationFee ? Number(form.registrationFee) : 0,
        monthlyFee: form.monthlyFee ? Number(form.monthlyFee) : 0,
        photoUrl,
      };

      if (isEdit) {
        await updateDoc(doc(db, STUDENTS_COLLECTION, editStudent.docId || studentId), {
          ...fields,
          updatedAt: serverTimestamp(),
        });
        onDone?.({ studentId, password, fullName: fields.fullName });
        return;
      }

      await setDoc(doc(db, STUDENTS_COLLECTION, studentId), {
        studentId,
        ...fields,
        createdAt: serverTimestamp(),
      });

      setCreated({ studentId, password, fullName: form.fullName.trim() });
      setForm(emptyForm);
      setPhotoFile(null);
      setPhotoPreview(null);
      onRegistered?.(studentId);
    } catch (err) {
      setError(err.message || (isEdit ? "Failed to update student." : "Failed to register student."));
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
    <form className={isEdit ? "form" : "panel form"} onSubmit={handleSubmit}>
      <div className="panel-head">
        <div className="panel-icon"><GraduationCap size={20} /></div>
        <div>
          <h2>{isEdit ? `Edit Student — ID ${editStudent.studentId}` : "Register New Student"}</h2>
          <p>{isEdit ? "Wax ka beddel xogta ardayga." : "Diiwaan geli ardayga cusub."}</p>
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

      <div className="field">
        <span className="field-label">Class (Fasalka)</span>
        <div className="class-picker">
          {CLASSES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`class-option tone-${c.color} ${form.classId === c.id ? "active" : ""}`}
              onClick={() => pickClass(c.id)}
            >
              <strong>{c.name}</strong>
              <span>{c.so}</span>
            </button>
          ))}
        </div>
        {CLASS_BY_ID[form.classId]?.subs && (
          <div className="sub-picker">
            <span className="muted-sm">
              {CLASS_BY_ID[form.classId].multi
                ? "Choose one or both:"
                : "Choose one level:"}
            </span>
            {CLASS_BY_ID[form.classId].subs.map((sub) => (
              <button
                key={sub.id}
                type="button"
                className={`day-chip ${form.subIds.includes(sub.id) ? "active" : ""}`}
                onClick={() => toggleSub(sub.id)}
              >
                {sub.name}
              </button>
            ))}
          </div>
        )}
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
          Parent Name (Magaca Waalidka)
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
          Portal Password (Password-ka ardayga)
          <div style={{ display: "flex", gap: 8 }}>
            <div className="input-icon" style={{ flex: 1 }}>
              <KeyRound size={17} />
              <input
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

        <label>
          Shift
          <select value={form.shift} onChange={(e) => update("shift", e.target.value)}>
            {SHIFTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <p className="hint span-2">
          Ardaygu wuxuu Student Portal-ka ku galayaa Student ID-giisa iyo password-kan.
        </p>

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

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
          {isEdit ? <Save size={16} /> : null}
          {saving ? "Saving..." : isEdit ? "Save Changes" : "Register Student"}
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