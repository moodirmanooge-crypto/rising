// src/components/TeacherForm.jsx
//
// Admin → Add Teacher / Edit Teacher
//  • Username-ka admin-ka ayaa qoraya (waa la hubiyaa in aan horey loo qaadan)
//  • Classes badan, class kasta maadooyin gaar ah
//  • Maalin kasta waqti gaar ah (daySchedules): marka maalin la doorto,
//    waqtigeeda ayaa la weydiinayaa — maalintii xiisado badan ayaa lagu
//    qori karaa (Xiisad 1, Xiisad 2, ...).

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import {
  UserPlus,
  Clock,
  CalendarDays,
  BookOpen,
  CheckCircle2,
  Copy,
  KeyRound,
  Shuffle,
  Save,
  X,
  Check,
  AtSign,
  Wand2,
  CopyCheck,
  Loader2,
  AlertCircle,
  List,
  Plus,
  Trash2,
} from "lucide-react";

import { db } from "../firebase";
import { DAYS, SUBJECT_OPTIONS, CLASS_GROUPS } from "../config/schoolOptions";
import { TEACHERS_COLLECTION } from "../config/collections";
import { formatTime12, getTeacherDays, getDaySchedule, periodText } from "../utils/attendance";
import { teacherAssignments } from "../utils/teacherClasses";
import TimePicker12 from "./TimePicker12";
import { teacherUsernameInBin } from "../utils/recycleBin";
import "../styles/teachers.css";

const MIN_PASSWORD = 4;
const DEFAULT_TIME = { startTime: "07:30", endTime: "08:30" };
const USERNAME_RE = /^[a-z][a-z0-9._]{2,19}$/;

const emptyForm = {
  fullName: "",
  phone: "",
  username: "",
  password: "",
  classSubjectAssignments: [],
  daySchedules: {}, // { Saturday: { periods: [{ startTime, endTime }, ...] }, ... }
};

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

function cleanUsername(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._]/g, "");
}

function toMin(hhmm) {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return h * 60 + m;
}

function fromMin(min) {
  const m = Math.max(0, Math.min(min, 23 * 60 + 55));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// Xiisad cusub: waxay ka bilaabataa dhammaadka tii ka horreysay, 1 saac
function nextPeriodAfter(periods) {
  const last = periods[periods.length - 1];
  if (!last) return { ...DEFAULT_TIME };
  const start = toMin(last.endTime);
  return { startTime: fromMin(start), endTime: fromMin(start + 60) };
}

const clonePeriods = (periods) => periods.map((p) => ({ ...p }));

function orderedDays(daySchedules) {
  return DAYS.filter((d) => daySchedules[d]);
}

function formFromTeacher(teacher) {
  if (!teacher) return { ...emptyForm, classSubjectAssignments: [], daySchedules: {} };

  const daySchedules = {};
  getTeacherDays(teacher).forEach((day) => {
    const match = DAYS.find((d) => d.toLowerCase() === String(day).toLowerCase()) || day;
    const sch = getDaySchedule(teacher, match);
    daySchedules[match] = {
      periods: sch.periods.length ? clonePeriods(sch.periods) : [{ ...DEFAULT_TIME }],
    };
  });

  return {
    fullName: teacher.fullName || "",
    phone: teacher.phone || "",
    username: teacher.username || teacher.teacherId || "",
    password: teacher.password ? String(teacher.password) : "",
    classSubjectAssignments: teacherAssignments(teacher),
    daySchedules,
  };
}

async function usernameTaken(username) {
  const byId = await getDoc(doc(db, TEACHERS_COLLECTION, username));
  if (byId.exists()) return true;
  // Username-ka macallin Recycle Bin-ka ku jira (ama "Delete forever") lama qaadan karo,
  // si haddii dib loo soo celiyo uusan ugu dhicin macallin kale.
  if (await teacherUsernameInBin(username)) return true;
  const byField = await getDocs(query(collection(db, TEACHERS_COLLECTION), where("username", "==", username)));
  return !byField.empty;
}

export default function TeacherForm({ onRegistered, editTeacher = null, onDone, onCancel, onViewList }) {
  const isEdit = !!editTeacher;
  const docId = editTeacher?.docId || editTeacher?.username || editTeacher?.teacherId;

  const [form, setForm] = useState(() => formFromTeacher(editTeacher));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  // "idle" | "checking" | "ok" | "taken" | "invalid"
  const [userState, setUserState] = useState("idle");

  const assignments = form.classSubjectAssignments;
  const selectedClasses = assignments.map((a) => a.className);
  const days = orderedDays(form.daySchedules);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // ---------- Username availability (create only) ----------
  useEffect(() => {
    if (isEdit) return;
    const u = form.username;
    if (!u) return setUserState("idle");
    if (!USERNAME_RE.test(u)) return setUserState("invalid");
    setUserState("checking");
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const taken = await usernameTaken(u);
        if (!cancelled) setUserState(taken ? "taken" : "ok");
      } catch {
        if (!cancelled) setUserState("idle");
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.username, isEdit]);

  function suggestUsername() {
    const first =
      String(form.fullName || "")
        .trim()
        .split(/\s+/)[0]
        ?.toLowerCase()
        .replace(/[^a-z]/g, "") || "teacher";
    update("username", `${first}${Math.floor(100 + Math.random() * 900)}`);
  }

  // ---------- Classes & subjects ----------
  function toggleClass(className) {
    setForm((prev) => {
      const exists = prev.classSubjectAssignments.some((a) => a.className === className);
      return {
        ...prev,
        classSubjectAssignments: exists
          ? prev.classSubjectAssignments.filter((a) => a.className !== className)
          : [...prev.classSubjectAssignments, { className, subjects: [] }],
      };
    });
  }

  function toggleSubject(className, subject) {
    setForm((prev) => ({
      ...prev,
      classSubjectAssignments: prev.classSubjectAssignments.map((a) =>
        a.className !== className
          ? a
          : {
              ...a,
              subjects: a.subjects.includes(subject)
                ? a.subjects.filter((s) => s !== subject)
                : [...a.subjects, subject],
            }
      ),
    }));
  }

  // ---------- Days & per-day time ----------
  function toggleDay(day) {
    setForm((prev) => {
      const next = { ...prev.daySchedules };
      if (next[day]) {
        delete next[day];
      } else {
        // Maalinta cusub: ku bilow xiisadaha maalinta ugu dambeysay ee la doortay
        const last = orderedDays(prev.daySchedules).slice(-1)[0];
        next[day] = { periods: last ? clonePeriods(prev.daySchedules[last].periods) : [{ ...DEFAULT_TIME }] };
      }
      return { ...prev, daySchedules: next };
    });
  }

  function updatePeriods(day, fn) {
    setForm((prev) => ({
      ...prev,
      daySchedules: {
        ...prev.daySchedules,
        [day]: { periods: fn(clonePeriods(prev.daySchedules[day].periods)) },
      },
    }));
  }

  function setPeriodTime(day, index, field, value) {
    updatePeriods(day, (periods) => {
      periods[index] = { ...periods[index], [field]: value };
      return periods;
    });
  }

  function addPeriod(day) {
    updatePeriods(day, (periods) => [...periods, nextPeriodAfter(periods)]);
  }

  function removePeriod(day, index) {
    updatePeriods(day, (periods) => periods.filter((_, i) => i !== index));
  }

  function copyToAll(day) {
    setForm((prev) => {
      const src = prev.daySchedules[day].periods;
      const next = {};
      orderedDays(prev.daySchedules).forEach((d) => (next[d] = { periods: clonePeriods(src) }));
      return { ...prev, daySchedules: next };
    });
  }

  // Khaladka xiisad gaar ah (ama "")
  function periodError(day, index) {
    const periods = form.daySchedules[day]?.periods || [];
    const p = periods[index];
    if (!p?.startTime || !p?.endTime) return "Dooro start iyo end time (AM/PM).";
    if (p.startTime >= p.endTime) return "End time waa inuu ka dambeeyaa start time.";
    const clash = periods.findIndex(
      (q, i) => i !== index && q.startTime && q.endTime && p.startTime < q.endTime && q.startTime < p.endTime
    );
    if (clash !== -1) return `Waxay ku dhacaysaa Xiisad ${clash + 1} — waqtiyadu ha is-dul marin.`;
    return "";
  }

  function dayError(day) {
    const periods = form.daySchedules[day]?.periods || [];
    if (!periods.length) return "Ku dar ugu yaraan hal xiisad.";
    const bad = periods.findIndex((_, i) => periodError(day, i));
    return bad === -1 ? "" : `Xiisad ${bad + 1}: ${periodError(day, bad)}`;
  }

  // ---------- Submit ----------
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setCreated(null);
    setCopied(false);

    const password = form.password.trim();
    const username = cleanUsername(form.username);
    const cleanAssignments = assignments
      .map((a) => ({ className: String(a.className).trim(), subjects: [...new Set(a.subjects.filter(Boolean))] }))
      .filter((a) => a.className);

    if (!form.fullName.trim()) return setError("Full Name is required.");
    if (!isEdit) {
      if (!username) return setError("Geli username-ka macalinka (tusaale: ahmed482).");
      if (!USERNAME_RE.test(username)) {
        return setError("Username: 3–20 xaraf, ku bilow xaraf, kaliya a–z, 0–9, dhibic (.) ama _ — meel bannaan ma laha.");
      }
    }
    if (password.length < MIN_PASSWORD) return setError(`Geli password-ka macalinka (ugu yaraan ${MIN_PASSWORD} xaraf/lambar).`);
    if (/\s/.test(password)) return setError("Password-ku waa inuusan lahayn meel bannaan (space).");
    if (!cleanAssignments.length) return setError("Dooro ugu yaraan hal class.");
    const noSubject = cleanAssignments.find((a) => !a.subjects.length);
    if (noSubject) return setError(`Dooro ugu yaraan hal maado: ${noSubject.className}`);
    if (!days.length) return setError("Dooro ugu yaraan hal maalin xaadirinta.");
    const badDay = days.find((d) => dayError(d));
    if (badDay) return setError(`${badDay}: ${dayError(badDay)}`);

    setSaving(true);
    try {
      const allSubjects = [...new Set(cleanAssignments.flatMap((a) => a.subjects))];
      // Xiisadaha waxaa lagu kala horreysiiyaa waqtiga; startTime/endTime =
      // xiisadda koowaad (code hore ayaa isticmaala).
      const daySchedules = Object.fromEntries(
        days.map((d) => {
          const periods = clonePeriods(form.daySchedules[d].periods).sort((a, b) => a.startTime.localeCompare(b.startTime));
          return [d, { periods, startTime: periods[0].startTime, endTime: periods[0].endTime }];
        })
      );
      const first = daySchedules[days[0]];

      const data = {
        password,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),

        classSubjectAssignments: cleanAssignments,
        classAssignments: cleanAssignments,
        classGroups: cleanAssignments.map((a) => a.className),
        classNames: cleanAssignments.map((a) => a.className),
        className: cleanAssignments[0].className,
        subjects: allSubjects,
        subject: allSubjects[0] || "",

        // Maalin kasta waqtigeeda
        daySchedules,
        attendanceDays: days,
        attendanceDay: days[0],
        // Compatibility (code hore): waqtiga maalinta koowaad
        startTime: first.startTime,
        endTime: first.endTime,
      };

      if (isEdit) {
        await updateDoc(doc(db, TEACHERS_COLLECTION, docId), { ...data, updatedAt: serverTimestamp() });
        onDone?.({ username: editTeacher.username || docId, fullName: data.fullName, password });
        return;
      }

      if (await usernameTaken(username)) {
        setUserState("taken");
        throw new Error(`Username-ka "${username}" horey ayaa loo qaatay. Dooro mid kale.`);
      }

      const record = {
        teacherId: username,
        username,
        ...data,
        role: "teacher",
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, TEACHERS_COLLECTION, username), record);

      setCreated({ ...record, createdAt: null });
      setForm({ ...emptyForm, classSubjectAssignments: [], daySchedules: {} });
      setUserState("idle");
      onRegistered?.(username);
    } catch (err) {
      console.error("Teacher save error:", err);
      setError(err.message || "Failed to save teacher.");
    } finally {
      setSaving(false);
    }
  }

  function scheduleLines(rec) {
    return (rec.attendanceDays || []).map((d) => {
      const periods = rec.daySchedules?.[d]?.periods || [];
      return `${d}: ${periods.map(periodText).join(", ")}`;
    });
  }

  function copyCredentials() {
    if (!created) return;
    const text =
      `Rising Star School — Teacher Login\n` +
      `Username: ${created.username}\n` +
      `Password: ${created.password}\n\n` +
      `Classes & Subjects:\n${created.classSubjectAssignments.map((a) => `${a.className}: ${a.subjects.join(", ")}`).join("\n")}\n\n` +
      `Attendance:\n${scheduleLines(created).join("\n")}`;
    navigator.clipboard?.writeText(text).then(() => setCopied(true));
  }

  const userHint = {
    checking: { cls: "wait", Icon: Loader2, text: "Waa la hubinayaa…" },
    ok: { cls: "ok", Icon: CheckCircle2, text: "Username-kan waa bannaan yahay" },
    taken: { cls: "bad", Icon: AlertCircle, text: "Username-kan horey ayaa loo qaatay" },
    invalid: { cls: "bad", Icon: AlertCircle, text: "3–20 xaraf, ku bilow xaraf: a–z, 0–9, . ama _" },
  }[userState];

  return (
    <form className={isEdit ? "form" : "panel form"} onSubmit={handleSubmit}>
      <div className="panel-head">
        <div className="panel-icon"><UserPlus size={20} /></div>
        <div>
          <h2>{isEdit ? `Edit Teacher — ${editTeacher.fullName || docId}` : "Register New Teacher"}</h2>
          <p>
            {isEdit
              ? "Wax ka beddel xogta macalinka, classes-ka, maadooyinka iyo waqtiga maalin kasta."
              : "Username samee, classes iyo maadooyin u qoondee, maalin kastana waqtigeeda dooro."}
          </p>
        </div>
      </div>

      {created && (
        <div className="credential-card">
          <div className="credential-head">
            <CheckCircle2 size={22} />
            <div>
              <strong>Teacher registered successfully</strong>
              <span>{created.fullName}</span>
            </div>
          </div>
          <div className="credential-grid">
            <div><span>Username</span><strong>{created.username}</strong></div>
            <div><span>Password</span><strong>{created.password}</strong></div>
            <div>
              <span>Classes & Subjects</span>
              <strong>{created.classSubjectAssignments.map((a) => `${a.className}: ${a.subjects.join(", ")}`).join(" • ")}</strong>
            </div>
            <div><span>Attendance</span><strong>{scheduleLines(created).join(" • ")}</strong></div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-light" onClick={copyCredentials}>
              <Copy size={15} /> {copied ? "Copied!" : "Copy login details"}
            </button>
            {onViewList && (
              <button type="button" className="btn btn-ghost" onClick={onViewList}>
                <List size={15} /> Teacher List
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {/* ---------------- Personal & login ---------------- */}
      <div className="form-section-title">Personal info & login</div>
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
          <input type="text" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="061xxxxxxx" />
        </label>

        <label>
          Username (login)
          {isEdit ? (
            <input type="text" value={form.username} readOnly disabled />
          ) : (
            <>
              <div className="tf-username">
                <div className="input-at">
                  <span><AtSign size={15} /></span>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => update("username", cleanUsername(e.target.value))}
                    placeholder="tusaale: ahmed482"
                    autoComplete="off"
                    spellCheck={false}
                    required
                  />
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={suggestUsername} title="Soo jeedi username">
                  <Wand2 size={14} /> Suggest
                </button>
              </div>
              {userHint && (
                <span className={`tf-username-state ${userHint.cls}`}>
                  <userHint.Icon size={13} /> {userHint.text}
                </span>
              )}
            </>
          )}
        </label>

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
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => update("password", generatePassword())}>
              <Shuffle size={14} /> Generate
            </button>
          </div>
        </label>
      </div>

      {!isEdit && (
        <p className="hint">
          Username-ka adiga ayaa qoraya (xarfo yaryar, lambar, . ama _). Macalinku wuxuu Teacher Portal-ka ku galayaa
          username-kaas iyo password-ka aad halkan geliso.
        </p>
      )}

      {/* ---------------- Classes & subjects ---------------- */}
      <div className="form-section-title">
        <BookOpen size={15} /> Classes & Subjects
      </div>

      <div style={{ marginBottom: 18, padding: 16, border: "1px solid #e2e8f0", borderRadius: 16, background: "#f8fafc" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <div>
            <strong style={{ display: "block", fontSize: 16, color: "#0f172a" }}>Assign Classes & Subjects</strong>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              Hal macallin waxaa loo diri karaa classes badan, class kasta-na maadooyin gaar ah.
            </span>
          </div>
          <span
            style={{
              padding: "7px 12px",
              borderRadius: 999,
              background: selectedClasses.length ? "#dcfce7" : "#f1f5f9",
              color: selectedClasses.length ? "#166534" : "#64748b",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {selectedClasses.length} class selected
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {CLASS_GROUPS.map((className) => {
            const selected = selectedClasses.includes(className);
            return (
              <button
                key={className}
                type="button"
                onClick={() => toggleClass(className)}
                style={{
                  textAlign: "left",
                  padding: "13px 14px",
                  border: selected ? "2px solid #16a34a" : "1px solid #dbe2ea",
                  borderRadius: 14,
                  background: selected ? "#f0fdf4" : "#fff",
                  color: "#0f172a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                <span>{className}</span>
                <span
                  style={{
                    width: 23,
                    height: 23,
                    borderRadius: "50%",
                    border: selected ? 0 : "1px solid #cbd5e1",
                    background: selected ? "#16a34a" : "#fff",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  {selected && <Check size={14} />}
                </span>
              </button>
            );
          })}
        </div>

        {assignments.length > 0 && (
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            {assignments.map((a) => (
              <div key={a.className} style={{ padding: 15, border: "1px solid #dbe2ea", borderRadius: 14, background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                  <div>
                    <strong style={{ display: "block", fontSize: 15 }}>{a.className}</strong>
                    <span style={{ fontSize: 12, color: "#64748b" }}>Dooro maadooyinka macallinku class-kan ka dhigi doono.</span>
                  </div>
                  <span
                    style={{
                      padding: "5px 9px",
                      borderRadius: 999,
                      background: a.subjects.length ? "#dcfce7" : "#fef2f2",
                      color: a.subjects.length ? "#166534" : "#b91c1c",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {a.subjects.length} subject{a.subjects.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                  {SUBJECT_OPTIONS.map((subject) => {
                    const on = a.subjects.includes(subject);
                    return (
                      <button
                        key={subject}
                        type="button"
                        onClick={() => toggleSubject(a.className, subject)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          padding: "10px 12px",
                          borderRadius: 11,
                          border: on ? "2px solid #16a34a" : "1px solid #dbe2ea",
                          background: on ? "#f0fdf4" : "#fff",
                          color: on ? "#166534" : "#334155",
                          fontWeight: 650,
                          textAlign: "left",
                        }}
                      >
                        <span>{subject}</span>
                        {on && <Check size={16} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------------- Days + time per day ---------------- */}
      <div className="form-section-title">
        <CalendarDays size={15} /> Attendance days & time (maalin kasta waqtigeeda)
      </div>

      <div className="tf-days">
        {DAYS.map((day) => {
          const s = form.daySchedules[day];
          return (
            <button key={day} type="button" className={`tf-day ${s ? "on" : ""}`} onClick={() => toggleDay(day)}>
              <strong>{day.slice(0, 3)}</strong>
              <small>
                {s
                  ? `${formatTime12(s.periods[0]?.startTime)}${s.periods.length > 1 ? ` +${s.periods.length - 1}` : ""}`
                  : "Off"}
              </small>
            </button>
          );
        })}
      </div>

      {days.length === 0 ? (
        <div className="tf-empty-days">
          <Clock size={18} style={{ verticalAlign: "-4px" }} /> Taabo maalin — kadib waqtiga maalintaas ayaa la weydiinayaa.
        </div>
      ) : (
        <div className="tf-schedule">
          {days.map((day) => {
            const periods = form.daySchedules[day].periods;
            const err = dayError(day);
            return (
              <div key={day} className={`tf-day-card ${err ? "has-error" : ""}`}>
                <div className="tf-day-card-head">
                  <div className="tf-schedule-day">
                    <strong>{day}</strong>
                    <span>
                      {periods.length} xiisad{periods.length === 1 ? "" : "o"}
                      {!err && ` · ${periods.map(periodText).join(", ")}`}
                    </span>
                  </div>
                  <div className="tf-schedule-actions">
                    {days.length > 1 && (
                      <button type="button" className="btn btn-ghost btn-sm" title="Xiisadahan u isticmaal maalmaha oo dhan" onClick={() => copyToAll(day)}>
                        <CopyCheck size={14} /> All days
                      </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" title="Ka saar maalintan" onClick={() => toggleDay(day)}>
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {periods.map((p, i) => {
                  const pErr = periodError(day, i);
                  return (
                    <div key={i} className={`tf-period ${pErr ? "has-error" : ""}`}>
                      <div className="tf-period-tag">
                        <strong>Xiisad {i + 1}</strong>
                        <span>{pErr || periodText(p)}</span>
                      </div>
                      <label>
                        Start time
                        <TimePicker12 value={p.startTime} onChange={(v) => setPeriodTime(day, i, "startTime", v)} />
                      </label>
                      <label>
                        End time
                        <TimePicker12 value={p.endTime} onChange={(v) => setPeriodTime(day, i, "endTime", v)} />
                      </label>
                      <div className="tf-schedule-actions">
                        {periods.length > 1 && (
                          <button type="button" className="btn btn-ghost btn-sm" title={`Ka saar Xiisad ${i + 1}`} onClick={() => removePeriod(day, i)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                <button type="button" className="tf-add-period" onClick={() => addPeriod(day)}>
                  <Plus size={15} /> Ku dar xiisad kale ({day})
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="hint">
        Maalin kasta waqti gaar ah ayay leedahay, maalintiina xiisado badan ayaa lagu qori karaa. PM wuxuu ka bilaabmaa
        12:00 duhurnimo (1:00 PM = 13:00). Macallinku wuxuu xaadirin karaa xiisadaha maalinta oo kaliya — class kasta
        hal mar maalintii.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={saving || (!isEdit && (userState === "taken" || userState === "invalid"))}
        >
          {isEdit ? <Save size={16} /> : <UserPlus size={16} />}
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