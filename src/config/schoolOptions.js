// ============================================================
// RISING STAR SCHOOL SYSTEM — classes, subjects & shared options
// ============================================================
//
// Fasallada iyo maadooyinka hoos ku qoran waa kuwa warqadda
// "Classes and Subjects" ku qoran (Boss):
//
//   1. Preparation A–D     — Somali, Xisaab, English, Arabic, Saynis,
//                            Cilmi Bulsho, Teknoloji, Tarbiyo
//   2. Class 8             — isla maadooyinka Preparation
//   3. Scientific Class    — Biology, Chemistry, Maths, Physics
//   4. Computer Class      — Windows & Basics, Word, PowerPoint,
//                            Excel, Typing Skills
//   5. Open Classes        — Af-Somali / Xisaab (mid ama labadaba)
//   6. Health Education    — Basic Health Skills / First Aid
//   7. English Department  — Elementary A·B·C·D, Intermediate A·B·C·D
//                            (fasal kastaa waa fasal gooni ah)
//
// Halkan wax ka beddel oo dhammaan bogagga (Add Student, Classes,
// Student List, Cashier, Exams, Teachers) ayaa si toos ah u isticmaala.
// ============================================================

// ============================================================
// GENERAL OPTIONS
// ============================================================

export const DAYS = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

export const SHIFTS = ["Morning", "Afternoon", "Evening"];

export const FEE_TYPES = ["Monthly", "Term", "Full Course", "Scholarship"];

export const PAYMENT_METHODS = ["Cash", "EVC Plus", "Zaad", "Sahal", "E-Dahab", "Bank"];

export const ATTENDANCE_STATUSES = [
  { value: "present", label: "Present", so: "Joogay", tone: "green" },
  { value: "absent", label: "Absent", so: "Maqan", tone: "red" },
  { value: "late", label: "Late", so: "Daahay", tone: "amber" },
  { value: "excused", label: "Excused", so: "Fasax", tone: "blue" },
];

export const STATUS_META = Object.fromEntries(
  ATTENDANCE_STATUSES.map((status) => [status.value, status])
);

// ============================================================
// SUBJECTS (per class, exactly as on the paper)
// ============================================================

const SCHOOL_SUBJECTS = [
  "Somali",
  "Xisaab",
  "English",
  "Arabic",
  "Saynis",
  "Cilmi Bulsho",
  "Teknoloji",
  "Tarbiyo",
];

const SCIENTIFIC_SUBJECTS = ["Biology", "Chemistry", "Maths", "Physics"];

const COMPUTER_SUBJECTS = [
  "Windows & Basics",
  "Microsoft Word",
  "Microsoft PowerPoint",
  "Microsoft Excel",
  "Typing Skills",
];

const BASIC_HEALTH_SUBJECTS = [
  "First Aid",
  "Anatomy",
  "Physiology",
  "Communicable Diseases",
  "Nutrition",
];

// ============================================================
// ENGLISH DEPARTMENT — Elementary & Intermediate, sections A–D
// ============================================================

export const ENGLISH_LEVELS = [
  { id: "elementary", name: "Elementary", color: "green" },
  { id: "intermediate", name: "Intermediate", color: "blue" },
];

export const ENGLISH_SECTIONS = ["A", "B", "C", "D"];

// Preparation: Class A–D (sida English). Ardayda Preparation ee aan
// section lahayn waxay si toos ah u galaan Preparation A.
export const PREPARATION_SECTIONS = ["A", "B", "C", "D"].map((section) => ({
  id: `prep-${section.toLowerCase()}`,
  name: `Preparation ${section}`,
  so: `Qeybta Diyaarinta — Class ${section}`,
  section,
  subjects: SCHOOL_SUBJECTS,
}));

export const ENGLISH_GROUPS = ENGLISH_LEVELS.flatMap((level) =>
  ENGLISH_SECTIONS.map((section) => ({
    id: `english-${level.id}-${section.toLowerCase()}`,
    name: `Class ${section} English ${level.name}`,
    so: `English ${level.name} — Class ${section}`,
    level: level.name,
    levelId: level.id,
    section,
    color: level.color,
    subjects: ["English"],
  }))
);

// ============================================================
// SCHOOL CLASSES
// ============================================================
//
// subs     → fasallada hoose (sub-classes). Arday kasta wuxuu galaa mid.
// multi    → ardaygu wuxuu geli karaa in ka badan hal sub (Open Classes).
// aliases  → magacyo hore oo xogta Firestore ku jira (si ardayda hore
//            loo helo).
// ============================================================

export const CLASSES = [
  {
    id: "preparation",
    name: "Preparation",
    so: "Qeybta Diyaarinta",
    color: "green",
    subjects: SCHOOL_SUBJECTS,
    aliases: ["Preparation Class", "Diyaarin"],
    sectioned: true,
    subs: PREPARATION_SECTIONS,
  },
  {
    id: "class8",
    name: "Class 8",
    so: "Fasalka 8aad",
    color: "amber",
    subjects: SCHOOL_SUBJECTS,
    aliases: ["8A Class", "8A", "Class 8A", "Fasalka 8aad"],
  },
  {
    id: "f4",
    name: "Scientific Class",
    so: "Fasalka Sayniska",
    color: "blue",
    subjects: SCIENTIFIC_SUBJECTS,
    aliases: ["Scientific F4", "Scientific", "F4"],
  },
  {
    id: "computer",
    name: "Computer Class",
    so: "Fasalka Kombiyuutarka",
    color: "violet",
    subjects: COMPUTER_SUBJECTS,
    aliases: ["Computer"],
  },
  {
    id: "open",
    name: "Open Classes",
    so: "Fasallada Furan",
    color: "red",
    multi: true,
    subjects: ["Somali", "Xisaab"],
    aliases: ["Open Class"],
    subs: [
      { id: "somali", name: "Af-Somali", so: "Somali", subjects: ["Somali"] },
      { id: "xisaab", name: "Xisaab", so: "Xisaab", subjects: ["Xisaab"] },
    ],
  },
  {
    id: "health",
    name: "Health Education",
    so: "Waxbarashada Caafimaadka",
    color: "teal",
    aliases: ["Healthy Education", "Health"],
    subs: [
      {
        id: "basic-health",
        name: "Basic Health Skills",
        so: "Xirfadaha Caafimaadka Aasaasiga",
        subjects: BASIC_HEALTH_SUBJECTS,
      },
      {
        id: "first-aid",
        name: "First Aid",
        so: "Gargaarka Degdegga",
        subjects: ["First Aid"],
      },
    ],
  },
  {
    id: "english",
    name: "English Department",
    so: "Qeybta Ingiriisiga",
    color: "slate",
    subjects: ["English"],
    aliases: ["English"],
    sectioned: true,
    subs: ENGLISH_GROUPS,
  },
];

export const CLASS_BY_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

// All subjects, in paper order (used by Exams and Teacher forms).
export const SUBJECT_OPTIONS = [
  ...new Set(
    CLASSES.flatMap((c) => [
      ...(c.subjects || []),
      ...(c.subs || []).flatMap((s) => s.subjects || []),
    ])
  ),
];

// "Open Classes – Xisaab", "Health Education – First Aid",
// English sections already have a full name: "Class A English Elementary".
export function groupLabel(cls, sub) {
  if (!cls) return "";
  if (!sub) return cls.name;
  if (cls.id === "english" || cls.id === "preparation") return sub.name;
  return `${cls.name} – ${sub.name}`;
}

// Every group a teacher can be assigned to / a student can be placed in.
export const CLASS_GROUPS = CLASSES.flatMap((c) =>
  c.subs ? c.subs.map((s) => groupLabel(c, s)) : [c.name]
);

export function subjectsFor(classId, subId) {
  const cls = CLASS_BY_ID[classId];
  if (!cls) return [];
  const sub = cls.subs?.find((s) => s.id === subId);
  if (sub?.subjects) return sub.subjects;
  return cls.subjects || [];
}

// ============================================================
// OPTIONS FOR THE "ADD STUDENT" CLASS DROPDOWN
// ============================================================
//
// One option per real class a student sits in. Open Classes is one
// option (the student then ticks Af-Somali, Xisaab or both).

export const CLASS_OPTION_GROUPS = [
  {
    key: "school",
    label: "School classes",
    color: "#16a34a",
    list: ["class8", "f4", "computer"].map((id) => {
      const c = CLASS_BY_ID[id];
      return { id: c.id, classId: c.id, subId: "", name: c.name, so: c.so, subjects: c.subjects };
    }),
  },
  {
    key: "preparation",
    label: "Preparation",
    color: "#15803d",
    list: PREPARATION_SECTIONS.map((p) => ({
      id: p.id,
      classId: "preparation",
      subId: p.id,
      name: p.name,
      so: p.so,
      section: p.section,
      subjects: p.subjects,
    })),
  },
  {
    key: "open",
    label: "Open Classes",
    color: "#dc2626",
    list: [
      {
        id: "open",
        classId: "open",
        subId: "",
        name: "Open Classes",
        so: "Af-Somali, Xisaab ama labadaba",
        subjects: CLASS_BY_ID.open.subjects,
      },
    ],
  },
  {
    key: "health",
    label: "Health Education",
    color: "#0d9488",
    list: CLASS_BY_ID.health.subs.map((s) => ({
      id: `health-${s.id}`,
      classId: "health",
      subId: s.id,
      name: groupLabel(CLASS_BY_ID.health, s),
      so: s.so,
      subjects: s.subjects,
    })),
  },
  ...ENGLISH_LEVELS.map((level) => ({
    key: level.id,
    label: `English ${level.name}`,
    color: level.id === "elementary" ? "#16a34a" : "#2563eb",
    list: ENGLISH_GROUPS.filter((g) => g.levelId === level.id).map((g) => ({
      id: g.id,
      classId: "english",
      subId: g.id,
      name: g.name,
      so: g.so,
      level: g.level,
      section: g.section,
      subjects: g.subjects,
    })),
  })),
];

export const CLASS_OPTIONS = CLASS_OPTION_GROUPS.flatMap((g) => g.list);

// ============================================================
// STUDENT PLACEMENT
// ============================================================
//
// Xogta ardayda Firestore siyaabo kala duwan ayay ugu kaydsan tahay
// (classGroups, className, classId, classLevel/classSection, magacyo
// hore sida "English Department – Elementary"). placementsOf() waxay
// u turjuntaa dhammaan qaababkaas → [{ classId, subId }].
//
// subId === null  → ardaygu fasalka wuu ku jiraa laakiin sub-ka (tusaale
//                   Class A/B/C/D) lama yaqaan → "Needs placement".
// ============================================================

const norm = (v) =>
  String(v || "")
    .toLowerCase()
    .replace(/[–—-]/g, " ")
    .replace(/[^a-z0-9& ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const LABEL_INDEX = new Map();
const ID_INDEX = new Map();

CLASSES.forEach((c) => {
  [c.name, ...(c.aliases || [])].forEach((n) =>
    LABEL_INDEX.set(norm(n), { classId: c.id, subId: null })
  );
  ID_INDEX.set(c.id, { classId: c.id, subId: null });
  (c.subs || []).forEach((s) => {
    const hit = { classId: c.id, subId: s.id };
    LABEL_INDEX.set(norm(groupLabel(c, s)), hit);
    [c.name, ...(c.aliases || [])].forEach((n) =>
      LABEL_INDEX.set(norm(`${n} ${s.name}`), hit)
    );
    ID_INDEX.set(s.id, hit);
    if (c.id !== "english" && c.id !== "preparation") ID_INDEX.set(`${c.id}-${s.id}`, hit);
  });
});
// Health sub-classes typed on their own.
LABEL_INDEX.set(norm("Basic Health Skills"), { classId: "health", subId: "basic-health" });
LABEL_INDEX.set(norm("First Aid"), { classId: "health", subId: "first-aid" });
ID_INDEX.set("health-basic-health", { classId: "health", subId: "basic-health" });
ID_INDEX.set("health-first-aid", { classId: "health", subId: "first-aid" });

function englishFrom(levelText, sectionText) {
  const lvl = norm(levelText);
  const level = ENGLISH_LEVELS.find((l) => lvl.includes(l.id));
  const section = String(sectionText || "").trim().toUpperCase();
  if (level && ENGLISH_SECTIONS.includes(section)) {
    return { classId: "english", subId: `english-${level.id}-${section.toLowerCase()}` };
  }
  return null;
}

function levelHint(text) {
  const n = norm(text);
  if (n.includes("intermediate")) return "intermediate";
  if (n.includes("elementary")) return "elementary";
  if (n.includes("classic")) return "classic";
  return "";
}

// One stored label → placement (or null if unknown).
export function resolveGroupLabel(label) {
  const n = norm(label);
  if (!n) return null;
  if (LABEL_INDEX.has(n)) return LABEL_INDEX.get(n);

  // English written in other orders: "Elementary A", "English Elementary – Class B",
  // "Class C Elementary", "Intermediate (D)".
  if (/elementary|intermediate/.test(n)) {
    const m =
      n.match(/\bclass ([abcd])\b/) ||
      n.match(/\b(?:elementary|intermediate) ([abcd])\b/) ||
      n.match(/\b([abcd]) (?:english|elementary|intermediate)\b/);
    const hit = m ? englishFrom(n, m[1]) : null;
    return hit || { classId: "english", subId: null, level: levelHint(n) };
  }

  // Old "Classic" level no longer exists → English, needs a new section.
  if (/classic/.test(n) || /^english/.test(n)) return { classId: "english", subId: null };

  return null;
}

function subjectsList(student) {
  if (Array.isArray(student?.subjects)) return student.subjects;
  if (student?.subjects) return [student.subjects];
  if (student?.subject) return [student.subject];
  return [];
}

export function placementsOf(student) {
  if (!student) return [];
  const out = [];
  const add = (p) => p && out.push(p);

  const labels = [
    ...(Array.isArray(student.classGroups) ? student.classGroups : []),
    student.classGroup,
    student.className,
    student.class,
    student.studentClass,
  ].filter(Boolean);
  labels.forEach((l) => add(resolveGroupLabel(l)));

  const cid = String(student.classId || "").trim();
  if (cid) add(ID_INDEX.get(cid) || ID_INDEX.get(cid.toLowerCase()) || null);

  if (student.classLevel || student.level) {
    add(englishFrom(student.classLevel || student.level, student.classSection || student.section));
  }

  // Si toos ah: Elementary aan section lahayn -> Elementary A,
  // Preparation aan section lahayn -> Preparation A.  (auto: true -> Firestore
  // waxaa lagu kaydiyaa bogga Classes marka la furo.)
  const hasElementaryHint =
    out.some((p) => p.classId === "english" && !p.subId && p.level === "elementary") ||
    levelHint(student.classLevel || student.level) === "elementary";
  out.forEach((p, i) => {
    if (p.subId) return;
    if (p.classId === "preparation") {
      out[i] = { classId: "preparation", subId: "prep-a", auto: true };
    } else if (p.classId === "english" && hasElementaryHint && p.level !== "intermediate" && p.level !== "classic") {
      out[i] = { classId: "english", subId: "english-elementary-a", auto: true };
    }
  });

  // Open Classes saved without a sub: use the ticked subjects.
  if (out.some((p) => p.classId === "open" && !p.subId)) {
    const subj = subjectsList(student).map(norm);
    if (subj.some((s) => s.includes("somali"))) add({ classId: "open", subId: "somali" });
    if (subj.some((s) => s.includes("xisaab") || s.includes("math"))) add({ classId: "open", subId: "xisaab" });
  }

  // De-duplicate, and drop "class without sub" when a real sub is known.
  const withRealSub = new Set(out.filter((p) => p.subId && !p.auto).map((p) => p.classId));
  const withSub = new Set(out.filter((p) => p.subId).map((p) => p.classId));
  const seen = new Set();
  return out.filter((p) => {
    if (!p.subId && withSub.has(p.classId)) return false;
    if (p.auto && withRealSub.has(p.classId)) return false;
    const key = `${p.classId}|${p.subId || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function studentInClass(student, classId) {
  return placementsOf(student).some((p) => p.classId === classId);
}

export function studentInSub(student, classId, subId) {
  return placementsOf(student).some((p) => p.classId === classId && p.subId === subId);
}

// In a class that has sub-classes, but which one is unknown.
export function studentNeedsSub(student, classId) {
  const cls = CLASS_BY_ID[classId];
  if (!cls?.subs) return false;
  const mine = placementsOf(student).filter((p) => p.classId === classId);
  return mine.length > 0 && mine.every((p) => !p.subId);
}

export function classOfStudent(student) {
  const p = placementsOf(student)[0];
  return p ? CLASS_BY_ID[p.classId] || null : null;
}

// Firestore fields that put a student in a class (used by Add Student
// and by "Move" on the Classes page). subIds: array (Open Classes may
// have two).
export function placementFields(classId, subIds = [], subjects) {
  const cls = CLASS_BY_ID[classId];
  if (!cls) return null;
  const subs = (cls.subs || []).filter((s) => subIds.includes(s.id));
  const groups = subs.length ? subs.map((s) => groupLabel(cls, s)) : [cls.name];
  const first = subs[0];
  const isEnglish = cls.id === "english" && first;
  const isPrep = cls.id === "preparation" && first;

  const className = cls.id === "open" ? cls.name : groups[0];
  const classSubjects =
    subjects ||
    [...new Set(subs.length ? subs.flatMap((s) => s.subjects || []) : cls.subjects || [])];

  return {
    classId:
      isEnglish || isPrep ? first.id : first && cls.id === "health" ? `health-${first.id}` : cls.id,
    className,
    classGroup: groups[0],
    classGroups: groups,
    classLevel: isEnglish ? first.level : "",
    classSection: isEnglish || isPrep ? first.section : "",
    subClasses: subs.map((s) => s.name),
    subjects: classSubjects,
  };
}

// ============================================================
// STUDENT / TEACHER GROUP HELPERS (kept for older code)
// ============================================================

export function studentGroups(student) {
  if (Array.isArray(student?.classGroups) && student.classGroups.length) {
    return student.classGroups;
  }
  if (student?.classGroup) return [student.classGroup];
  if (student?.className) return [student.className];
  if (student?.class) return [student.class];
  if (student?.studentClass) return [student.studentClass];
  return [];
}

export function studentBelongsToGroup(student, targetGroup) {
  const target = resolveGroupLabel(targetGroup);
  if (!target) return false;
  return placementsOf(student).some(
    (p) => p.classId === target.classId && (!target.subId || p.subId === target.subId)
  );
}

export function teacherGroups(teacher) {
  if (Array.isArray(teacher?.classGroups) && teacher.classGroups.length) {
    return teacher.classGroups;
  }
  if (teacher?.classGroup) return [teacher.classGroup];
  if (teacher?.className) return [teacher.className];
  if (teacher?.class) return [teacher.class];
  return [];
}

export function teacherHasStudentGroup(teacher, student) {
  return teacherGroups(teacher).some((g) => studentBelongsToGroup(student, g));
}

export function isEnglishGroup(value) {
  return resolveGroupLabel(value)?.classId === "english";
}

export function getEnglishLevel(value) {
  const n = norm(value);
  return ENGLISH_LEVELS.find((l) => n.includes(l.id))?.id || "";
}

export function getEnglishSection(value) {
  const m = String(value || "").trim().match(/^Class\s+([A-D])/i);
  return m ? m[1].toUpperCase() : "";
}

// ============================================================
// LEGACY: flat class list (older code used Firestore rssSchoolClasses).
// The class list is now fixed to the paper, so this just returns it.
// ============================================================

export function sortClasses(classes = []) {
  const order = new Map(CLASS_OPTIONS.map((o, i) => [o.id, i]));
  return [...classes]
    .filter(Boolean)
    .sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
}

export function subscribeSchoolClasses(onData) {
  onData?.(CLASS_OPTIONS);
  return () => {};
}

// Kept so old imports don't break.
export const SCHOOL_CLASSES_COLLECTION = "rssSchoolClasses";
export const DEFAULT_SCHOOL_CLASSES = CLASS_OPTIONS;