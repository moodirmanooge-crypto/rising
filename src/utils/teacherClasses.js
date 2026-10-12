// src/utils/teacherClasses.js
//
// Macallin kasta wuxuu yeelan karaa classes badan, class kastana maadooyin
// gaar ah (classSubjectAssignments). Helper-yadan waxaa isticmaala
// Teacher Portal (attendance + results) iyo Admin (teachers table, exams).

import {
  SUBJECT_OPTIONS,
  resolveGroupLabel,
  studentBelongsToGroup,
  studentGroups,
} from "../config/schoolOptions";

const norm = (v) => String(v || "").trim().toLowerCase();

function cleanSubjects(item) {
  if (Array.isArray(item?.subjects)) return item.subjects.filter(Boolean);
  if (item?.subject) return [item.subject];
  return [];
}

// Teacher doc -> [{ className, subjects: [] }]
// Wuxuu taageeraa dhammaan qaababkii hore ee xogta.
export function teacherAssignments(teacher) {
  if (!teacher) return [];

  const fromList = (list) =>
    list
      .map((item) => ({
        className: String(item?.className || item?.class || "").trim(),
        subjects: [...new Set(cleanSubjects(item))],
      }))
      .filter((item) => item.className);

  if (Array.isArray(teacher.classSubjectAssignments) && teacher.classSubjectAssignments.length) {
    return fromList(teacher.classSubjectAssignments);
  }
  if (Array.isArray(teacher.classAssignments) && teacher.classAssignments.length) {
    return fromList(teacher.classAssignments);
  }

  const oldSubjects =
    Array.isArray(teacher.subjects) && teacher.subjects.length
      ? teacher.subjects.filter(Boolean)
      : teacher.subject
      ? [teacher.subject]
      : [];

  if (Array.isArray(teacher.classGroups) && teacher.classGroups.length) {
    return teacher.classGroups.filter(Boolean).map((className) => ({ className, subjects: [...oldSubjects] }));
  }
  if (teacher.className || teacher.class) {
    return [{ className: teacher.className || teacher.class, subjects: [...oldSubjects] }];
  }
  return [];
}

export function teacherAllSubjects(teacher) {
  return [...new Set(teacherAssignments(teacher).flatMap((a) => a.subjects))];
}

// "Class A English Elementary" -> "class-a-english-elementary"
// (waxaa lagu daraa ID-yada attendance-ka si class kasta gooni u keydsamo)
export function classKey(className) {
  return (
    String(className || "")
      .toLowerCase()
      .replace(/[–—]/g, "-")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "class"
  );
}

// Labo magac fasal oo isku mid ah (xitaa haddii qaab kale loo qoray).
export function sameGroup(a, b) {
  if (norm(a) === norm(b)) return true;
  const ra = resolveGroupLabel(a);
  const rb = resolveGroupLabel(b);
  if (!ra || !rb) return false;
  return ra.classId === rb.classId && (ra.subId || "") === (rb.subId || "");
}

export function sameSubject(a, b) {
  return norm(a) === norm(b);
}

function studentSubjects(student) {
  if (Array.isArray(student?.subjects)) return student.subjects;
  if (student?.subjects) return [student.subjects];
  if (student?.subject) return [student.subject];
  return [];
}

export function studentInGroup(student, className) {
  const legacyClass = student.class || student.studentClass || "";
  return (
    studentGroups(student).some((g) => norm(g) === norm(className)) ||
    studentBelongsToGroup(student, className) ||
    norm(legacyClass) === norm(className)
  );
}

// Ardayda fasalkan ee qaata ugu yaraan mid ka mid ah maadooyinka la siiyay.
// Ardayga aan maadooyin lahayn (ama maado magac hore leh) lama xannibo.
export function studentsForClass(students, className, subjects = []) {
  const wanted = (subjects || []).filter(Boolean);
  return students
    .filter((student) => {
      if (!studentInGroup(student, className)) return false;
      if (!wanted.length) return true;
      const mine = studentSubjects(student);
      if (!mine.length) return true;
      return wanted.some(
        (subject) =>
          !SUBJECT_OPTIONS.some((s) => sameSubject(s, subject)) ||
          mine.some((s) => sameSubject(s, subject))
      );
    })
    .sort((a, b) => String(a.studentId).localeCompare(String(b.studentId), undefined, { numeric: true }));
}

// Teacher-ku ma dhigaa maadadan fasalkan?
export function teacherTeaches(teacher, className, subject) {
  return teacherAssignments(teacher).some(
    (a) => sameGroup(a.className, className) && a.subjects.some((s) => sameSubject(s, subject))
  );
}

// Short text: "Class A English Elementary: English • Class 8: Xisaab, Somali"
export function assignmentsText(teacher, sep = " • ") {
  return teacherAssignments(teacher)
    .map((a) => `${a.className}${a.subjects.length ? `: ${a.subjects.join(", ")}` : ""}`)
    .join(sep);
}