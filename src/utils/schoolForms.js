// src/utils/schoolForms.js
//
// Hal meel oo ay wadaagaan AddStudent, AddTeacher, TeacherForm iyo StudentList,
// si ay foomamku isku qaab u diiwaangeliyaan:
//   • Fasallada (1–8, F1–F4), maadooyinka, shift-ka iyo maalmaha — dropdown
//   • Macallin: fasallo badan (class block kasta = fasal + maado + maalmo + xiisado)
//   • buildTeacherSchedule() wuxuu u beddelaa qaabka attendance.js iyo
//     teacherClasses.js akhriyaan (daySchedules, attendanceDays,
//     classSubjectAssignments …) si xaadirintu waqtigeeda saxda ah u qaadato.

export const CLASS_OPTIONS = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];

// Wax ka beddel liiskan haddii dugsigu maadooyin kale leeyahay.
export const SUBJECT_LIST = [
  "Somali",
  "English",
  "Arabic",
  "Mathematics",
  "Science",
  "Biology",
  "Chemistry",
  "Physics",
  "Islamic Studies",
  "Quran",
  "Social Studies",
  "History",
  "Geography",
  "ICT",
  "Business",
];

export const SHIFT_OPTIONS = ["Morning", "Afternoon"];
export const STUDENT_TYPES = ["Full Time", "Part Time"];
export const EMPLOYMENT_TYPES = ["Full Time", "Part Time"];

export const FULL_TIME_DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"];
export const PART_TIME_DAYS = ["Thursday", "Friday"];
export const WEEK_DAYS = [...FULL_TIME_DAYS, ...PART_TIME_DAYS];

// ------------------------------------------------------------------
// Fasallada: "Class 1", "1", "Form 1", "f1" -> isku mid
// ------------------------------------------------------------------
export function normClass(value) {
  const s = String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  if (!s) return "";
  let m = s.match(/^(?:FORM|F)\s*-?\s*(\d)$/);
  if (m) return `F${m[1]}`;
  m = s.match(/^(?:CLASS|FASALKA|FASAL|GRADE)?\s*-?\s*(\d{1,2})$/);
  if (m) return String(Number(m[1]));
  return s;
}

export function sameClass(a, b) {
  const x = normClass(a);
  return !!x && x === normClass(b);
}

export function classLabel(value) {
  const n = normClass(value);
  if (/^\d+$/.test(n)) return `Class ${n}`;
  if (/^F\d$/.test(n)) return `Form ${n.slice(1)} (${n})`;
  return String(value || "");
}

// Fasalka ardayga (qaabka AddStudent: className; qaababkii hore sidoo kale)
export function studentClassName(student) {
  return (
    student?.className ||
    student?.class ||
    student?.studentClass ||
    (Array.isArray(student?.classGroups) && student.classGroups[0]) ||
    ""
  );
}

// ------------------------------------------------------------------
// Maalmaha
// ------------------------------------------------------------------
export function allowedDays(employmentTypes = []) {
  const ft = employmentTypes.includes("Full Time");
  const pt = employmentTypes.includes("Part Time");
  if (ft && pt) return WEEK_DAYS;
  if (pt) return PART_TIME_DAYS;
  return FULL_TIME_DAYS;
}

export const sortDays = (days = []) => WEEK_DAYS.filter((d) => days.includes(d));

// ------------------------------------------------------------------
// Class blocks
// ------------------------------------------------------------------
export const emptySession = (label = "") => ({ startTime: "", endTime: "", label });

export const emptyClassBlock = () => ({
  className: "",
  subject: "",
  shift: "",
  days: [],
  daySessions: {},
});

export function cloneBlock(b) {
  const days = sortDays(Array.isArray(b?.days) ? b.days : []);
  const daySessions = {};
  days.forEach((d) => {
    daySessions[d] = (b?.daySessions?.[d] || []).map((s) => ({
      startTime: s.startTime || "",
      endTime: s.endTime || "",
      label: s.label || "",
    }));
  });
  return {
    className: b?.className || "",
    subject: b?.subject || "",
    shift: b?.shift || "",
    days,
    daySessions,
  };
}

// "Xiisadda #N" — wuxuu ka sii wadaa lambarka ugu sarreeya ee maalintaas.
export function nextSessionLabel(existing = []) {
  let max = 0;
  existing.forEach((s) => {
    const m = String(s.label || "").match(/(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  if (max === 0) max = existing.length;
  return `Xiisadda #${max + 1}`;
}

// Marka nooca shaqada la beddelo: ka saar maalmaha aan hadda la oggolayn.
export function filterBlocksToDays(blocks, allowed) {
  return blocks.map((b) => {
    const days = b.days.filter((d) => allowed.includes(d));
    const daySessions = {};
    days.forEach((d) => (daySessions[d] = b.daySessions[d] || []));
    return { ...b, days, daySessions };
  });
}

export function formatTime12(hhmm) {
  if (!hhmm) return "";
  const [h, m] = String(hhmm).split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const rangeText = (s) => `${formatTime12(s.startTime)} – ${formatTime12(s.endTime)}`;

const blockHasData = (b) => !!(b.className || b.subject || b.days?.length);

// Khalad (qoraal) ama "" haddii wax walba sax yihiin.
// Waxaa la hubiyaa:
//   • fasal + maado + ugu yaraan hal maalin block kasta
//   • xiisad kasta start/end sax ah
//   • macallinku hal waqti laba fasal (ama laba xiisad) ma yeelan karo
export function validateClassBlocks(blocks = []) {
  const indexed = blocks.map((b, i) => ({ b, i })).filter(({ b }) => blockHasData(b));
  if (!indexed.length) return "Ku dar ugu yaraan hal fasal oo macallinku xaadirinayo.";

  const seen = new Set();
  const byDay = {};

  for (const { b, i } of indexed) {
    const tag = `Fasalka #${i + 1} (${b.className ? classLabel(b.className) : "fasal aan la dooran"}${
      b.subject ? ` - ${b.subject}` : ""
    })`;
    if (!b.className) return `${tag}: fadlan dooro fasalka.`;
    if (!b.subject) return `${tag}: fadlan dooro maadada.`;

    const key = `${normClass(b.className)}|${b.subject.toLowerCase()}`;
    if (seen.has(key)) return `${tag}: fasalkan iyo maadadan horey ayaa loo qoray — isku block ku dar xiisadaha.`;
    seen.add(key);

    if (!b.days.length) return `${tag}: dooro ugu yaraan hal maalin.`;

    for (const day of sortDays(b.days)) {
      const sessions = b.daySessions[day] || [];
      if (!sessions.length) return `${tag}: ${day} — ku dar ugu yaraan hal xiisad.`;
      for (const s of sessions) {
        const lbl = s.label ? ` (${s.label})` : "";
        if (!s.startTime || !s.endTime) return `${tag}: ${day}${lbl} — buuxi waqtiga bilowga iyo dhammaadka.`;
        if (s.startTime >= s.endTime) return `${tag}: ${day}${lbl} — waqtiga dhammaadku waa inuu ka dambeeyaa bilowga.`;
        for (const o of byDay[day] || []) {
          if (s.startTime < o.endTime && o.startTime < s.endTime) {
            return `${tag}: ${day} ${rangeText(s)} waxay ku dhacaysaa ${o.tag} (${rangeText(o)}) — macallinku hal waqti laba meel ma joogi karo.`;
          }
        }
        (byDay[day] = byDay[day] || []).push({ ...s, tag });
      }
    }
  }
  return "";
}

// Class blocks -> xogta Firestore ee attendance.js / teacherClasses.js akhriyaan.
export function buildTeacherSchedule(blocks = []) {
  const classes = blocks.filter(blockHasData).map((b) => {
    const c = cloneBlock(b);
    c.subject = c.subject.trim();
    c.days.forEach((d) => {
      c.daySessions[d].sort((x, y) => x.startTime.localeCompare(y.startTime));
    });
    return c;
  });

  // Fasal kasta maadooyinkiisa (laba block oo isku fasal ah waa la isku daraa)
  const assignMap = new Map();
  classes.forEach((c) => {
    const k = normClass(c.className);
    if (!assignMap.has(k)) assignMap.set(k, { className: c.className, subjects: [] });
    const a = assignMap.get(k);
    if (c.subject && !a.subjects.includes(c.subject)) a.subjects.push(c.subject);
  });
  const classSubjectAssignments = [...assignMap.values()];

  // Maalin kasta: dhammaan xiisadaha fasallada oo dhan, waqti ahaan loo kala horreysiiyay.
  // Xiisad kasta waxay sidataa className + subject si portal-ku u ogaado fasalka xiisadda.
  const daySchedules = {};
  WEEK_DAYS.forEach((day) => {
    const periods = classes
      .flatMap((c) =>
        (c.daySessions[day] || []).map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          label: s.label || "",
          className: c.className,
          subject: c.subject,
          shift: c.shift || "",
        }))
      )
      .sort((x, y) => x.startTime.localeCompare(y.startTime));
    if (periods.length) {
      daySchedules[day] = {
        periods,
        startTime: periods[0].startTime,
        endTime: periods[periods.length - 1].endTime,
      };
    }
  });

  const attendanceDays = Object.keys(daySchedules);
  const first = daySchedules[attendanceDays[0]]?.periods[0] || { startTime: "", endTime: "" };
  const subjects = [...new Set(classes.map((c) => c.subject).filter(Boolean))];
  const classNames = classSubjectAssignments.map((a) => a.className);

  return {
    classes,
    classSubjectAssignments,
    classAssignments: classSubjectAssignments,
    classGroups: classNames,
    classNames,
    className: classNames[0] || "",
    subjects,
    subject: subjects[0] || "",
    shifts: [...new Set(classes.map((c) => c.shift).filter(Boolean))],
    daySchedules,
    attendanceDays,
    attendanceDay: attendanceDays[0] || "",
    startTime: first.startTime,
    endTime: first.endTime,
  };
}

// Macallin jira -> class blocks (Edit). Wuxuu taageeraa qaabka cusub (classes)
// iyo kii hore (classSubjectAssignments + daySchedules).
export function blocksFromTeacher(teacher, assignments = []) {
  if (!teacher) return [emptyClassBlock()];

  if (Array.isArray(teacher.classes) && teacher.classes.some((c) => c && c.daySessions)) {
    const blocks = teacher.classes.map(cloneBlock);
    return blocks.length ? blocks : [emptyClassBlock()];
  }

  const blocks = [];
  assignments.forEach((a) => {
    const subs = a.subjects?.length ? a.subjects : [""];
    subs.forEach((subject) => blocks.push({ ...emptyClassBlock(), className: a.className, subject }));
  });
  if (!blocks.length) return [emptyClassBlock()];

  const ds = teacher.daySchedules && typeof teacher.daySchedules === "object" ? teacher.daySchedules : null;
  const dayList = ds
    ? Object.keys(ds)
    : Array.isArray(teacher.attendanceDays) && teacher.attendanceDays.length
    ? teacher.attendanceDays
    : teacher.attendanceDay
    ? [teacher.attendanceDay]
    : [];

  dayList.forEach((rawDay) => {
    const day = WEEK_DAYS.find((d) => d.toLowerCase() === String(rawDay).toLowerCase());
    if (!day) return;
    const entry = ds ? ds[rawDay] : { startTime: teacher.startTime, endTime: teacher.endTime };
    const periods = Array.isArray(entry?.periods) && entry.periods.length ? entry.periods : [entry];
    periods
      .filter((p) => p && p.startTime && p.endTime)
      .forEach((p) => {
        // Xiisadihii hore className ma lahayn -> block-ga koowaad ayay u tagaan.
        const target =
          (p.className &&
            blocks.find((b) => sameClass(b.className, p.className) && (!p.subject || b.subject === p.subject))) ||
          blocks[0];
        if (!target.days.includes(day)) target.days.push(day);
        (target.daySessions[day] = target.daySessions[day] || []).push({
          startTime: p.startTime,
          endTime: p.endTime,
          label: p.label || "",
        });
      });
  });

  return blocks.map(cloneBlock);
}