// ============================================================
// RISING STAR SCHOOL SYSTEM — classes, subjects & shared options
// ============================================================
//
// Fasallada waa SIDA WARQADDA ku qoran — magacyadooda iyo kuwan oo keliya:
//
//   0. Fasalka 8aad               — Somali · Xisaab · English · Arabic · Saynis · …
//   1. Fasalada Diyaarinta        — B Duhurley · T Galabley · J Habeenley
//   2. Fasalo Xisaab iyo English  — B Duhurley · T Galabley · J Habeenley
//   3. Scientific Class           — Biology · Chemistry · Maths · Physics
//   4. Computer Class
//   5. English Classes            — A · B · C · D · E, mid kastana:
//                                   Elementary · Intermediate · Advance · Classic
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

// Jinsiga ardayga
export const GENDERS = [
  { value: "Male", label: "Male", so: "Wiil" },
  { value: "Female", label: "Female", so: "Gabar" },
];

export function genderOf(student) {
  const g = String(student?.gender || "").trim().toLowerCase();
  if (["male", "m", "wiil", "boy"].includes(g)) return "Male";
  if (["female", "f", "gabar", "girl"].includes(g)) return "Female";
  return "";
}

// "Free" → ardaygu lacag ma bixiyo; Cashier-ka marnaba kama muuqdo.
export const FEE_TYPES = ["Monthly", "Term", "Full Course", "Scholarship", "Free"];

// Ardayga fee type-kiisu yahay Free (Bilaash) — Cashier-ka lagama arko,
// lacagna lagama qaadi karo.
export function isFreeStudent(student) {
  const t = String(student?.feeType || "").trim().toLowerCase();
  return t === "free" || t === "bilaash";
}

// Ardayda Cashier-ku arko: kuwa lacag bille ah laga rabo oo keliya.
export function isFeePayingStudent(student) {
  return !!student && !isFreeStudent(student) && Number(student.monthlyFee) > 0;
}

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
// SUBJECTS
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

const MATH_ENGLISH_SUBJECTS = ["Xisaab", "English"];

const SCIENTIFIC_SUBJECTS = ["Biology", "Chemistry", "Maths", "Physics"];

const COMPUTER_SUBJECTS = [
  "Windows & Basics",
  "Microsoft Word",
  "Microsoft PowerPoint",
  "Microsoft Excel",
  "Typing Skills",
];

// ============================================================
// B · T · J  (Duhurley · Galabley · Habeenley)
// ============================================================

export const TIME_SECTIONS = [
  { letter: "B", time: "Duhurley", en: "Noon" },
  { letter: "T", time: "Galabley", en: "Afternoon" },
  { letter: "J", time: "Habeenley", en: "Evening" },
];

function timeSubs(prefix, subjects) {
  return TIME_SECTIONS.map((t) => ({
    id: `${prefix}-${t.letter.toLowerCase()}`,
    name: `${t.letter} ${t.time}`,
    so: `Class ${t.letter} — ${t.time}`,
    section: t.letter,
    time: t.time,
    subjects,
  }));
}

export const PREPARATION_SECTIONS = timeSubs("prep", SCHOOL_SUBJECTS);
export const MATH_ENGLISH_SECTIONS = timeSubs("xe", MATH_ENGLISH_SUBJECTS);

// ============================================================
// ENGLISH CLASSES — Class A–E, mid kastana 4 level
// ============================================================

export const ENGLISH_SECTIONS = ["A", "B", "C", "D", "E"];

export const ENGLISH_LEVELS = [
  { id: "elementary", name: "Elementary", color: "green" },
  { id: "intermediate", name: "Intermediate", color: "blue" },
  { id: "advance", name: "Advance", color: "violet" },
  { id: "classic", name: "Classic", color: "amber" },
];

// id-ga: english-{level}-{section} (isla qaabkii hore → ardayda hore way shaqeeyaan)
// Magaca: "English A – Elementary" (sida warqadda: English classes → A → Elementary)
export const ENGLISH_GROUPS = ENGLISH_SECTIONS.flatMap((section) =>
  ENGLISH_LEVELS.map((level) => ({
    id: `english-${level.id}-${section.toLowerCase()}`,
    name: `English ${section} – ${level.name}`,
    short: `${section} ${level.name}`,
    so: `${section} — ${level.name}`,
    level: level.name,
    levelId: level.id,
    section,
    color: level.color,
    subjects: ["English"],
  }))
);

export function englishGroupOf(section, levelId) {
  return (
    ENGLISH_GROUPS.find((g) => g.section === section && g.levelId === levelId) || null
  );
}

// ============================================================
// SCHOOL CLASSES (5 kaliya)
// ============================================================
//
// subs     → fasallada hoose (sub-classes). Arday kasta wuxuu galaa mid.
// aliases  → magacyo hore oo xogta Firestore ku jira (si ardayda hore
//            loo helo).
// ============================================================

export const CLASSES = [
  {
    // id "class8" = isla kii hore → ardaydii Class 8 si toos ah ayay ugu soo laabanayaan
    id: "class8",
    name: "Fasalka 8aad",
    so: "Class 8",
    color: "amber",
    subjects: SCHOOL_SUBJECTS,
    aliases: ["Class 8", "8A Class", "8A", "Class 8A", "Fasalka 8", "Class Eight", "Grade 8"],
  },
  {
    id: "preparation",
    name: "Fasalada Diyaarinta",
    so: "Preparation",
    color: "green",
    subjects: SCHOOL_SUBJECTS,
    aliases: ["Preparation", "Preparation Class", "Diyaarin", "Diyaarinta", "Fasalka Diyaarinta"],
    // Maadooyin lama doorto — ardaygu fasalka oo dhan ayuu qaataa
    noSubjectPick: true,
    sectioned: true,
    subs: PREPARATION_SECTIONS,
  },
  {
    id: "xisaab-english",
    name: "Fasalo Xisaab iyo English",
    so: "Math & English",
    color: "red",
    subjects: MATH_ENGLISH_SUBJECTS,
    aliases: ["Xisaab iyo English", "Fasalada Xisaab iyo English", "Math and English", "Xisaab & English"],
    sectioned: true,
    subs: MATH_ENGLISH_SECTIONS,
  },
  {
    // id "f4" = isla kii hore → ardaydii Scientific si toos ah ayay ugu soo laabanayaan
    id: "f4",
    name: "Scientific Class",
    so: "Fasalka Sayniska",
    color: "amber",
    subjects: SCIENTIFIC_SUBJECTS,
    aliases: ["Scientific", "Scientific F4", "F4", "Fasalka Sayniska", "Science Class"],
  },
  {
    id: "computer",
    name: "Computer Class",
    so: "Fasalka Kombiyuutarka",
    color: "violet",
    subjects: COMPUTER_SUBJECTS,
    aliases: ["Computer", "Fasalka Kombiyuutarka"],
    noSubjectPick: true,
  },
  {
    id: "english",
    name: "English Classes",
    so: "Fasallada Ingiriisiga",
    color: "blue",
    subjects: ["English"],
    aliases: ["English", "English Department", "English Class"],
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

// "Fasalada Diyaarinta – B Duhurley", "Fasalo Xisaab iyo English – T Galabley",
// English: "English A – Elementary".
export function groupLabel(cls, sub) {
  if (!cls) return "";
  if (!sub) return cls.name;
  if (cls.id === "english") return sub.name;
  return `${cls.name} – ${sub.name}`;
}

// Every group a teacher can be assigned to / a student can be placed in.
export const CLASS_GROUPS = CLASSES.flatMap((c) =>
  c.subs ? c.subs.map((s) => groupLabel(c, s)) : [c.name]
);

// Same list, grouped (for <optgroup> in the teacher form).
export const CLASS_GROUP_SECTIONS = CLASSES.map((c) => ({
  id: c.id,
  label: c.so && c.so !== c.name ? `${c.name} (${c.so})` : c.name,
  groups: c.subs ? c.subs.map((s) => groupLabel(c, s)) : [c.name],
}));

export function subjectsFor(classId, subId) {
  const cls = CLASS_BY_ID[classId];
  if (!cls) return [];
  const sub = cls.subs?.find((s) => s.id === subId);
  if (sub?.subjects) return sub.subjects;
  return cls.subjects || [];
}

// ============================================================
// OPTIONS FOR "ADD STUDENT"
// ============================================================
//
// Hal option = hal fasal oo dhab ah (leaf). Foomka ardaygu wuxuu
// muujiyaa: 1) fasalka (5-ta) → 2) Class-ka (A–E ama B/T/J) →
// 3) English: level-ka (select).

const leaf = (cls, sub) => ({
  id: sub ? sub.id : cls.id,
  classId: cls.id,
  subId: sub ? sub.id : "",
  name: groupLabel(cls, sub),
  so: sub ? sub.so : cls.so,
  section: sub?.section || "",
  level: sub?.level || "",
  levelId: sub?.levelId || "",
  time: sub?.time || "",
  subjects: sub?.subjects || cls.subjects || [],
});

export const CLASS_OPTION_GROUPS = CLASSES.map((c) => ({
  key: c.id,
  label: c.name,
  so: c.so,
  color: c.color,
  list: c.subs ? c.subs.map((s) => leaf(c, s)) : [leaf(c, null)],
}));

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
  });
});

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
  if (n.includes("advance")) return "advance";
  if (n.includes("classic")) return "classic";
  return "";
}

// One stored label → placement (or null if unknown).
export function resolveGroupLabel(label) {
  const n = norm(label);
  if (!n) return null;
  if (LABEL_INDEX.has(n)) return LABEL_INDEX.get(n);

  // Preparation hore (A–D) → Fasalada Diyaarinta, B/T/J lama yaqaan.
  if (/^(preparation|diyaarin|fasal\w* diyaarin)/.test(n)) return { classId: "preparation", subId: null };
  if (/^(fasal\w* )?xisaab iyo english/.test(n)) return { classId: "xisaab-english", subId: null };

  // English written in other orders: "Elementary A", "English Elementary – Class B",
  // "Class C Advance", "Intermediate (D)".
  if (/elementary|intermediate|advance|classic/.test(n)) {
    const m =
      n.match(/\bclass ([a-e])\b/) ||
      n.match(/\b(?:elementary|intermediate|advanced?|classic) ([a-e])\b/) ||
      n.match(/\b([a-e]) (?:english|elementary|intermediate|advanced?|classic)\b/);
    const hit = m ? englishFrom(n, m[1]) : null;
    return hit || { classId: "english", subId: null, level: levelHint(n) };
  }

  if (/^english/.test(n)) return { classId: "english", subId: null };

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

  // Si toos ah: English Elementary aan Class lahayn -> Class A English Elementary.
  // (auto: true -> Firestore waxaa lagu kaydiyaa bogga Classes marka la furo.)
  // Preparation / Xisaab iyo English: B/T/J si toos ah looma doorto — admin-ka
  // ayaa dooranaya ("Need placement").
  const hasElementaryHint =
    out.some((p) => p.classId === "english" && !p.subId && p.level === "elementary") ||
    levelHint(student.classLevel || student.level) === "elementary";
  out.forEach((p, i) => {
    if (p.subId) return;
    if (p.classId === "english" && hasElementaryHint && (!p.level || p.level === "elementary")) {
      out[i] = { classId: "english", subId: "english-elementary-a", auto: true };
    }
  });

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

  const className = groups[0];
  const classSubjects =
    subjects ||
    [...new Set(subs.length ? subs.flatMap((s) => s.subjects || []) : cls.subjects || [])];

  return {
    classId: first ? first.id : cls.id,
    className,
    classGroup: groups[0],
    classGroups: groups,
    classLevel: isEnglish ? first.level : "",
    classSection: first?.section || "",
    subClasses: subs.map((s) => s.name),
    subjects: classSubjects,
  };
}

// ============================================================
// ENROLLMENTS — hal arday (hal ID + hal password) oo fasallo badan ku jira
// ============================================================
//
// student.enrollments = [{ classId, subIds: [], groups: [], subjects: [] }]
// Fasal kasta maadooyinkiisa gooni ayuu u leeyahay, sidaas darteed
// macallinka Class 8 English ma arko ardayga English-ka ka qaata
// English Department oo keliya.
// Ardayda hore (enrollments ma leh) waxaa laga dhisaa placementsOf().

const uniq = (list) => [...new Set(list.filter(Boolean))];

export function makeEnrollment(classId, subIds = [], subjects) {
  // Fasallada aan maado laga dooran (Diyaarinta, Computer) → maadooyinka oo dhan
  if (CLASS_BY_ID[classId]?.noSubjectPick) subjects = undefined;
  const f = placementFields(classId, subIds, subjects);
  if (!f) return null;
  return { classId, subIds: [...subIds], groups: f.classGroups, subjects: f.subjects };
}

export function enrollmentsOf(student) {
  if (!student) return [];
  if (Array.isArray(student.enrollments) && student.enrollments.length) {
    return student.enrollments
      .filter((e) => e && CLASS_BY_ID[e.classId])
      .map((e) => ({
        classId: e.classId,
        // sub-yada hore ee aan hadda jirin (tusaale Preparation A) waa la iska dhaafaa
        subIds: (Array.isArray(e.subIds) ? e.subIds : []).filter((id) =>
          (CLASS_BY_ID[e.classId].subs || []).some((s) => s.id === id)
        ),
        groups: Array.isArray(e.groups) ? e.groups : [],
        subjects: Array.isArray(e.subjects) ? e.subjects : [],
      }));
  }
  const byClass = new Map();
  placementsOf(student).forEach((p) => {
    if (!byClass.has(p.classId)) byClass.set(p.classId, []);
    if (p.subId) byClass.get(p.classId).push(p.subId);
  });
  const mine = subjectsList(student);
  return [...byClass].map(([classId, subIds]) => {
    const e = makeEnrollment(classId, subIds);
    const keep = mine.filter((x) => e.subjects.includes(x));
    return { ...e, subjects: keep.length ? keep : e.subjects };
  });
}

// enrollments -> Firestore fields (classGroups = fasallada oo dhan;
// classId/className = fasalka koowaad si code-kii hore u shaqeeyo).
export function enrollmentFields(enrollments) {
  const list = (enrollments || []).filter(Boolean);
  if (!list.length) return null;
  const first = list[0];
  const base = placementFields(first.classId, first.subIds, first.subjects);
  const eng = list.find((e) => e.classId === "english" && e.subIds.length);
  const engSub = eng ? CLASS_BY_ID.english.subs.find((s) => s.id === eng.subIds[0]) : null;
  const subNames = list.flatMap((e) =>
    (CLASS_BY_ID[e.classId]?.subs || []).filter((s) => e.subIds.includes(s.id)).map((s) => s.name)
  );
  return {
    ...base,
    classGroups: uniq(list.flatMap((e) => e.groups)),
    // classLevel + classSection waa in ay isla fasal English ah ka yimaadaan
    classLevel: engSub ? engSub.level : "",
    classSection: engSub ? engSub.section : base.classLevel ? "" : base.classSection,
    subClasses: uniq(subNames),
    subjects: uniq(list.flatMap((e) => e.subjects)),
    enrollments: list.map((e) => ({
      classId: e.classId,
      subIds: e.subIds,
      groups: e.groups,
      subjects: e.subjects,
    })),
  };
}

// Maadooyinka ardaygu ka qaato fasal gaar ah (macallinka iyo imtixaanka).
export function studentSubjectsIn(student, groupName) {
  const target = resolveGroupLabel(groupName);
  if (target && Array.isArray(student?.enrollments) && student.enrollments.length) {
    const hit = student.enrollments.find(
      (e) =>
        e?.classId === target.classId &&
        (!target.subId || (Array.isArray(e.subIds) && e.subIds.includes(target.subId)))
    );
    if (hit) return Array.isArray(hit.subjects) ? hit.subjects : [];
  }
  return subjectsList(student);
}

// ============================================================
// STUDENT / TEACHER GROUP HELPERS (kept for older code)
// ============================================================

// Fasallada ardayga — MAGACYADA CUSUB oo keliya. Fasal hore oo aan jirin
// (Health…) marnaba lama soo celiyo.
export function studentGroups(student) {
  return [
    ...new Set(
      placementsOf(student).map((p) => {
        const cls = CLASS_BY_ID[p.classId];
        return groupLabel(cls, cls?.subs?.find((s) => s.id === p.subId));
      })
    ),
  ].filter(Boolean);
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
  const m = String(value || "").trim().match(/^(?:Class|English)\s+([A-E])\b/i);
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
// ============================================================
// MIGRATION — fasallada hore → fasallada warqadda
// ============================================================
//
// migrateStudent(student) → { enrollments, unresolved: [label], changed }
//  • Computer / English (hore) → isla fasalka, magac cusub
//  • Class 8 → Fasalka 8aad
//  • Preparation (A–D hore) → Fasalada Diyaarinta, B/T/J waxaa go'aamiya
//    shift-ka ardayga: Morning → B Duhurley, Afternoon → T Galabley,
//    Evening → J Habeenley
//  • Open Classes (Af-Somali / Xisaab) → Fasalo Xisaab iyo English (shift)
//  • English aan Class (A–E) lahayn → English A, level-kiisa (default Elementary)
//  • Health Education iyo wixii kale → unresolved (admin-ka ayaa dooranaya)

const SHIFT_TO_SECTION = { morning: "B", afternoon: "T", evening: "J" };

export function sectionForShift(shift) {
  return SHIFT_TO_SECTION[norm(shift)] || "B";
}

function subForSection(classId, section) {
  return CLASS_BY_ID[classId]?.subs?.find((s) => s.section === section)?.id || null;
}

// Hal label / enrollment hore → { classId, subId } fasal cusub, ama null
export function migrateTarget(label, { shift, level, section, classId: rawClassId } = {}) {
  const n = norm(label);
  const rid = String(rawClassId || "").toLowerCase();
  let r = resolveGroupLabel(label);

  if (!r && (rid === "open" || /^open|somali|xisaab|math/.test(n))) {
    r = { classId: "xisaab-english", subId: null };
  }
  if (!r && CLASS_BY_ID[rid]) r = { classId: rid, subId: null };
  if (!r) return null;

  const cls = CLASS_BY_ID[r.classId];
  if (!cls) return null;
  if (!cls.subs) return { classId: cls.id, subId: "" };
  if (r.subId && cls.subs.some((s) => s.id === r.subId)) return { classId: cls.id, subId: r.subId };

  if (cls.id === "english") {
    const lvl = r.level || levelHint(level) || levelHint(label) || "elementary";
    const sec = String(section || "").trim().toUpperCase();
    const letter = ENGLISH_SECTIONS.includes(sec) ? sec.toLowerCase() : "a";
    return { classId: "english", subId: `english-${lvl}-${letter}` };
  }
  return { classId: cls.id, subId: subForSection(cls.id, sectionForShift(shift)) };
}

const leafLabel = (classId, subId) => {
  const cls = CLASS_BY_ID[classId];
  const sub = cls?.subs?.find((s) => s.id === subId);
  return groupLabel(cls, sub);
};

// Fasal kasta oo ardaygu ku jiro (qaab kasta oo hore) → liis label
function rawSources(student) {
  if (Array.isArray(student?.enrollments) && student.enrollments.length) {
    return student.enrollments.filter(Boolean).map((e) => ({
      labels: Array.isArray(e.groups) && e.groups.length ? e.groups : [e.classId],
      classId: e.classId,
      subIds: Array.isArray(e.subIds) ? e.subIds : [],
      subjects: Array.isArray(e.subjects) ? e.subjects : [],
    }));
  }
  const labels = [
    ...(Array.isArray(student?.classGroups) ? student.classGroups : []),
    student?.classGroup,
    student?.className,
    student?.class,
    student?.studentClass,
  ].filter(Boolean);
  const uniqLabels = [...new Set(labels.map(String))];
  const list = uniqLabels.map((l) => ({ labels: [l], classId: "", subIds: [], subjects: subjectsList(student) }));
  if (!list.length && student?.classId) {
    list.push({ labels: [student.classId], classId: student.classId, subIds: [], subjects: subjectsList(student) });
  }
  return list;
}

// overrides = { [oldLabel]: optionId | "" }  ("" → ka saar)
export function migrateStudent(student, overrides = {}) {
  const out = [];
  const unresolved = [];
  const seen = new Set();
  const addLeaf = (classId, subId, subjects) => {
    const key = `${classId}|${subId || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    const allowed = subjectsFor(classId, subId);
    const keep = (subjects || []).filter((x) => allowed.includes(x));
    out.push(makeEnrollment(classId, subId ? [subId] : [], keep.length ? keep : [...allowed]));
  };

  rawSources(student).forEach((src) => {
    // English/Preparation enrollment hore oo leh subIds sax ah
    const label = src.labels[0];
    if (Object.prototype.hasOwnProperty.call(overrides, label)) {
      const opt = CLASS_OPTIONS.find((o) => o.id === overrides[label]);
      if (opt) addLeaf(opt.classId, opt.subId, src.subjects);
      return;
    }
    const validSub =
      CLASS_BY_ID[src.classId]?.subs && src.subIds.find((id) => CLASS_BY_ID[src.classId].subs.some((s) => s.id === id));
    const t = validSub
      ? { classId: src.classId, subId: validSub }
      : migrateTarget(label, {
          shift: student.shift,
          level: student.classLevel || student.level,
          section: student.classSection || student.section,
          classId: src.classId,
        });
    if (!t) {
      unresolved.push(label);
      return;
    }
    addLeaf(t.classId, t.subId, src.subjects);
  });

  const fields = out.length ? enrollmentFields(out) : null;
  const before = JSON.stringify([...(student?.classGroups || [])].sort());
  const after = JSON.stringify([...(fields?.classGroups || [])].sort());
  const hasLegacy = !!(student?.class || student?.studentClass);
  const changed =
    unresolved.length > 0 ||
    before !== after ||
    hasLegacy ||
    !Array.isArray(student?.enrollments) ||
    JSON.stringify(student.enrollments) !== JSON.stringify(fields?.enrollments || []);
  return { enrollments: out, fields, unresolved, changed };
}

// Macallinka class-kiisa hore → magaca cusub (ama null haddii fasalkii la tirtiray)
export function migrateClassName(className, shift) {
  if (CLASS_GROUPS.includes(className)) return className;
  const t = migrateTarget(className, { shift });
  return t ? leafLabel(t.classId, t.subId) : null;
}

export const OPTION_LABEL = Object.fromEntries(CLASS_OPTIONS.map((o) => [o.id, o.name]));

// Magaca fasalka eee la muujinayo: magaca cusub, ama "" haddii fasalkaas uusan jirin.
export function canonicalClassName(label, shift) {
  if (!label) return "";
  return migrateClassName(String(label), shift) || "";
}