// src/utils/teacherClasses.js
//
// Macallin kasta wuxuu yeelan karaa classes badan, class kastana maadooyin
// gaar ah (classSubjectAssignments). Helper-yadan waxaa isticmaala
// Teacher Portal (attendance + results) iyo Admin (teachers table, exams).

import {
  CLASS_BY_ID,
  resolveGroupLabel,
  subjectsFor,
  studentBelongsToGroup,
  studentGroups,
  studentSubjectsIn,
} from "../config/schoolOptions";

const norm = (v) => String(v || "").trim().toLowerCase();

function cleanSubjects(item) {
  if (Array.isArray(item?.subjects)) return item.subjects.filter(Boolean);
  if (item?.subject) return [item.subject];
  return [];
}

// Teacher doc -> [{ className, subjects: [] }]
// Wuxuu taageeraa dhammaan qaababkii hore ee xogta.
// Macallinka maado gaar ah looma qoro — fasalka iyo shift-ka oo keliya. Sidaas darteed
// assignment kasta "subjects" waa maadooyinka rasmiga ah ee fasalka oo dhan
// (xaadirinta: dhammaan ardayda fasalka ku diiwaangashan).
export function teacherAssignments(teacher) {
  return rawTeacherAssignments(teacher).map((a) => {
    const r = resolveGroupLabel(a.className);
    const official = r ? subjectsFor(r.classId, r.subId) : [];
    return { ...a, subjects: official.length ? [...official] : a.subjects };
  });
}

function rawTeacherAssignments(teacher) {
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

export function studentInGroup(student, className) {
  const legacyClass = student.class || student.studentClass || "";
  return (
    studentGroups(student).some((g) => norm(g) === norm(className)) ||
    studentBelongsToGroup(student, className) ||
    norm(legacyClass) === norm(className)
  );
}

// Ardayda KU DIIWAANGASHAN fasalkan (isla B/T/J ama English A–E + level)
// OO qaata ugu yaraan mid ka mid ah maadooyinka macallinka loogu qoray fasalkan.
//  • Fasallada aan maado laga dooran (Diyaarinta, Computer): ardayga fasalka ku jira
//    maadooyinka oo dhan ayuu qaataa.
//  • Ardayga aan maadooyin lahayn → maadooyinka rasmiga ah ee fasalka.
export function studentsForClass(students, className, subjects = []) {
  const wanted = (subjects || []).filter(Boolean);
  const target = resolveGroupLabel(className);
  const official = target ? subjectsFor(target.classId, target.subId) : [];
  const allSubjects = !!(target && CLASS_BY_ID[target.classId]?.noSubjectPick);
  return students
    .filter((student) => {
      if (!studentInGroup(student, className)) return false;
      if (!wanted.length || allSubjects) return true;
      // Maadooyinka ardayga ee FASALKAN oo keliya (arday fasallo badan leh)
      let mine = studentSubjectsIn(student, className).filter((x) => !official.length || official.includes(x));
      if (!mine.length) mine = official;
      return wanted.some((subject) => mine.some((s) => sameSubject(s, subject)));
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