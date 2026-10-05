// ============================================================
// RISING STAR SCHOOL SYSTEM
// Shared option lists used by:
// - Student registration
// - Teacher registration
// - Teacher Portal
// - Attendance
// - Classes management
// - Student filtering
//
// Includes:
// - English Elementary A-D
// - English Intermediate A-D
// - English Classic
// - Dynamic Firestore school classes
// - sortClasses()
// - subscribeSchoolClasses()
// ============================================================

import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

// ============================================================
// DAYS
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

// ============================================================
// SUBJECTS
// ============================================================

export const SUBJECT_OPTIONS = [
  "English",
  "Math",
  "Science",
  "Somali",
  "Arabic",
  "Islamic Studies",
  "Social Studies",
  "Computer",
  "Physics",
  "Chemistry",
  "Biology",
  "Quran",
];

// ============================================================
// SHIFTS
// ============================================================

export const SHIFTS = [
  "Morning",
  "Afternoon",
  "Evening",
];

// ============================================================
// FEE TYPES
// ============================================================

export const FEE_TYPES = [
  "Monthly",
  "Term",
  "Full Course",
  "Scholarship",
];

// ============================================================
// ATTENDANCE STATUSES
// ============================================================

export const ATTENDANCE_STATUSES = [
  {
    value: "present",
    label: "Present",
    so: "Joogay",
    tone: "green",
  },
  {
    value: "absent",
    label: "Absent",
    so: "Maqan",
    tone: "red",
  },
  {
    value: "late",
    label: "Late",
    so: "Daahay",
    tone: "amber",
  },
  {
    value: "excused",
    label: "Excused",
    so: "Fasax",
    tone: "blue",
  },
];

export const STATUS_META = Object.fromEntries(
  ATTENDANCE_STATUSES.map((status) => [
    status.value,
    status,
  ])
);

// ============================================================
// ENGLISH DEPARTMENT SECTIONS
// ============================================================

export const ENGLISH_SECTIONS = [
  {
    id: "a",
    name: "Class A",
    shortName: "A",
  },
  {
    id: "b",
    name: "Class B",
    shortName: "B",
  },
  {
    id: "c",
    name: "Class C",
    shortName: "C",
  },
  {
    id: "d",
    name: "Class D",
    shortName: "D",
  },
];

// ============================================================
// ENGLISH LEVELS
// ============================================================

export const ENGLISH_LEVELS = [
  {
    id: "elementary",
    name: "Elementary",
    so: "Elementary",
  },
  {
    id: "intermediate",
    name: "Intermediate",
    so: "Intermediate",
  },
  {
    id: "classic",
    name: "Classic",
    so: "Classic",
  },
];

// ============================================================
// CREATE ENGLISH CLASS
// ============================================================

export function createEnglishSection(level, section) {
  const levelData = ENGLISH_LEVELS.find(
    (item) => item.id === level
  );

  const sectionData = ENGLISH_SECTIONS.find(
    (item) => item.id === section
  );

  if (!levelData || !sectionData) {
    return null;
  }

  return {
    id: `english-${level}-${section}`,

    name: `Class ${sectionData.shortName} English ${levelData.name}`,

    so: `Qeybta ${levelData.name} - Class ${sectionData.shortName}`,

    color:
      level === "elementary"
        ? "green"
        : level === "intermediate"
        ? "blue"
        : "violet",

    type: "english",

    level: levelData.name,

    levelId: levelData.id,

    section: sectionData.shortName,

    sectionId: sectionData.id,

    department: "English Department",
  };
}

// ============================================================
// ALL ENGLISH GROUPS
// ============================================================

export const ENGLISH_GROUPS = ENGLISH_LEVELS.flatMap(
  (level) =>
    ENGLISH_SECTIONS.map((section) =>
      createEnglishSection(
        level.id,
        section.id
      )
    )
);

// ============================================================
// SCHOOL CLASSES
// ============================================================

export const CLASSES = [
  // ----------------------------------------------------------
  // PREPARATION
  // ----------------------------------------------------------

  {
    id: "preparation",
    name: "Preparation",
    so: "Qeybta Diyaarinta",
    color: "green",
    type: "school",
  },

  // ----------------------------------------------------------
  // CLASS 8
  // ----------------------------------------------------------

  {
    id: "class8",
    name: "Class 8",
    so: "Fasalka 8aad",
    color: "amber",
    type: "school",
  },

  // ----------------------------------------------------------
  // SCIENTIFIC F4
  // ----------------------------------------------------------

  {
    id: "f4",
    name: "Scientific F4",
    so: "Fasalka 4aad Sayniska",
    color: "blue",
    type: "school",
  },

  // ----------------------------------------------------------
  // COMPUTER
  // ----------------------------------------------------------

  {
    id: "computer",
    name: "Computer Class",
    so: "Fasalka Kombiyuutarka",
    color: "violet",
    type: "school",
  },

  // ----------------------------------------------------------
  // OPEN CLASSES
  // ----------------------------------------------------------

  {
    id: "open",
    name: "Open Classes",
    so: "Fasallada Furan",
    color: "red",

    type: "open",

    multi: true,

    subs: [
      {
        id: "somali",
        name: "Af-Somali",
      },

      {
        id: "xisaab",
        name: "Xisaab",
      },
    ],
  },

  // ----------------------------------------------------------
  // ENGLISH DEPARTMENT
  // ----------------------------------------------------------

  {
    id: "english",

    name: "English Department",

    so: "Qeybta Ingiriisiga",

    color: "slate",

    type: "department",

    multi: false,

    // 12 English classes:
    //
    // Elementary:
    // A B C D
    //
    // Intermediate:
    // A B C D
    //
    // Classic:
    // A B C D

    subs: ENGLISH_GROUPS.map((group) => ({
      id: group.id,

      name: group.name,

      so: group.so,

      color: group.color,

      type: group.type,

      level: group.level,

      levelId: group.levelId,

      section: group.section,

      sectionId: group.sectionId,
    })),
  },
];

// ============================================================
// CLASS LOOKUP
// ============================================================

export const CLASS_BY_ID = Object.fromEntries(
  CLASSES.map((cls) => [
    cls.id,
    cls,
  ])
);

// ============================================================
// ENGLISH CLASS LOOKUP
// ============================================================

export const ENGLISH_GROUP_BY_ID =
  Object.fromEntries(
    ENGLISH_GROUPS.map((group) => [
      group.id,
      group,
    ])
  );

// ============================================================
// GROUP LABEL
// ============================================================

export function groupLabel(cls, sub) {
  if (!sub) {
    return cls?.name || "";
  }

  // English classes already have complete names.
  //
  // Example:
  // Class A English Elementary

  if (cls?.id === "english") {
    return sub.name;
  }

  // Example:
  // Open Classes – Af-Somali

  return `${cls.name} – ${sub.name}`;
}

// ============================================================
// FLAT CLASS GROUPS
// ============================================================
//
// Used mainly by TeacherForm.
//
// Example:
//
// Class A English Elementary
// Class B English Elementary
// Class C English Elementary
// Class D English Elementary
//
// Class A English Intermediate
// Class B English Intermediate
// Class C English Intermediate
// Class D English Intermediate
//
// Class A English Classic
// Class B English Classic
// Class C English Classic
// Class D English Classic
//
// ============================================================

export const CLASS_GROUPS = CLASSES.flatMap(
  (cls) => {
    if (!cls.subs) {
      return [cls.name];
    }

    return cls.subs.map((sub) =>
      groupLabel(cls, sub)
    );
  }
);

// ============================================================
// DEFAULT SCHOOL CLASSES
// ============================================================
//
// These are available even before Firestore classes
// are created by the administrator.
//

export const DEFAULT_SCHOOL_CLASSES = [
  ...CLASSES
    .filter((cls) => !cls.subs)
    .map((cls) => ({
      ...cls,
      type: cls.type || "school",
    })),

  ...ENGLISH_GROUPS,
];

// ============================================================
// NORMALIZE SCHOOL CLASS
// ============================================================
//
// Makes classes coming from Firestore compatible with
// StudentForm.
//
// Supports:
//
// level: "elementary"
// level: "Elementary"
//
// section: "a"
// section: "A"
// ============================================================

export function normalizeSchoolClass(
  item,
  fallbackId = ""
) {
  if (!item) {
    return null;
  }

  const levelRaw =
    item.level ||
    item.classLevel ||
    "";

  const sectionRaw =
    item.section ||
    item.classSection ||
    "";

  const levelMap = {
    elementary: "Elementary",
    intermediate: "Intermediate",
    classic: "Classic",
  };

  const level =
    levelMap[
      String(levelRaw)
        .trim()
        .toLowerCase()
    ] ||
    String(levelRaw).trim();

  const section =
    String(sectionRaw)
      .trim()
      .toUpperCase();

  const isEnglish =
    String(item.type || "")
      .toLowerCase() === "english" ||
    Boolean(
      level &&
      [
        "Elementary",
        "Intermediate",
        "Classic",
      ].includes(level)
    );

  let name =
    item.name ||
    item.className ||
    "";

  // Automatically create the correct English
  // class name.

  if (
    isEnglish &&
    level &&
    /^[A-D]$/.test(section)
  ) {
    name =
      `Class ${section} English ${level}`;
  }

  if (!name) {
    return null;
  }

  return {
    ...item,

    id:
      item.id ||
      item.docId ||
      fallbackId ||
      name,

    name,

    so:
      item.so ||
      (
        isEnglish
          ? `Qeybta ${level} - Class ${section}`
          : "School Class"
      ),

    color:
      item.color ||
      (
        level === "Elementary"
          ? "green"
          : level === "Intermediate"
          ? "blue"
          : level === "Classic"
          ? "violet"
          : "blue"
      ),

    type:
      isEnglish
        ? "english"
        : item.type || "school",

    level:
      isEnglish
        ? level
        : item.level || "",

    levelId:
      isEnglish
        ? level.toLowerCase()
        : item.levelId || "",

    section:
      isEnglish
        ? section
        : item.section || "",

    sectionId:
      isEnglish
        ? section.toLowerCase()
        : item.sectionId || "",
  };
}

// ============================================================
// SORT CLASSES
// ============================================================
//
// IMPORTANT:
// StudentForm.jsx imports this function.
//
// English order:
//
// Elementary
// A
// B
// C
// D
//
// Intermediate
// A
// B
// C
// D
//
// Classic
// A
// B
// C
// D
//
// Then the other school classes.
//

export function sortClasses(
  classes = []
) {
  const levelOrder = {
    Elementary: 1,
    Intermediate: 2,
    Classic: 3,
  };

  const sectionOrder = {
    A: 1,
    B: 2,
    C: 3,
    D: 4,
  };

  const otherOrder = {
    Preparation: 1,
    "Class 8": 2,
    "Scientific F4": 3,
    "Computer Class": 4,
    "Open Classes": 5,
  };

  return [...classes]
    .filter(Boolean)
    .sort((a, b) => {
      const aEnglish =
        a.type === "english" ||
        [
          "Elementary",
          "Intermediate",
          "Classic",
        ].includes(a.level);

      const bEnglish =
        b.type === "english" ||
        [
          "Elementary",
          "Intermediate",
          "Classic",
        ].includes(b.level);

      // English first.

      if (
        aEnglish &&
        !bEnglish
      ) {
        return -1;
      }

      if (
        !aEnglish &&
        bEnglish
      ) {
        return 1;
      }

      // English sorting.

      if (
        aEnglish &&
        bEnglish
      ) {
        const levelDiff =
          (
            levelOrder[a.level] ||
            99
          ) -
          (
            levelOrder[b.level] ||
            99
          );

        if (levelDiff !== 0) {
          return levelDiff;
        }

        return (
          (
            sectionOrder[a.section] ||
            99
          ) -
          (
            sectionOrder[b.section] ||
            99
          )
        );
      }

      // Other school classes.

      const aRank =
        otherOrder[a.name] ||
        99;

      const bRank =
        otherOrder[b.name] ||
        99;

      if (
        aRank !== bRank
      ) {
        return aRank - bRank;
      }

      return String(
        a.name || ""
      ).localeCompare(
        String(b.name || "")
      );
    });
}

// ============================================================
// FIRESTORE SCHOOL CLASSES
// ============================================================
//
// Collection:
// rssSchoolClasses
//
// StudentForm.jsx uses:
//
// subscribeSchoolClasses(
//   callback,
//   errorCallback
// )
//
// Admin-created classes are loaded live.
//
// If Firestore has no classes yet,
// default classes are shown.
//

const SCHOOL_CLASSES_COLLECTION =
  "rssSchoolClasses";

export function subscribeSchoolClasses(
  onData,
  onError
) {
  let active = true;

  const defaultClasses =
    DEFAULT_SCHOOL_CLASSES
      .map((item) =>
        normalizeSchoolClass(item)
      )
      .filter(Boolean);

  // Show default classes immediately.

  onData?.(
    sortClasses(
      defaultClasses
    )
  );

  const unsubscribe =
    onSnapshot(
      collection(
        db,
        SCHOOL_CLASSES_COLLECTION
      ),

      (snapshot) => {
        if (!active) {
          return;
        }

        const customClasses =
          snapshot.docs
            .map((docSnap) =>
              normalizeSchoolClass(
                {
                  ...docSnap.data(),
                  id: docSnap.id,
                },
                docSnap.id
              )
            )
            .filter(Boolean);

        // Default classes.

        const classMap =
          new Map(
            defaultClasses.map(
              (item) => [
                item.id,
                item,
              ]
            )
          );

        // Custom classes replace
        // defaults with the same ID.

        customClasses.forEach(
          (item) => {
            classMap.set(
              item.id,
              item
            );
          }
        );

        onData?.(
          sortClasses(
            [
              ...classMap.values(),
            ]
          )
        );
      },

      (error) => {
        if (!active) {
          return;
        }

        // Keep default classes visible
        // if Firestore permissions fail.

        onData?.(
          sortClasses(
            defaultClasses
          )
        );

        onError?.(error);
      }
    );

  return () => {
    active = false;

    unsubscribe?.();
  };
}

// ============================================================
// ENGLISH HELPERS
// ============================================================

export function isEnglishGroup(
  value
) {
  const text =
    String(value || "")
      .toLowerCase();

  return (
    text.startsWith("class ") &&
    (
      text.includes(
        "elementary"
      ) ||
      text.includes(
        "intermediate"
      ) ||
      text.includes(
        "classic"
      )
    )
  );
}

// ============================================================
// GET ENGLISH LEVEL
// ============================================================

export function getEnglishLevel(
  value
) {
  const text =
    String(value || "")
      .toLowerCase();

  if (
    text.includes(
      "elementary"
    )
  ) {
    return "elementary";
  }

  if (
    text.includes(
      "intermediate"
    )
  ) {
    return "intermediate";
  }

  if (
    text.includes(
      "classic"
    )
  ) {
    return "classic";
  }

  return "";
}

// ============================================================
// GET ENGLISH SECTION
// ============================================================

export function getEnglishSection(
  value
) {
  const text =
    String(value || "")
      .trim();

  const match =
    text.match(
      /^Class\s+([A-D])/i
    );

  return match
    ? match[1].toUpperCase()
    : "";
}

// ============================================================
// STUDENT GROUPS
// ============================================================
//
// New student:
//
// classGroups:
// ["Class A English Elementary"]
//
// Old student:
//
// className:
// "Elementary"
//
// Both are supported.
//

export function studentGroups(
  student
) {
  if (
    Array.isArray(
      student?.classGroups
    ) &&
    student.classGroups.length
  ) {
    return student.classGroups;
  }

  if (
    student?.classGroup
  ) {
    return [
      student.classGroup,
    ];
  }

  if (
    student?.className
  ) {
    return [
      student.className,
    ];
  }

  if (
    student?.class
  ) {
    return [
      student.class,
    ];
  }

  if (
    student?.studentClass
  ) {
    return [
      student.studentClass,
    ];
  }

  return [];
}

// ============================================================
// STUDENT BELONGS TO GROUP
// ============================================================

export function studentBelongsToGroup(
  student,
  targetGroup
) {
  if (!targetGroup) {
    return false;
  }

  const target =
    String(targetGroup)
      .trim()
      .toLowerCase();

  return studentGroups(
    student
  ).some(
    (group) =>
      String(group)
        .trim()
        .toLowerCase() ===
      target
  );
}

// ============================================================
// TEACHER GROUPS
// ============================================================

export function teacherGroups(
  teacher
) {
  if (
    Array.isArray(
      teacher?.classGroups
    ) &&
    teacher.classGroups.length
  ) {
    return teacher.classGroups;
  }

  if (
    teacher?.classGroup
  ) {
    return [
      teacher.classGroup,
    ];
  }

  if (
    teacher?.className
  ) {
    return [
      teacher.className,
    ];
  }

  if (
    teacher?.class
  ) {
    return [
      teacher.class,
    ];
  }

  return [];
}

// ============================================================
// TEACHER / STUDENT MATCH
// ============================================================
//
// Teacher:
//
// Class A English Elementary
//
// Student:
//
// Class A English Elementary
//
// TRUE
//
// Teacher:
//
// Class A English Elementary
//
// Student:
//
// Class B English Elementary
//
// FALSE
//

export function teacherHasStudentGroup(
  teacher,
  student
) {
  const teacherGroupList =
    teacherGroups(
      teacher
    );

  const studentGroupList =
    studentGroups(
      student
    );

  if (
    teacherGroupList.length === 0 ||
    studentGroupList.length === 0
  ) {
    return false;
  }

  return teacherGroupList.some(
    (teacherGroup) =>
      studentGroupList.some(
        (studentGroup) =>
          String(
            teacherGroup
          )
            .trim()
            .toLowerCase() ===
          String(
            studentGroup
          )
            .trim()
            .toLowerCase()
      )
  );
}

// ============================================================
// PAYMENT METHODS
// ============================================================

export const PAYMENT_METHODS = [
  "Cash",
  "EVC Plus",
  "Zaad",
  "Sahal",
  "E-Dahab",
  "Bank",
];