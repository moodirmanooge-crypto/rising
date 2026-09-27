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