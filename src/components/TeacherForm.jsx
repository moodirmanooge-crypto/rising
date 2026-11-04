// src/components/TeacherForm.jsx
//
// Admin → Add Teacher / Edit Teacher (Rising Star School)
//  • Username-ka admin-ka ayaa qoraya (waa la hubiyaa in aan horey loo qaadan)
//  • Fasallo badan: block kasta = Class + Maado + Shift (dropdown) + maalmaha
//    + xiisadaha maalin kasta (ClassScheduleEditor). Fasallada, maadooyinka,
//    maalmaha iyo shift-yada waa kuwa config/schoolOptions (CLASS_GROUPS …).
//  • Waxaa la keydiyaa daySchedules / attendanceDays / classSubjectAssignments
//    (buildTeacherSchedule) si xaadirintu waqtigeeda saxda ah u qaadato.

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, runTransaction, updateDoc, serverTimestamp, where } from "firebase/firestore";
import {
  UserPlus,
  BookOpen,
  CheckCircle2,
  Copy,
  KeyRound,
  Shuffle,
  Save,
  X,
  AtSign,
  Wand2,
  Loader2,
  AlertCircle,
  List,
} from "lucide-react";

import { db } from "../firebase";
import { TEACHERS_COLLECTION } from "../config/collections";
import { DAYS, SUBJECT_OPTIONS, CLASS_GROUPS, CLASS_GROUP_SECTIONS, SHIFTS, resolveGroupLabel, subjectsFor } from "../config/schoolOptions";
import { teacherAssignments } from "../utils/teacherClasses";
import TimePicker12 from "./TimePicker12";
import ClassScheduleEditor from "./ClassScheduleEditor";
import { teacherUsernameInBin } from "../utils/recycleBin";
import { blocksFromTeacher, buildTeacherSchedule, formatTime12, validateClassBlocks } from "../utils/schoolForms";
import "../styles/teachers.css";

const MIN_PASSWORD = 4;
const USERNAME_RE = /^[a-z][a-z0-9._]{2,19}$/;

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

// Maadooyinka fasal gaar ah (tusaale Class A English Elementary -> English)
function subjectsForClass(className) {
  const r = resolveGroupLabel(className);
  const list = r ? subjectsFor(r.classId, r.subId) : [];
  return list.length ? list : SUBJECT_OPTIONS;
}

// Macallinka maado looma qoro — fasal + shift oo keliya. Block-yada hore ee isla
// fasalka (maadooyin kala duwan) waa la isku daraa (maalmaha + xiisadaha).
function mergeByClass(blocks) {
  const out = [];
  blocks.forEach((b) => {
    const nb = { ...b, subject: "" };
    const same = nb.className && out.find((x) => x.className === nb.className);
    if (!same) {
      out.push({ ...nb, days: [...(nb.days || [])], daySessions: { ...(nb.daySessions || {}) } });
      return;
    }
    if (!same.shift && nb.shift) same.shift = nb.shift;
    (nb.days || []).forEach((d) => {
      if (!same.days.includes(d)) same.days.push(d);
      const have = same.daySessions[d] || [];
      const add = (nb.daySessions?.[d] || []).filter(
        (s) => !have.some((h) => h.startTime === s.startTime && h.endTime === s.endTime)
      );
      same.daySessions[d] = [...have, ...add];
    });
  });
  return out;
}

function formFromTeacher(teacher) {
  return {
    fullName: teacher?.fullName || "",
    phone: teacher?.phone || "",
    username: teacher?.username || teacher?.teacherId || "",
    password: teacher?.password ? String(teacher.password) : "",
    classBlocks: mergeByClass(blocksFromTeacher(teacher, teacherAssignments(teacher))),
  };
}

const classesText = (rec) =>
  (rec.classSubjectAssignments || []).map((a) => a.className).join(" • ");

async function usernameTaken(username) {
  const byId = await getDoc(doc(db, TEACHERS_COLLECTION, username));
  if (byId.exists()) return true;
  // Username-ka macallin Recycle Bin-ka ku jira lama qaadan karo (dib ayaa loo soo celin karaa).
  if (await teacherUsernameInBin(username)) return true;
  const byField = await getDocs(query(collection(db, TEACHERS_COLLECTION), where("username", "==", username)));
  return !byField.empty;
}

function scheduleLines(rec) {
  return (rec.attendanceDays || []).map((d) => {
    const periods = rec.daySchedules?.[d]?.periods || [];
    return `${d}: ${periods
      .map((p) => `${formatTime12(p.startTime)}–${formatTime12(p.endTime)} (${p.className})`)
      .join(", ")}`;
  });
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

  // ---------- Submit ----------
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setCreated(null);
    setCopied(false);

    const password = form.password.trim();
    const username = cleanUsername(form.username);

    if (!form.fullName.trim()) return setError("Full Name is required.");
    if (!isEdit) {
      if (!username) return setError("Geli username-ka macalinka (tusaale: ahmed482).");
      if (!USERNAME_RE.test(username)) {
        return setError("Username: 3–20 xaraf, ku bilow xaraf, kaliya a–z, 0–9, dhibic (.) ama _ — meel bannaan ma laha.");
      }
    }
    if (password.length < MIN_PASSWORD) return setError(`Geli password-ka macalinka (ugu yaraan ${MIN_PASSWORD} xaraf/lambar).`);
    if (/\s/.test(password)) return setError("Password-ku waa inuusan lahayn meel bannaan (space).");
    const scheduleError = validateClassBlocks(form.classBlocks, { requireSubject: false, requireShift: true });
    if (scheduleError) return setError(scheduleError);
    const oldClass = form.classBlocks.find((b) => b.className && !CLASS_GROUPS.includes(b.className));
    if (oldClass) {
      return setError(`"${oldClass.className}" fasal hadda jira ma aha. Dooro mid ka mid ah fasallada cusub.`);
    }

    setSaving(true);
    try {
      const data = {
        password,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        ...buildTeacherSchedule(form.classBlocks.map((b) => ({ ...b, subject: "" }))),
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

      const record = { teacherId: username, username, ...data, role: "teacher", createdAt: serverTimestamp() };
      // Transaction: haddii laba admin isku mar isla username sameeyaan, kan labaad waa la diidayaa
      await runTransaction(db, async (tx) => {
        const ref = doc(db, TEACHERS_COLLECTION, username);
        if ((await tx.get(ref)).exists()) {
          throw new Error(`Username-ka "${username}" horey ayaa loo qaatay. Dooro mid kale.`);
        }
        tx.set(ref, record);
      });

      setCreated({ ...record, createdAt: null });
      setForm(formFromTeacher(null));
      setUserState("idle");
      onRegistered?.(username);
    } catch (err) {
      console.error("Teacher save error:", err);
      setError(err.message || "Failed to save teacher.");
    } finally {
      setSaving(false);
    }
  }

  function copyCredentials() {
    if (!created) return;
    const text =
      `Rising Star School — Teacher Login\n` +
      `Username: ${created.username}\n` +
      `Password: ${created.password}\n\n` +
      `Classes:\n${created.classSubjectAssignments.map((a) => a.className).join("\n")}\n\n` +
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
        <div className="panel-icon">
          <UserPlus size={20} />
        </div>
        <div>
          <h2>{isEdit ? `Edit Teacher — ${editTeacher.fullName || docId}` : "Register New Teacher"}</h2>
          <p>
            {isEdit
              ? "Wax ka beddel xogta macalinka, fasallada, shift-ka iyo waqtiga xaadirinta."
              : "Username samee, fasallada (dropdown) u qoondee, maalin kastana waqtigeeda dooro."}
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
            <div>
              <span>Username</span>
              <strong>{created.username}</strong>
            </div>
            <div>
              <span>Password</span>
              <strong>{created.password}</strong>
            </div>
            <div>
              <span>Classes</span>
              <strong>{classesText(created)}</strong>
            </div>
            <div>
              <span>Attendance</span>
              <strong>{scheduleLines(created).join(" • ")}</strong>
            </div>
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
          <input
            type="text"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="061xxxxxxx"
          />
        </label>

        <label>
          Username (login)
          {isEdit ? (
            <input type="text" value={form.username} readOnly disabled />
          ) : (
            <>
              <div className="tf-username">
                <div className="input-at">
                  <span>
                    <AtSign size={15} />
                  </span>
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

      {/* ---------------- Classes, subjects, days & times ---------------- */}
      <div className="form-section-title">
        <BookOpen size={15} /> Fasallada, shift-ka iyo waqtiga xaadirinta
      </div>

      <ClassScheduleEditor
        theme="light"
        blocks={form.classBlocks}
        onChange={(blocks) => update("classBlocks", blocks)}
        classOptions={CLASS_GROUPS}
        classSections={CLASS_GROUP_SECTIONS}
        subjectOptions={SUBJECT_OPTIONS}
        subjectsForClass={subjectsForClass}
        hideSubject
        days={DAYS}
        shiftOptions={SHIFTS?.length ? SHIFTS : undefined}
        TimePicker={TimePicker12}
      />

      <p className="hint">
        Fasal kasta block gooni ah ayuu leeyahay. Macallinku wuxuu xaadirin karaa fasal kasta xiisadihiisa oo keliya —
        class kasta hal mar maalintii. PM wuxuu ka bilaabmaa 12:00 duhurnimo (1:00 PM = 13:00).
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