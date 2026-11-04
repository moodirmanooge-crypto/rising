import { useEffect, useRef, useState } from "react";
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
  Plus,
  Trash2,
} from "lucide-react";

import { db, storage } from "../firebase";
import { generateNextStudentId } from "../utils/generateId";
import { generatePassword } from "../utils/generatePassword";
import { STUDENTS_COLLECTION } from "../config/collections";
import {
  SHIFTS,
  FEE_TYPES,
  GENDERS,
  genderOf,
  CLASSES,
  CLASS_BY_ID,
  CLASS_OPTIONS,
  ENGLISH_LEVELS,
  ENGLISH_SECTIONS,
  isFreeStudent,
  enrollmentsOf,
  enrollmentFields,
  makeEnrollment,
} from "../config/schoolOptions";

// Saved enrollment -> the matching option (leaf class).
// (Arday fasalkiisa hore aan hadda jirin → null, admin-ka ayaa dooranaya.)
function optionForEnrollment(e) {
  const cls = CLASS_BY_ID[e.classId];
  if (!cls) return null;
  if (!cls.subs) return CLASS_OPTIONS.find((o) => o.id === cls.id) || null;
  return CLASS_OPTIONS.find((o) => o.classId === cls.id && o.subId && o.subId === e.subIds[0]) || null;
}

// Hal fasal oo ardaygu ku jiro:
// { key, programId (preparation | xisaab-english | computer | english),
//   section (A–E / B·T·J), optionId (leaf), subjects }
let enrollKey = 0;
const newEnrollment = (programId = "", section = "", optionId = "", subjects = []) => ({
  key: `e${++enrollKey}`,
  programId,
  section,
  optionId,
  subjects,
});

const emptyForm = () => ({
  fullName: "",
  gender: "",
  motherName: "",
  studentPhone: "",
  parentPhone: "",
  password: "",
  enrollments: [newEnrollment()],
  shift: SHIFTS[0],
  feeType: FEE_TYPES[0],
  registrationFee: "",
  monthlyFee: "",
});

const MIN_PASSWORD = 4;

const isFreeType = (feeType) => isFreeStudent({ feeType });

function formFromStudent(s) {
  if (!s) return emptyForm();

  const enrollments = enrollmentsOf(s).map((e) => {
    const opt = optionForEnrollment(e);
    if (!opt) return newEnrollment(CLASS_BY_ID[e.classId] ? e.classId : "");
    const keep = e.subjects.filter((x) => opt.subjects.includes(x));
    return newEnrollment(opt.classId, opt.section, opt.id, keep.length ? keep : [...opt.subjects]);
  });

  return {
    fullName: s.fullName || "",
    gender: genderOf(s),
    motherName: s.motherName || "",
    studentPhone: s.studentPhone || "",
    parentPhone: s.parentPhone || "",
    password: s.password ? String(s.password) : "",
    enrollments: enrollments.length ? enrollments : [newEnrollment()],
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

const optionById = (id) => CLASS_OPTIONS.find((c) => c.id === id) || null;

// Form enrollment -> Firestore enrollment.
function toEnrollment(e) {
  const opt = optionById(e.optionId);
  if (!opt) return null;
  const subjects = e.subjects.filter((x) => opt.subjects.includes(x));
  return makeEnrollment(opt.classId, opt.subId ? [opt.subId] : [], subjects);
}

// English: Class + level -> leaf option id
function englishOptionId(section, levelId) {
  return section && levelId ? `english-${levelId}-${section.toLowerCase()}` : "";
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
/* Class picker:  1) fasalka  2) Class A–E / B·T·J  3) English level   */
/* ------------------------------------------------------------------ */

function ClassPicker({ idBase, value, onChange }) {
  const program = CLASS_BY_ID[value.programId] || null;
  const opt = optionById(value.optionId);
  const isEnglish = program?.id === "english";
  const levelId = isEnglish && opt ? opt.levelId : "";

  function pickProgram(cls) {
    if (cls.id === value.programId) return;
    if (!cls.subs) {
      const leaf = optionById(cls.id);
      onChange({ programId: cls.id, section: "", optionId: leaf.id, subjects: [...leaf.subjects] });
    } else {
      onChange({ programId: cls.id, section: "", optionId: "", subjects: [] });
    }
  }

  function pickSection(section) {
    if (isEnglish) {
      // Level-ka hore haddii la doortay waa la sii hayaa
      const id = englishOptionId(section, levelId);
      const leaf = optionById(id);
      onChange({ section, optionId: leaf ? leaf.id : "", subjects: leaf ? [...leaf.subjects] : [] });
    } else {
      const leaf = program.subs.find((s) => s.section === section);
      const o = optionById(leaf.id);
      onChange({ section, optionId: o.id, subjects: [...o.subjects] });
    }
  }

  function pickLevel(lvl) {
    const leaf = optionById(englishOptionId(value.section, lvl));
    onChange({ optionId: leaf ? leaf.id : "", subjects: leaf ? [...leaf.subjects] : [] });
  }

  return (
    <div className="cp">
      {/* Step 1 — class */}
      <div className="cp-step">
        <span className="cp-step-label"><b>1</b> Fasalka</span>
        <div className="cp-programs" role="radiogroup" aria-label="Fasalka">
          {CLASSES.map((c) => {
            const on = value.programId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={`cp-program tone-${c.color} ${on ? "on" : ""}`}
                onClick={() => pickProgram(c)}
              >
                <i className="cp-dot" />
                <span>
                  <strong>{c.name}</strong>
                  <small>{c.so}</small>
                </span>
                {on && <Check size={15} className="cp-check" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2 — Class A–E (English) or B·T·J */}
      {program?.subs && (
        <div className="cp-step">
          <span className="cp-step-label"><b>2</b> {isEnglish ? "English (A · B · C · D · E)" : "B Duhurley · T Galabley · J Habeenley"}</span>
          <div className="cp-sections" role="radiogroup" aria-label="Class">
            {(isEnglish ? ENGLISH_SECTIONS.map((x) => ({ section: x })) : program.subs).map((x) => {
              const on = value.section === x.section;
              return (
                <button
                  key={x.section}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`cp-section ${on ? "on" : ""} ${isEnglish ? "" : "wide"}`}
                  onClick={() => pickSection(x.section)}
                >
                  <strong>{x.section}</strong>
                  {x.time && <small>{x.time}</small>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3 — English level (select) */}
      {isEnglish && value.section && (
        <div className="cp-step">
          <label className="cp-step-label" htmlFor={`${idBase}-level`}>
            <b>3</b> English {value.section} — Level
          </label>
          <div className="sf-select">
            <select id={`${idBase}-level`} value={levelId} onChange={(e) => pickLevel(e.target.value)}>
              <option value="">— Dooro level-ka English {value.section} —</option>
              {ENGLISH_LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <ChevronDown size={18} />
          </div>
        </div>
      )}

      {opt && (
        <div className="cp-result">
          <CheckCircle2 size={16} />
          <span>
            <strong>{opt.name}</strong>
            {opt.so && opt.so !== opt.name && <small> · {opt.so}</small>}
          </span>
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
  const classesLoading = false;
  const isFree = isFreeType(form.feeType);
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
    if (!editStudent) return;
    setForm(formFromStudent(editStudent));
    setPhotoPreview(editStudent.photoUrl || null);
  }, [editStudent]);

  useEffect(() => {
    if (error)
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  const classSummary = form.enrollments
    .map((e) => optionById(e.optionId)?.name)
    .filter(Boolean)
    .join(" + ");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function updateEnrollment(key, fn) {
    setForm((f) => ({
      ...f,
      enrollments: f.enrollments.map((e) => (e.key === key ? fn(e) : e)),
    }));
  }

  function changeEnrollment(key, patch) {
    // Fasal la doortay -> maadooyinkiisa oo dhan waa la calaamadeeyaa ("All").
    updateEnrollment(key, (e) => ({ ...e, ...patch }));
  }

  function toggleAllSubjects(key) {
    updateEnrollment(key, (e) => {
      const subs = optionById(e.optionId)?.subjects || [];
      const allOn = subs.length > 0 && subs.every((x) => e.subjects.includes(x));
      return { ...e, subjects: allOn ? [] : [...subs] };
    });
  }

  function toggleSubject(key, subject) {
    updateEnrollment(key, (e) => ({
      ...e,
      subjects: e.subjects.includes(subject)
        ? e.subjects.filter((s) => s !== subject)
        : [...e.subjects, subject],
    }));
  }

  function addEnrollment() {
    setForm((f) => ({ ...f, enrollments: [...f.enrollments, newEnrollment()] }));
  }

  function removeEnrollment(key) {
    setForm((f) => ({
      ...f,
      enrollments: f.enrollments.length > 1 ? f.enrollments.filter((e) => e.key !== key) : f.enrollments,
    }));
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

    if (!form.gender) {
      setError("Dooro jinsiga ardayga (Wiil ama Gabar).");
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

    const enrollments = [];
    const seenGroups = new Set();
    for (let i = 0; i < form.enrollments.length; i++) {
      const e = form.enrollments[i];
      const opt = optionById(e.optionId);
      const tag = form.enrollments.length > 1 ? `Fasalka #${i + 1}: ` : "";
      if (!opt) {
        const prog = CLASS_BY_ID[e.programId];
        setError(
          tag +
            (!prog
              ? "Fadlan dooro fasalka."
              : prog.id === "english"
              ? !e.section
                ? "English: dooro Class-ka (A, B, C, D ama E)."
                : `English ${e.section}: dooro level-ka (Elementary, Intermediate, Advance ama Classic).`
              : `${prog.name}: dooro Class-ka (B Duhurley, T Galabley ama J Habeenley).`)
        );
        return;
      }
      const enr = toEnrollment(e);
      if (!enr || enr.subjects.length === 0) {
        setError(`${tag}${opt.name}: dooro ugu yaraan hal maado (ama All).`);
        return;
      }
      const dup = enr.groups.find((g) => seenGroups.has(g));
      if (dup) {
        setError(`${dup} laba jeer ayaa la doortay. Fasal kasta hal mar oo keliya ku dar.`);
        return;
      }
      enr.groups.forEach((g) => seenGroups.add(g));
      enrollments.push(enr);
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

      const placement = enrollmentFields(enrollments);
      const className = placement.classGroups.join(", ");

      const fields = {
        password,
        fullName: form.fullName.trim(),
        gender: form.gender,
        motherName: form.motherName.trim(),
        studentPhone: form.studentPhone.trim(),
        parentPhone: form.parentPhone.trim(),

        // Class placement (enrollments, classId, className, classGroups,
        // level, section, subClasses, subjects) — see config/schoolOptions.js
        ...placement,
        shift: form.shift,
        feeType: form.feeType,
        // Free → lacag ma bixiyo (Cashier-ka kama muuqdo)
        registrationFee: !isFree && form.registrationFee ? Number(form.registrationFee) : 0,
        monthlyFee: !isFree && form.monthlyFee ? Number(form.monthlyFee) : 0,
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

      setForm(emptyForm());
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
Class: ${created.className}
(Isla ID-ga iyo password-ka ayuu ku galayaa fasal kasta.)`;

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

          <div className="sf-field sf-wide">
            <span className="sf-label">
              Gender<b style={{ color: "var(--danger)" }} aria-hidden="true"> *</b>
            </span>
            <div className="sf-gender" role="radiogroup" aria-label="Gender">
              {GENDERS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  role="radio"
                  aria-checked={form.gender === g.value}
                  className={`sf-gender-opt ${g.value === "Male" ? "male" : "female"} ${form.gender === g.value ? "on" : ""}`}
                  onClick={() => update("gender", g.value)}
                >
                  <span className="sf-gender-ico">{g.value === "Male" ? "♂" : "♀"}</span>
                  <span>
                    <strong>{g.so}</strong>
                    <small>{g.label}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

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

      {/* ---------------- Classes (one or more) ---------------- */}
      <Section
        icon={Layers3}
        title="Classes and subjects"
        hint="Ardaygu wuxuu geli karaa hal fasal ama in ka badan — isla ID-ga iyo password-ka."
      >
        <div className="enroll-list">
          {form.enrollments.map((e, i) => {
            const opt = optionById(e.optionId);
            const subs = opt?.subjects || [];
            const noPick = !!CLASS_BY_ID[opt?.classId || e.programId]?.noSubjectPick;
            const allOn = subs.length > 0 && subs.every((x) => e.subjects.includes(x));
            return (
              <div key={e.key} className="enroll-card">
                <div className="enroll-head">
                  <strong>Fasalka #{i + 1}</strong>
                  {form.enrollments.length > 1 && (
                    <button
                      type="button"
                      className="sf-btn sf-btn-ghost sf-btn-sm"
                      onClick={() => removeEnrollment(e.key)}
                    >
                      <Trash2 size={15} /> Ka saar
                    </button>
                  )}
                </div>

                <ClassPicker
                  idBase={`sf-class-${e.key}`}
                  value={e}
                  onChange={(patch) => changeEnrollment(e.key, patch)}
                />

                {noPick ? (
                  opt && (
                    <p className="sf-note" style={{ margin: 0 }}>
                      Ardaygu {opt.name} maadooyinkeeda oo dhan ({subs.length}) ayuu qaadanayaa — maado lama doorto.
                    </p>
                  )
                ) : (
                <div className="sf-field sf-wide" style={{ marginTop: 14 }}>
                  <span className="sf-label">
                    Subjects
                    {e.subjects.length > 0 && <em>{e.subjects.length} selected</em>}
                  </span>
                  {!opt && (
                    <small className="sf-subject-hint">
                      Marka hore dooro fasalka (iyo Class-ka) — maadooyinka fasalkaas ayaa halkan ka soo muuqan doona.
                    </small>
                  )}
                  <div className="sf-chips">
                    {subs.length > 0 && (
                      <button
                        type="button"
                        aria-pressed={allOn}
                        className={`sf-chip sf-chip-all ${allOn ? "on" : ""}`}
                        onClick={() => toggleAllSubjects(e.key)}
                      >
                        {allOn && <Check size={14} />}
                        All
                      </button>
                    )}
                    {subs.map((subj) => {
                      const on = e.subjects.includes(subj);
                      return (
                        <button
                          key={subj}
                          type="button"
                          aria-pressed={on}
                          className={`sf-chip ${on ? "on" : ""}`}
                          onClick={() => toggleSubject(e.key, subj)}
                        >
                          {on && <Check size={14} />}
                          {subj}
                        </button>
                      );
                    })}
                  </div>
                </div>
                )}
              </div>
            );
          })}
        </div>

        <button type="button" className="sf-btn sf-btn-outline" onClick={addEnrollment} style={{ alignSelf: "flex-start" }}>
          <Plus size={16} /> Ku dar fasal kale
        </button>

        <p className="sf-note">
          Macallin kasta wuxuu arkaa ardaygan oo keliya fasalka uu dhigo iyo maadooyinka ardaygu fasalkaas ka qaato.
        </p>
      </Section>

      {/* ---------------- Shift ---------------- */}
      <Section icon={BookOpen} title="Shift" hint="Waqtiga dugsiga.">
        <div className="sf-field sf-wide">
          <div className="sf-segment" role="radiogroup" aria-label="Shift">
            {SHIFTS.map((sh) => (
              <button
                key={sh}
                type="button"
                role="radio"
                aria-checked={form.shift === sh}
                className={form.shift === sh ? "on" : ""}
                onClick={() => update("shift", sh)}
              >
                {sh}
              </button>
            ))}
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
          <Field
            id="sf-feeType"
            label="Fee type"
            wide
            hint={isFree ? "Free: ardaygu lacag ma bixiyo — Cashier-ka kama muuqdo." : undefined}
          >
            <div className="sf-fee-types" role="radiogroup" aria-label="Fee type">
              {FEE_TYPES.map((f) => {
                const on = form.feeType === f;
                const free = isFreeType(f);
                return (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={`sf-fee-opt ${free ? "free" : ""} ${on ? "on" : ""}`}
                    onClick={() => update("feeType", f)}
                  >
                    {on && <Check size={14} />}
                    {free ? "Free — Bilaash" : f}
                  </button>
                );
              })}
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
                value={isFree ? "0" : form.registrationFee}
                disabled={isFree}
                onChange={(e) => update("registrationFee", e.target.value)}
                placeholder="20"
              />
            </div>
          </Field>

          <Field id="sf-monthFee" label="Monthly fee" hint={form.enrollments.length > 1 ? "Wadarta fasallada oo dhan (bishii)." : undefined}>
            <div className="sf-prefix">
              <span>$</span>
              <input
                id="sf-monthFee"
                type="number"
                min="0"
                step="0.01"
                value={isFree ? "0" : form.monthlyFee}
                disabled={isFree}
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
            <small>{classSummary || "No class selected"}</small>
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
  font-weight:650; font-size:13.5px; display:flex; flex-direction:row; align-items:center;
  justify-content:flex-start; gap:4px; color:var(--ink);
}
.sf-photo-buttons label.sf-btn{flex-direction:row}
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

/* Fee type */
.sf-fee-types{display:flex; flex-wrap:wrap; gap:8px}
.sf-fee-opt{
  height:42px; padding:0 16px; display:inline-flex; align-items:center; gap:6px; font:inherit; font-weight:650;
  cursor:pointer; color:var(--ink); background:var(--white); border:1.5px solid var(--line); border-radius:10px;
}
.sf-fee-opt:hover{border-color:var(--g)}
.sf-fee-opt.on{background:var(--g-dark); border-color:var(--g-dark); color:#fff}
.sf-fee-opt.free{border-style:dashed; border-color:#93c5fd; color:#1d4ed8}
.sf-fee-opt.free.on{background:#1d4ed8; border-color:#1d4ed8; border-style:solid; color:#fff}

/* Gender */
.sf-gender{display:grid; grid-template-columns:1fr 1fr; gap:10px; max-width:420px}
.sf-gender-opt{
  --c:#2563eb; display:flex; align-items:center; gap:12px; padding:10px 14px; min-height:56px;
  font:inherit; text-align:left; cursor:pointer; color:var(--ink);
  background:var(--white); border:1.5px solid var(--line); border-radius:12px;
  transition:border-color .15s, background .15s, box-shadow .15s;
}
.sf-gender-opt.female{--c:#db2777}
.sf-gender-opt span:last-child{display:flex; flex-direction:column}
.sf-gender-opt small{color:var(--muted); font-size:12px}
.sf-gender-ico{
  width:32px; height:32px; border-radius:50%; display:grid; place-items:center; flex:none;
  font-size:17px; font-weight:800; color:var(--c); background:color-mix(in srgb, var(--c) 12%, #fff);
}
.sf-gender-opt:hover{border-color:var(--c)}
.sf-gender-opt.on{border-color:var(--c); background:color-mix(in srgb, var(--c) 8%, #fff); box-shadow:0 0 0 3px color-mix(in srgb, var(--c) 18%, transparent)}
.sf-gender-opt.on .sf-gender-ico{background:var(--c); color:#fff}
.sf-gender-opt:focus-visible{outline:3px solid rgba(23,128,63,.35); outline-offset:2px}

/* Class picker */
.cp{display:flex; flex-direction:column; gap:16px}
.cp-step{display:flex; flex-direction:column; gap:9px}
.cp-step-label{display:flex; align-items:center; gap:8px; font-weight:700; font-size:13.5px; color:var(--ink)}
label.cp-step-label{flex-direction:row; justify-content:flex-start; align-items:center; text-align:left; margin:0}
.cp-step-label b{
  width:22px; height:22px; border-radius:50%; display:grid; place-items:center;
  background:var(--g-dark); color:#fff; font-size:12px;
}
.cp-programs{display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:8px}
.cp-program{
  --c:#64748b;
  display:flex; align-items:center; gap:10px; min-height:58px; padding:10px 12px;
  font:inherit; text-align:left; cursor:pointer; color:var(--ink);
  background:var(--white); border:1.5px solid var(--line); border-radius:12px;
  transition:border-color .15s, background .15s, box-shadow .15s;
}
.cp-program.tone-amber{--c:#d97706} .cp-program.tone-green{--c:#16a34a}
.cp-program.tone-red{--c:#dc2626} .cp-program.tone-violet{--c:#7c3aed}
.cp-program.tone-slate,.cp-program.tone-blue{--c:#2563eb}
.cp-program:hover{border-color:var(--c)}
.cp-program span{display:flex; flex-direction:column; min-width:0; flex:1}
.cp-program strong{font-size:14px}
.cp-program small{font-size:12px; color:var(--muted)}
.cp-dot{width:10px; height:10px; border-radius:50%; background:var(--c); flex:none}
.cp-program.on{border-color:var(--c); background:color-mix(in srgb, var(--c) 9%, #fff); box-shadow:0 0 0 3px color-mix(in srgb, var(--c) 18%, transparent)}
.cp-check{color:var(--c); flex:none}
.cp-sections{display:flex; flex-wrap:wrap; gap:8px}
.cp-section{
  min-width:58px; height:52px; padding:0 14px; display:flex; flex-direction:column;
  align-items:center; justify-content:center; font:inherit; cursor:pointer; color:var(--ink);
  background:var(--white); border:1.5px solid var(--line); border-radius:12px;
}
.cp-section.wide{min-width:120px}
.cp-section strong{font-size:17px; line-height:1.1}
.cp-section small{font-size:12px; color:var(--muted)}
.cp-section:hover{border-color:var(--g)}
.cp-section.on{background:var(--g-dark); border-color:var(--g-dark); color:#fff}
.cp-section.on small{color:#cfe9d9}
.cp-result{
  display:flex; align-items:center; gap:8px; padding:10px 12px; border-radius:10px;
  background:var(--g-tint); color:var(--g-dark); border:1px solid var(--g-line);
}
.cp-result small{color:var(--muted)}
.cp-program:focus-visible,.cp-section:focus-visible{outline:3px solid rgba(23,128,63,.35); outline-offset:2px}
.sf input:disabled{background:var(--bg); color:var(--muted); cursor:not-allowed}

.enroll-list{display:flex; flex-direction:column; gap:14px}
.enroll-card{border:1px solid var(--line); border-radius:14px; padding:16px; background:#fcfdfc; display:flex; flex-direction:column; gap:14px}
.enroll-head{display:flex; align-items:center; justify-content:space-between; gap:10px}
.enroll-head strong{font-size:14px}

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
.sf-chip-all{font-weight:700; border-style:dashed}
.sf-chip-all.on{border-style:solid; background:var(--g); color:#fff}
.sf-subject-hint{display:block; color:#667085; font-size:.8rem; margin:2px 0 6px}

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