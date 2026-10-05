import { useEffect, useMemo, useRef, useState } from "react";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  GraduationCap,
  Camera,
  CheckCircle2,
  Copy,
  KeyRound,
  Shuffle,
  Save,
  X,
  ChevronDown,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
  UserRound,
  BookOpen,
  Wallet,
  Layers3,
} from "lucide-react";

import { db, storage } from "../firebase";
import { generateNextStudentId } from "../utils/generateId";
import { generatePassword } from "../utils/generatePassword";
import { STUDENTS_COLLECTION } from "../config/collections";
import {
  SHIFTS,
  FEE_TYPES,
  SUBJECT_OPTIONS,
  subscribeSchoolClasses,
  sortClasses,
} from "../config/schoolOptions";

const emptyForm = {
  fullName: "",
  motherName: "",
  studentPhone: "",
  parentPhone: "",
  password: "",
  classId: "",
  className: "",
  classGroup: "",
  level: "",
  section: "",
  subjects: [],
  shift: SHIFTS[0],
  feeType: FEE_TYPES[0],
  registrationFee: "",
  monthlyFee: "",
};

const MIN_PASSWORD = 4;

const LEVEL_COLORS = {
  Elementary: "#16a34a",
  Intermediate: "#2563eb",
  Classic: "#7c3aed",
  Other: "#64748b",
};

function formFromStudent(s) {
  if (!s) return emptyForm;

  const group =
    (Array.isArray(s.classGroups) && s.classGroups[0]) ||
    s.className ||
    s.class ||
    s.studentClass ||
    "";

  return {
    fullName: s.fullName || "",
    motherName: s.motherName || "",
    studentPhone: s.studentPhone || "",
    parentPhone: s.parentPhone || "",
    password: s.password ? String(s.password) : "",
    classId: s.classId || "",
    className: s.className || group,
    classGroup: group,
    level: s.classLevel || s.level || "",
    section: s.classSection || s.section || "",
    subjects: Array.isArray(s.subjects)
      ? s.subjects
      : s.subjects
      ? [s.subjects]
      : [],
    shift: s.shift || SHIFTS[0],
    feeType: s.feeType || FEE_TYPES[0],
    registrationFee:
      s.registrationFee !== undefined && s.registrationFee !== null
        ? String(s.registrationFee)
        : "",
    monthlyFee:
      s.monthlyFee !== undefined && s.monthlyFee !== null
        ? String(s.monthlyFee)
        : "",
  };
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Section({ icon: Icon, title, hint, children }) {
  return (
    <section className="sf-section">
      <header className="sf-section-head">
        <span className="sf-section-icon">
          <Icon size={18} />
        </span>
        <div>
          <h3>{title}</h3>
          {hint && <p>{hint}</p>}
        </div>
      </header>
      <div className="sf-section-body">{children}</div>
    </section>
  );
}

function Field({ id, label, hint, required, wide, children }) {
  return (
    <div className={`sf-field ${wide ? "sf-wide" : ""}`}>
      <label htmlFor={id}>
        {label}
        {required && <b aria-hidden="true"> *</b>}
      </label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Class dropdown                                                      */
/* ------------------------------------------------------------------ */

function ClassDropdown({ groups, selectedId, selectedName, loading, onPick }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    function onDown(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = useMemo(() => {
    for (const g of groups) {
      const hit = g.list.find(
        (c) => c.id === selectedId || (!selectedId && c.name === selectedName)
      );
      if (hit) return { cls: hit, color: g.color };
    }
    return null;
  }, [groups, selectedId, selectedName]);

  return (
    <div className="sf-dd" ref={boxRef}>
      <button
        type="button"
        id="sf-class"
        className={`sf-dd-trigger ${open ? "open" : ""} ${
          selectedName ? "has-value" : ""
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
      >
        {loading ? (
          <span className="sf-dd-placeholder">Loading classes…</span>
        ) : selectedName ? (
          <span className="sf-dd-value">
            <i
              className="sf-dot"
              style={{ background: selected?.color || LEVEL_COLORS.Other }}
            />
            <span className="sf-dd-main">
              <strong>{selectedName}</strong>
              {selected?.cls?.level && (
                <small>
                  {selected.cls.level}, Section {selected.cls.section}
                </small>
              )}
            </span>
          </span>
        ) : (
          <span className="sf-dd-placeholder">
            Select class and section
          </span>
        )}
        <ChevronDown size={18} className="sf-dd-chevron" />
      </button>

      {open && (
        <div className="sf-dd-panel" role="listbox" aria-label="Classes">
          {groups.length === 0 && (
            <div className="sf-dd-empty">No classes found.</div>
          )}

          {groups.map((g) => (
            <div key={g.key} className="sf-dd-group">
              <div className="sf-dd-group-title">
                <i className="sf-dot" style={{ background: g.color }} />
                {g.label}
              </div>

              {g.list.map((cls) => {
                const active =
                  selectedId === cls.id ||
                  (!selectedId && selectedName === cls.name);

                return (
                  <button
                    key={cls.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`sf-dd-option ${active ? "active" : ""}`}
                    onClick={() => {
                      onPick(cls);
                      setOpen(false);
                    }}
                  >
                    <span className="sf-dd-option-text">
                      <strong>{cls.name}</strong>
                      {cls.so && <small>{cls.so}</small>}
                    </span>

                    {cls.section && (
                      <span className="sf-pill">Section {cls.section}</span>
                    )}

                    {active && <Check size={16} className="sf-check" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export default function StudentForm({
  onRegistered,
  editStudent = null,
  onDone,
  onCancel,
}) {
  const isEdit = !!editStudent;

  const [form, setForm] = useState(() => formFromStudent(editStudent));
  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(
    editStudent?.photoUrl || null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fileRef = useRef(null);
  const errorRef = useRef(null);

  useEffect(() => {
    const unsub = subscribeSchoolClasses(
      (list) => {
        setClasses(sortClasses(list));
        setClassesLoading(false);
      },
      (err) => {
        console.error("Classes load error:", err);
        setClassesLoading(false);
        setError("Unable to load school classes.");
      }
    );

    return unsub;
  }, []);

  useEffect(() => {
    if (!editStudent) return;
    setForm(formFromStudent(editStudent));
    setPhotoPreview(editStudent.photoUrl || null);
  }, [editStudent]);

  useEffect(() => {
    if (error)
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  const classGroups = useMemo(() => {
    const english = classes.filter((c) => c.type === "english" || c.level);
    const other = classes.filter((c) => c.type !== "english" && !c.level);

    return [
      {
        key: "Elementary",
        label: "English Elementary",
        color: LEVEL_COLORS.Elementary,
        list: english.filter((c) => c.level === "Elementary"),
      },
      {
        key: "Intermediate",
        label: "English Intermediate",
        color: LEVEL_COLORS.Intermediate,
        list: english.filter((c) => c.level === "Intermediate"),
      },
      {
        key: "Classic",
        label: "English Classic",
        color: LEVEL_COLORS.Classic,
        list: english.filter((c) => c.level === "Classic"),
      },
      {
        key: "Other",
        label: "Other school classes",
        color: LEVEL_COLORS.Other,
        list: other,
      },
    ].filter((g) => g.list.length > 0);
  }, [classes]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function pickClass(cls) {
    setForm((f) => ({
      ...f,
      classId: cls.id,
      className: cls.name,
      classGroup: cls.name,
      level: cls.level || "",
      section: cls.section || "",
    }));
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

  function removeNewPhoto() {
    setPhotoFile(null);
    setPhotoPreview(editStudent?.photoUrl || null);
    if (fileRef.current) fileRef.current.value = "";
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
      setError(
        `Geli password-ka ardayga (ugu yaraan ${MIN_PASSWORD} xaraf/lambar).`
      );
      return;
    }

    if (/\s/.test(password)) {
      setError("Password-ku waa inuusan lahayn meel bannaan (space).");
      return;
    }

    if (!form.className.trim()) {
      setError("Fadlan dooro fasalka iyo section-ka.");
      return;
    }

    setSaving(true);

    try {
      const studentId = isEdit
        ? String(editStudent.studentId)
        : await generateNextStudentId();

      let photoUrl = isEdit ? editStudent.photoUrl || null : null;

      if (photoFile) {
        const photoRef = ref(storage, `student-photos/${studentId}`);
        await uploadBytes(photoRef, photoFile);
        photoUrl = await getDownloadURL(photoRef);
      }

      const selectedClass =
        classes.find((c) => c.id === form.classId) || null;

      const className = form.className.trim();

      const fields = {
        password,
        fullName: form.fullName.trim(),
        motherName: form.motherName.trim(),
        studentPhone: form.studentPhone.trim(),
        parentPhone: form.parentPhone.trim(),

        // New exact class structure.
        classId: form.classId || null,
        className,
        classGroup: className,
        classGroups: [className],
        classLevel: selectedClass?.level || form.level || "",
        classSection: selectedClass?.section || form.section || "",

        // Backward-compatible fields.
        subClasses: [],
        subjects: form.subjects,
        shift: form.shift,
        feeType: form.feeType,
        registrationFee: form.registrationFee
          ? Number(form.registrationFee)
          : 0,
        monthlyFee: form.monthlyFee ? Number(form.monthlyFee) : 0,
        photoUrl,
      };

      if (isEdit) {
        await updateDoc(
          doc(db, STUDENTS_COLLECTION, editStudent.docId || studentId),
          {
            ...fields,
            updatedAt: serverTimestamp(),
          }
        );

        onDone?.({
          studentId,
          password,
          fullName: fields.fullName,
          className,
        });
        return;
      }

      await setDoc(doc(db, STUDENTS_COLLECTION, studentId), {
        studentId,
        ...fields,
        createdAt: serverTimestamp(),
      });

      setCreated({
        studentId,
        password,
        fullName: form.fullName.trim(),
        className,
      });

      setForm(emptyForm);
      setPhotoFile(null);
      setPhotoPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      onRegistered?.(studentId);
    } catch (err) {
      setError(
        err.message ||
          (isEdit
            ? "Failed to update student."
            : "Failed to register student.")
      );
    } finally {
      setSaving(false);
    }
  }

  function copyCredentials() {
    if (!created) return;

    const text = `Rising Star School — Student Login
Student ID: ${created.studentId}
Password: ${created.password}
Class: ${created.className}`;

    navigator.clipboard?.writeText(text).then(() => setCopied(true));
  }

  const initials = form.fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  return (
    <form
      className={`sf ${isEdit ? "sf-edit" : "sf-page"}`}
      onSubmit={handleSubmit}
      noValidate
    >
      <style>{css}</style>

      <div className="sf-title">
        <span className="sf-title-icon">
          <GraduationCap size={22} />
        </span>
        <div>
          <h2>
            {isEdit
              ? `Edit Student, ID ${editStudent.studentId}`
              : "Register New Student"}
          </h2>
          <p>
            {isEdit
              ? "Wax ka beddel xogta ardayga iyo fasalka."
              : "Buuxi xogta ardayga, dooro fasalka, kadibna keydi."}
          </p>
        </div>
      </div>

      {created && (
        <div className="sf-success" role="status">
          <div className="sf-success-head">
            <CheckCircle2 size={24} />
            <div>
              <strong>Student registered successfully</strong>
              <span>
                {created.fullName}, {created.className}
              </span>
            </div>
          </div>

          <div className="sf-success-grid">
            <div>
              <span>Student ID</span>
              <strong>{created.studentId}</strong>
            </div>
            <div>
              <span>Password</span>
              <strong>{created.password}</strong>
            </div>
            <div>
              <span>Class</span>
              <strong>{created.className}</strong>
            </div>
          </div>

          <button
            type="button"
            className="sf-btn sf-btn-light"
            onClick={copyCredentials}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied" : "Copy login details"}
          </button>
        </div>
      )}

      {error && (
        <div className="sf-error" role="alert" ref={errorRef}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* ---------------- Student info ---------------- */}
      <Section
        icon={UserRound}
        title="Student information"
        hint="Magaca ardayga, waalidka iyo taleefannada."
      >
        <div className="sf-photo">
          <div className="sf-photo-preview">
            {photoPreview ? (
              <img src={photoPreview} alt="Student preview" />
            ) : initials ? (
              <span className="sf-initials">{initials}</span>
            ) : (
              <Camera size={26} />
            )}
          </div>

          <div className="sf-photo-actions">
            <strong>Student photo</strong>
            <small>Optional. JPG ama PNG.</small>

            <div className="sf-photo-buttons">
              <label className="sf-btn sf-btn-outline sf-btn-sm">
                <Camera size={15} />
                {photoPreview ? "Change photo" : "Choose photo"}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  hidden
                />
              </label>

              {photoFile && (
                <button
                  type="button"
                  className="sf-btn sf-btn-ghost sf-btn-sm"
                  onClick={removeNewPhoto}
                >
                  <X size={15} /> Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="sf-grid">
          <Field id="sf-fullName" label="Full name" required wide>
            <input
              id="sf-fullName"
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              placeholder="Magaca oo buuxa"
              autoComplete="off"
            />
          </Field>

          <Field
            id="sf-motherName"
            label="Parent name"
            hint="Magaca waalidka"
            wide
          >
            <input
              id="sf-motherName"
              value={form.motherName}
              onChange={(e) => update("motherName", e.target.value)}
              autoComplete="off"
            />
          </Field>

          <Field id="sf-studentPhone" label="Student phone">
            <input
              id="sf-studentPhone"
              type="tel"
              inputMode="tel"
              value={form.studentPhone}
              onChange={(e) => update("studentPhone", e.target.value)}
              placeholder="61xxxxxxx"
            />
          </Field>

          <Field id="sf-parentPhone" label="Parent phone">
            <input
              id="sf-parentPhone"
              type="tel"
              inputMode="tel"
              value={form.parentPhone}
              onChange={(e) => update("parentPhone", e.target.value)}
              placeholder="61xxxxxxx"
            />
          </Field>
        </div>
      </Section>

      {/* ---------------- Class ---------------- */}
      <Section
        icon={Layers3}
        title="Class and section"
        hint="Dooro fasalka ardayga ku jiri doono."
      >
        <Field id="sf-class" label="Class" required wide>
          <ClassDropdown
            groups={classGroups}
            selectedId={form.classId}
            selectedName={form.className}
            loading={classesLoading}
            onPick={pickClass}
          />
        </Field>

        <p className="sf-note">
          Teacher-ka loo qoondeeyo isla fasalkan wuxuu arki doonaa ardaygan
          oo keliya.
        </p>
      </Section>

      {/* ---------------- Study ---------------- */}
      <Section
        icon={BookOpen}
        title="Shift and subjects"
        hint="Waqtiga dugsiga iyo maadooyinka."
      >
        <div className="sf-field sf-wide">
          <span className="sf-label">Shift</span>
          <div className="sf-segment" role="radiogroup" aria-label="Shift">
            {SHIFTS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={form.shift === s}
                className={form.shift === s ? "on" : ""}
                onClick={() => update("shift", s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="sf-field sf-wide">
          <span className="sf-label">
            Subjects
            {form.subjects.length > 0 && (
              <em>{form.subjects.length} selected</em>
            )}
          </span>
          <div className="sf-chips">
            {SUBJECT_OPTIONS.map((subj) => {
              const on = form.subjects.includes(subj);
              return (
                <button
                  key={subj}
                  type="button"
                  aria-pressed={on}
                  className={`sf-chip ${on ? "on" : ""}`}
                  onClick={() => toggleSubject(subj)}
                >
                  {on && <Check size={14} />}
                  {subj}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      {/* ---------------- Fees & login ---------------- */}
      <Section
        icon={Wallet}
        title="Fees and login"
        hint="Lacagaha iyo password-ka ardayga ku gelayo portal-ka."
      >
        <div className="sf-grid">
          <Field id="sf-feeType" label="Fee type" wide>
            <div className="sf-select">
              <select
                id="sf-feeType"
                value={form.feeType}
                onChange={(e) => update("feeType", e.target.value)}
              >
                {FEE_TYPES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} />
            </div>
          </Field>

          <Field id="sf-regFee" label="Registration fee">
            <div className="sf-prefix">
              <span>$</span>
              <input
                id="sf-regFee"
                type="number"
                min="0"
                step="0.01"
                value={form.registrationFee}
                onChange={(e) => update("registrationFee", e.target.value)}
                placeholder="20"
              />
            </div>
          </Field>

          <Field id="sf-monthFee" label="Monthly fee">
            <div className="sf-prefix">
              <span>$</span>
              <input
                id="sf-monthFee"
                type="number"
                min="0"
                step="0.01"
                value={form.monthlyFee}
                onChange={(e) => update("monthlyFee", e.target.value)}
                placeholder="15"
              />
            </div>
          </Field>

          <Field
            id="sf-password"
            label="Portal password"
            required
            wide
            hint={`Ugu yaraan ${MIN_PASSWORD} xaraf ama lambar, meel bannaan la'aan.`}
          >
            <div className="sf-password">
              <div className="sf-input-icon">
                <KeyRound size={17} />
                <input
                  id="sf-password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="Geli ama samee password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="sf-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              <button
                type="button"
                className="sf-btn sf-btn-outline"
                onClick={() => {
                  update("password", generatePassword());
                  setShowPassword(true);
                }}
              >
                <Shuffle size={15} /> Generate
              </button>
            </div>
          </Field>
        </div>
      </Section>

      {/* ---------------- Action bar ---------------- */}
      <div className="sf-bar">
        <div className="sf-bar-info">
          <span className="sf-bar-avatar">
            {initials || <UserRound size={16} />}
          </span>
          <div>
            <strong>{form.fullName.trim() || "New student"}</strong>
            <small>{form.className || "No class selected"}</small>
          </div>
        </div>

        <div className="sf-bar-actions">
          {isEdit && (
            <button
              type="button"
              className="sf-btn sf-btn-outline"
              onClick={onCancel}
              disabled={saving}
            >
              <X size={16} /> Cancel
            </button>
          )}

          <button
            type="submit"
            className="sf-btn sf-btn-primary"
            disabled={saving || classesLoading}
          >
            <Save size={16} />
            {saving
              ? "Saving…"
              : isEdit
              ? "Save changes"
              : "Register student"}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Styles (scoped under .sf so they don't clash with the app's CSS)    */
/* ------------------------------------------------------------------ */

const css = `
.sf{
  --g:#17803f; --g-dark:#0f3d26; --g-tint:#eaf6ee; --g-line:#bfe0c9;
  --ink:#13241a; --muted:#64746b; --line:#dbe4de; --bg:#f6f8f7; --white:#fff;
  --danger:#b42318; --danger-bg:#fef3f2;
  color:var(--ink);
  display:flex; flex-direction:column; gap:18px;
  max-width:880px; width:100%; margin:0 auto;
  font-size:14.5px; line-height:1.45;
}
.sf *{box-sizing:border-box}
.sf h2,.sf h3,.sf p{margin:0}
.sf-page{padding:4px 0 0}

/* Title */
.sf-title{display:flex; align-items:center; gap:14px}
.sf-title-icon{
  width:46px; height:46px; border-radius:14px; flex:none;
  display:grid; place-items:center; background:var(--g-dark); color:#fff;
}
.sf-title h2{font-size:21px; font-weight:800; letter-spacing:-.01em}
.sf-title p{color:var(--muted); margin-top:2px}

/* Sections */
.sf-section{
  background:var(--white); border:1px solid var(--line); border-radius:16px;
}
.sf-section-head{
  display:flex; align-items:center; gap:12px; padding:16px 22px;
  background:var(--bg); border-bottom:1px solid var(--line);
  border-radius:16px 16px 0 0;
}
.sf-section-icon{
  width:34px; height:34px; border-radius:10px; flex:none;
  display:grid; place-items:center; background:var(--g-tint); color:var(--g);
}
.sf-section-head h3{font-size:15.5px; font-weight:750}
.sf-section-head p{font-size:13px; color:var(--muted); margin-top:1px}
.sf-section-body{padding:22px; display:flex; flex-direction:column; gap:20px}

/* Fields */
.sf-grid{display:grid; grid-template-columns:1fr 1fr; gap:18px}
.sf-field{display:flex; flex-direction:column; gap:7px; min-width:0}
.sf-wide{grid-column:1 / -1}
.sf-field > label,.sf-label{
  font-weight:650; font-size:13.5px; display:flex; align-items:center; gap:8px;
}
.sf-field > label b{color:var(--danger)}
.sf-label em{
  font-style:normal; font-weight:600; font-size:12px; color:var(--g);
  background:var(--g-tint); padding:2px 9px; border-radius:999px;
}
.sf-field small{color:var(--muted); font-size:12.5px}

.sf input:not([type=checkbox]):not([type=file]),
.sf select{
  width:100%; height:46px; padding:0 14px; font:inherit; color:var(--ink);
  background:var(--white); border:1.5px solid var(--line); border-radius:10px;
  outline:none; transition:border-color .15s, box-shadow .15s;
}
.sf input::placeholder{color:#9aa8a0}
.sf input:hover,.sf select:hover{border-color:#c3d0c8}
.sf input:focus,.sf select:focus{
  border-color:var(--g); box-shadow:0 0 0 3.5px rgba(23,128,63,.16);
}

.sf-select{position:relative}
.sf-select select{appearance:none; padding-right:42px; cursor:pointer}
.sf-select svg{
  position:absolute; right:14px; top:50%; transform:translateY(-50%);
  pointer-events:none; color:var(--muted);
}

.sf-prefix{position:relative}
.sf-prefix span{
  position:absolute; left:14px; top:50%; transform:translateY(-50%);
  color:var(--muted); font-weight:650;
}
.sf-prefix input{padding-left:30px !important}

.sf-password{display:flex; gap:10px; align-items:stretch}
.sf-input-icon{position:relative; flex:1; min-width:0}
.sf-input-icon > svg{
  position:absolute; left:14px; top:50%; transform:translateY(-50%);
  color:var(--muted); pointer-events:none;
}
.sf-input-icon input{padding-left:42px !important; padding-right:46px !important}
.sf-eye{
  position:absolute; right:6px; top:50%; transform:translateY(-50%);
  width:34px; height:34px; border:0; background:transparent; color:var(--muted);
  border-radius:8px; cursor:pointer; display:grid; place-items:center;
}
.sf-eye:hover{background:var(--bg); color:var(--ink)}

/* Photo */
.sf-photo{display:flex; align-items:center; gap:18px}
.sf-photo-preview{
  width:92px; height:92px; border-radius:50%; flex:none; overflow:hidden;
  display:grid; place-items:center; color:var(--g);
  background:var(--g-tint); border:2px dashed var(--g-line);
}
.sf-photo-preview img{width:100%; height:100%; object-fit:cover}
.sf-initials{font-size:28px; font-weight:800; color:var(--g-dark)}
.sf-photo-actions{display:flex; flex-direction:column; gap:3px}
.sf-photo-actions small{color:var(--muted); font-size:12.5px}
.sf-photo-buttons{display:flex; gap:8px; margin-top:8px; flex-wrap:wrap}

/* Class dropdown */
.sf-dd{position:relative}
.sf-dd-trigger{
  width:100%; min-height:56px; padding:8px 14px; display:flex; align-items:center;
  justify-content:space-between; gap:12px; text-align:left; font:inherit;
  color:var(--ink); cursor:pointer; background:var(--white);
  border:1.5px solid var(--line); border-radius:12px;
  transition:border-color .15s, box-shadow .15s;
}
.sf-dd-trigger:hover{border-color:#c3d0c8}
.sf-dd-trigger.has-value{border-color:var(--g-line); background:var(--g-tint)}
.sf-dd-trigger.open,.sf-dd-trigger:focus-visible{
  outline:none; border-color:var(--g); box-shadow:0 0 0 3.5px rgba(23,128,63,.16);
}
.sf-dd-trigger:disabled{opacity:.65; cursor:wait}
.sf-dd-placeholder{color:#8a9a91}
.sf-dd-value{display:flex; align-items:center; gap:12px; min-width:0}
.sf-dd-main{display:flex; flex-direction:column; min-width:0}
.sf-dd-main strong{font-size:15px}
.sf-dd-main small{color:var(--muted); font-size:12.5px}
.sf-dd-chevron{flex:none; color:var(--muted); transition:transform .18s}
.sf-dd-trigger.open .sf-dd-chevron{transform:rotate(180deg)}
.sf-dot{width:10px; height:10px; border-radius:50%; flex:none; display:inline-block}

.sf-dd-panel{
  position:absolute; z-index:30; left:0; right:0; top:calc(100% + 8px);
  max-height:360px; overflow-y:auto; padding:6px;
  background:var(--white); border:1px solid var(--line); border-radius:14px;
  box-shadow:0 18px 40px -12px rgba(15,61,38,.28), 0 2px 6px rgba(15,61,38,.06);
  animation:sf-drop .14s ease-out;
}
@keyframes sf-drop{from{opacity:0; transform:translateY(-4px)}to{opacity:1; transform:none}}
.sf-dd-empty{padding:18px; text-align:center; color:var(--muted)}
.sf-dd-group + .sf-dd-group{margin-top:4px; border-top:1px solid var(--line); padding-top:4px}
.sf-dd-group-title{
  position:sticky; top:-6px; z-index:1; background:var(--white);
  display:flex; align-items:center; gap:8px; padding:10px 10px 6px;
  font-size:12.5px; font-weight:750; color:var(--muted);
}
.sf-dd-option{
  width:100%; display:flex; align-items:center; gap:10px; padding:10px 12px;
  border:0; background:transparent; border-radius:9px; cursor:pointer;
  font:inherit; color:var(--ink); text-align:left;
}
.sf-dd-option:hover,.sf-dd-option:focus-visible{background:var(--bg); outline:none}
.sf-dd-option.active{background:var(--g-tint)}
.sf-dd-option-text{display:flex; flex-direction:column; flex:1; min-width:0}
.sf-dd-option-text small{color:var(--muted); font-size:12px}
.sf-pill{
  font-size:12px; font-weight:650; padding:3px 10px; border-radius:6px;
  background:var(--bg); color:var(--muted); border:1px solid var(--line); flex:none;
}
.sf-dd-option.active .sf-pill{background:#fff; color:var(--g); border-color:var(--g-line)}
.sf-check{color:var(--g); flex:none}

.sf-note{
  font-size:13px; color:var(--muted); padding:11px 14px; border-radius:10px;
  background:var(--bg); border-left:3px solid var(--g-line);
}

/* Segmented + chips */
.sf-segment{
  display:inline-flex; flex-wrap:wrap; gap:4px; padding:4px; width:fit-content;
  max-width:100%; background:var(--bg); border:1px solid var(--line); border-radius:12px;
}
.sf-segment button{
  height:38px; padding:0 20px; border:0; background:transparent; font:inherit;
  font-weight:650; color:var(--muted); border-radius:9px; cursor:pointer;
}
.sf-segment button:hover{color:var(--ink)}
.sf-segment button.on{
  background:var(--g-dark); color:#fff; box-shadow:0 1px 3px rgba(15,61,38,.3);
}
.sf-chips{display:flex; flex-wrap:wrap; gap:8px}
.sf-chip{
  height:38px; padding:0 16px; display:inline-flex; align-items:center; gap:6px;
  font:inherit; font-weight:600; cursor:pointer; color:var(--ink);
  background:var(--white); border:1.5px solid var(--line); border-radius:999px;
  transition:all .14s;
}
.sf-chip:hover{border-color:var(--g-line)}
.sf-chip.on{background:var(--g-tint); border-color:var(--g); color:var(--g-dark)}

/* Buttons */
.sf-btn{
  height:46px; padding:0 20px; display:inline-flex; align-items:center;
  justify-content:center; gap:8px; font:inherit; font-weight:700; cursor:pointer;
  border-radius:10px; border:1.5px solid transparent; white-space:nowrap;
  transition:background .15s, border-color .15s, transform .05s;
}
.sf-btn:active:not(:disabled){transform:translateY(1px)}
.sf-btn:disabled{opacity:.6; cursor:not-allowed}
.sf-btn:focus-visible,.sf-chip:focus-visible,.sf-segment button:focus-visible{
  outline:3px solid rgba(23,128,63,.35); outline-offset:2px;
}
.sf-btn-sm{height:38px; padding:0 14px; font-size:13.5px}
.sf-btn-primary{background:var(--g); color:#fff; padding:0 26px}
.sf-btn-primary:hover:not(:disabled){background:#126c34}
.sf-btn-outline{background:var(--white); color:var(--ink); border-color:var(--line)}
.sf-btn-outline:hover:not(:disabled){border-color:var(--g); color:var(--g-dark)}
.sf-btn-ghost{background:transparent; color:var(--muted)}
.sf-btn-ghost:hover{background:var(--bg); color:var(--danger)}
.sf-btn-light{background:#fff; color:var(--g-dark)}

/* Messages */
.sf-error{
  display:flex; align-items:flex-start; gap:10px; padding:13px 16px;
  border-radius:12px; color:var(--danger); background:var(--danger-bg);
  border:1px solid #fecdca; font-weight:600;
}
.sf-error svg{flex:none; margin-top:1px}

.sf-success{
  padding:20px 22px; border-radius:16px; color:#fff;
  background:var(--g-dark); display:flex; flex-direction:column; gap:16px;
}
.sf-success-head{display:flex; align-items:center; gap:12px}
.sf-success-head div{display:flex; flex-direction:column}
.sf-success-head span{opacity:.8; font-size:13.5px}
.sf-success-grid{
  display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px;
}
.sf-success-grid > div{
  background:rgba(255,255,255,.1); border-radius:10px; padding:10px 14px;
  display:flex; flex-direction:column; min-width:0;
}
.sf-success-grid span{font-size:12px; opacity:.75}
.sf-success-grid strong{font-size:16px; overflow-wrap:anywhere}
.sf-success .sf-btn{align-self:flex-start}

/* Action bar */
.sf-bar{
  position:sticky; bottom:0; z-index:10; margin-top:2px;
  display:flex; align-items:center; justify-content:space-between; gap:14px;
  flex-wrap:wrap; padding:14px 18px; background:var(--white);
  border:1px solid var(--line); border-radius:16px;
  box-shadow:0 -8px 24px -10px rgba(15,61,38,.2);
}
.sf-bar-info{display:flex; align-items:center; gap:12px; min-width:0}
.sf-bar-info div{display:flex; flex-direction:column; min-width:0}
.sf-bar-info strong,.sf-bar-info small{
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.sf-bar-info small{color:var(--muted); font-size:12.5px}
.sf-bar-avatar{
  width:38px; height:38px; border-radius:50%; flex:none; display:grid;
  place-items:center; background:var(--g-tint); color:var(--g-dark);
  font-weight:800; font-size:13px;
}
.sf-bar-actions{display:flex; gap:10px}

/* Edit mode (inside a modal): flatter */
.sf-edit{max-width:none; gap:16px}
.sf-edit .sf-bar{box-shadow:none; border-radius:12px}

@media (max-width:640px){
  .sf-grid{grid-template-columns:1fr}
  .sf-section-body{padding:18px}
  .sf-section-head{padding:14px 18px}
  .sf-password{flex-direction:column}
  .sf-photo{flex-direction:column; align-items:flex-start}
  .sf-bar{flex-direction:column; align-items:stretch}
  .sf-bar-actions .sf-btn{flex:1}
}
@media (prefers-reduced-motion:reduce){
  .sf *{animation:none !important; transition:none !important}
}
`;