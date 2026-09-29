// Shared option lists used by the forms and portals, kept in one place so
// the teacher's subject always matches the student's subject spelling.

export const DAYS = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

export const SUBJECT_OPTIONS = [
  "English", "Math", "Science", "Somali", "Arabic",
  "Islamic Studies", "Social Studies", "Computer",
  "Physics", "Chemistry", "Biology", "Quran",
];

export const SHIFTS = ["Morning", "Afternoon", "Evening"];
export const FEE_TYPES = ["Monthly", "Term", "Full Course", "Scholarship"];

// Attendance statuses. `so` is the Somali label shown under the English one.
export const ATTENDANCE_STATUSES = [
  { value: "present", label: "Present", so: "Joogay", tone: "green" },
  { value: "absent", label: "Absent", so: "Maqan", tone: "red" },
  { value: "late", label: "Late", so: "Daahay", tone: "amber" },
  { value: "excused", label: "Excused", so: "Fasax", tone: "blue" },
];

export const STATUS_META = Object.fromEntries(
  ATTENDANCE_STATUSES.map((s) => [s.value, s])
);

// ---- School classes ----
// Every class a student can be in. Open Classes lets a student pick one or
// both sub-classes; English Department has three levels (pick one).
export const CLASSES = [
  { id: "preparation", name: "Preparation", so: "Qeybta Diyaarinta", color: "green" },
  { id: "class8", name: "Class 8", so: "Fasalka 8aad", color: "amber" },
  { id: "f4", name: "Scientific F4", so: "Fasalka 4aad Sayniska", color: "blue" },
  { id: "computer", name: "Computer Class", so: "Fasalka Kombiyuutarka", color: "violet" },
  {
    id: "open",
    name: "Open Classes",
    so: "Fasallada Furan",
    color: "red",
    multi: true,
    subs: [
      { id: "somali", name: "Af-Somali" },
      { id: "xisaab", name: "Xisaab" },
    ],
  },
  {
    id: "english",
    name: "English Department",
    so: "Qeybta Ingiriisiga",
    color: "slate",
    multi: false,
    subs: [
      { id: "elementary", name: "Elementary" },
      { id: "intermediate", name: "Intermediate" },
      { id: "classic", name: "Classic" },
    ],
  },
];

export const CLASS_BY_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

// "Open Classes – Xisaab"
export function groupLabel(cls, sub) {
  return sub ? `${cls.name} – ${sub.name}` : cls.name;
}

// Flat list of every group a teacher can be assigned to / take attendance for.
export const CLASS_GROUPS = CLASSES.flatMap((c) =>
  c.subs ? c.subs.map((s) => groupLabel(c, s)) : [c.name]
);

// A student's groups. New students store classGroups; older ones only have
// a free-text className.
export function studentGroups(student) {
  if (Array.isArray(student?.classGroups) && student.classGroups.length) return student.classGroups;
  return student?.className ? [student.className] : [];
}

export const PAYMENT_METHODS = ["Cash", "EVC Plus", "Zaad", "Sahal", "E-Dahab", "Bank"];