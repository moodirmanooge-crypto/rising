import { useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
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
} from "lucide-react";

import { db } from "../firebase";
import {
  DAYS,
  SUBJECT_OPTIONS,
  CLASS_GROUPS,
} from "../config/schoolOptions";
import { TEACHERS_COLLECTION } from "../config/collections";
import {
  formatTime12,
  getTeacherDays,
} from "../utils/attendance";
import TimePicker12 from "./TimePicker12";

// ============================================================
// FORM DATA
// ============================================================

const emptyForm = {
  fullName: "",
  phone: "",
  password: "",

  // New system:
  // [
  //   {
  //     className: "Class A English Elementary",
  //     subjects: ["English", "Math"]
  //   },
  //   {
  //     className: "Class B English Elementary",
  //     subjects: ["English", "Science"]
  //   }
  // ]
  classSubjectAssignments: [],

  // Old fields are kept for compatibility.
  classGroups: [],
  className: "",
  subject: "",

  attendanceDays: [],
  startTime: "07:30",
  endTime: "08:30",
};

const MIN_PASSWORD = 4;

// ============================================================
// PASSWORD
// ============================================================

function generatePassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

  let password = "";

  for (let i = 0; i < 8; i++) {
    password += chars.charAt(
      Math.floor(Math.random() * chars.length)
    );
  }

  return password;
}

// ============================================================
// NORMALIZE ASSIGNMENTS
// ============================================================

function normalizeAssignments(teacher) {
  // New format.
  if (
    Array.isArray(teacher?.classSubjectAssignments) &&
    teacher.classSubjectAssignments.length
  ) {
    return teacher.classSubjectAssignments
      .map((item) => ({
        className: String(
          item?.className ||
            item?.class ||
            ""
        ).trim(),

        subjects: Array.isArray(item?.subjects)
          ? item.subjects.filter(Boolean)
          : item?.subject
          ? [item.subject]
          : [],
      }))
      .filter((item) => item.className);
  }

  // Also support classAssignments if another screen used that name.
  if (
    Array.isArray(teacher?.classAssignments) &&
    teacher.classAssignments.length
  ) {
    return teacher.classAssignments
      .map((item) => ({
        className: String(
          item?.className ||
            item?.class ||
            ""
        ).trim(),

        subjects: Array.isArray(item?.subjects)
          ? item.subjects.filter(Boolean)
          : item?.subject
          ? [item.subject]
          : [],
      }))
      .filter((item) => item.className);
  }

  // Old data:
  // classGroups + subjects
  if (
    Array.isArray(teacher?.classGroups) &&
    teacher.classGroups.length
  ) {
    const oldSubjects =
      Array.isArray(teacher?.subjects) &&
      teacher.subjects.length
        ? teacher.subjects
        : teacher?.subject
        ? [teacher.subject]
        : [];

    return teacher.classGroups.map(
      (className) => ({
        className,
        subjects: [...oldSubjects],
      })
    );
  }

  // Very old data:
  // className + subject
  if (teacher?.className || teacher?.class) {
    return [
      {
        className:
          teacher.className ||
          teacher.class,

        subjects:
          teacher?.subject
            ? [teacher.subject]
            : Array.isArray(
                teacher?.subjects
              )
            ? teacher.subjects
            : [],
      },
    ];
  }

  return [];
}

// ============================================================
// FORM FROM TEACHER
// ============================================================

function formFromTeacher(teacher) {
  if (!teacher) {
    return {
      ...emptyForm,
      classSubjectAssignments: [],
      classGroups: [],
    };
  }

  const assignments =
    normalizeAssignments(teacher);

  const classGroups =
    assignments.map(
      (item) => item.className
    );

  const allSubjects = [
    ...new Set(
      assignments.flatMap(
        (item) => item.subjects || []
      )
    ),
  ];

  return {
    fullName:
      teacher.fullName || "",

    phone:
      teacher.phone || "",

    password:
      teacher.password
        ? String(teacher.password)
        : "",

    classSubjectAssignments:
      assignments,

    classGroups,

    className:
      classGroups[0] || "",

    subject:
      allSubjects[0] || "",

    attendanceDays:
      getTeacherDays(teacher),

    startTime:
      teacher.startTime || "",

    endTime:
      teacher.endTime || "",
  };
}

// ============================================================
// ASSIGNMENT HELPERS
// ============================================================

function uniqueClasses(assignments) {
  return [
    ...new Set(
      assignments
        .map((item) => item.className)
        .filter(Boolean)
    ),
  ];
}

function allAssignedSubjects(assignments) {
  return [
    ...new Set(
      assignments.flatMap(
        (item) =>
          Array.isArray(item.subjects)
            ? item.subjects
            : []
      )
    ),
  ];
}

// ============================================================
// TEACHER FORM
// ============================================================

export default function TeacherForm({
  onRegistered,
  editTeacher = null,
  onDone,
  onCancel,
}) {
  const isEdit = !!editTeacher;

  const [form, setForm] = useState(
    () => formFromTeacher(editTeacher)
  );

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [created, setCreated] =
    useState(null);

  const [copied, setCopied] =
    useState(false);

  // ----------------------------------------------------------
  // Generic update
  // ----------------------------------------------------------

  function update(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  // ----------------------------------------------------------
  // Attendance days
  // ----------------------------------------------------------

  function toggleDay(day) {
    setForm((prev) => ({
      ...prev,

      attendanceDays:
        prev.attendanceDays.includes(day)
          ? prev.attendanceDays.filter(
              (item) => item !== day
            )
          : [
              ...prev.attendanceDays,
              day,
            ],
    }));
  }

  // ----------------------------------------------------------
  // Generate username
  // ----------------------------------------------------------

  async function generateUsername(
    fullName
  ) {
    const firstName =
      fullName
        .trim()
        .split(/\s+/)[0] || "";

    const base =
      firstName
        .toLowerCase()
        .replace(/[^a-z]/g, "") ||
      "teacher";

    while (true) {
      const number =
        Math.floor(
          100 +
            Math.random() * 900
        );

      const username =
        `${base}${number}`;

      const teacherRef =
        doc(
          db,
          TEACHERS_COLLECTION,
          username
        );

      const snapshot =
        await getDoc(
          teacherRef
        );

      if (!snapshot.exists()) {
        return username;
      }
    }
  }

  // ----------------------------------------------------------
  // Get current assignments
  // ----------------------------------------------------------

  const assignments =
    Array.isArray(
      form.classSubjectAssignments
    )
      ? form.classSubjectAssignments
      : [];

  const selectedClasses =
    uniqueClasses(assignments);

  // ----------------------------------------------------------
  // Toggle whole class
  // ----------------------------------------------------------

  function toggleClass(
    className
  ) {
    setForm((prev) => {
      const current =
        Array.isArray(
          prev.classSubjectAssignments
        )
          ? prev.classSubjectAssignments
          : [];

      const exists =
        current.some(
          (item) =>
            item.className ===
            className
        );

      if (exists) {
        const next =
          current.filter(
            (item) =>
              item.className !==
              className
          );

        return {
          ...prev,

          classSubjectAssignments:
            next,

          classGroups:
            next.map(
              (item) =>
                item.className
            ),

          className:
            next[0]?.className ||
            "",

          subject:
            next[0]?.subjects?.[0] ||
            "",
        };
      }

      const next = [
        ...current,
        {
          className,
          subjects: [],
        },
      ];

      return {
        ...prev,

        classSubjectAssignments:
          next,

        classGroups:
          next.map(
            (item) =>
              item.className
          ),

        className:
          next[0]?.className ||
          "",

        subject:
          next[0]?.subjects?.[0] ||
          "",
      };
    });
  }

  // ----------------------------------------------------------
  // Toggle subject for one specific class
  // ----------------------------------------------------------

  function toggleSubject(
    className,
    subject
  ) {
    setForm((prev) => {
      const current =
        Array.isArray(
          prev.classSubjectAssignments
        )
          ? prev.classSubjectAssignments
          : [];

      const next =
        current.map((item) => {
          if (
            item.className !==
            className
          ) {
            return item;
          }

          const subjects =
            Array.isArray(
              item.subjects
            )
              ? item.subjects
              : [];

          const exists =
            subjects.includes(
              subject
            );

          return {
            ...item,

            subjects: exists
              ? subjects.filter(
                  (item) =>
                    item !==
                    subject
                )
              : [
                  ...subjects,
                  subject,
                ],
          };
        });

      return {
        ...prev,

        classSubjectAssignments:
          next,

        classGroups:
          next.map(
            (item) =>
              item.className
          ),

        className:
          next[0]?.className ||
          "",

        subject:
          next
            .find(
              (item) =>
                item.subjects?.length
            )
            ?.subjects?.[0] ||
          "",
      };
    });
  }

  // ----------------------------------------------------------
  // Submit
  // ----------------------------------------------------------

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setCreated(null);
    setCopied(false);

    const password =
      form.password.trim();

    const cleanAssignments =
      assignments
        .map((item) => ({
          className:
            String(
              item.className ||
                ""
            ).trim(),

          subjects: [
            ...new Set(
              (
                Array.isArray(
                  item.subjects
                )
                  ? item.subjects
                  : []
              ).filter(Boolean)
            ),
          ],
        }))
        .filter(
          (item) =>
            item.className
        );

    // --------------------------------------------------------
    // Validation
    // --------------------------------------------------------

    if (
      !form.fullName.trim()
    ) {
      return setError(
        "Full Name is required."
      );
    }

    if (
      password.length <
      MIN_PASSWORD
    ) {
      return setError(
        `Geli password-ka macalinka (ugu yaraan ${MIN_PASSWORD} xaraf/lambar).`
      );
    }

    if (/\s/.test(password)) {
      return setError(
        "Password-ku waa inuusan lahayn meel bannaan (space)."
      );
    }

    if (
      cleanAssignments.length ===
      0
    ) {
      return setError(
        "Dooro ugu yaraan hal class."
      );
    }

    // Every class MUST have at least one
    // subject.

    const classWithoutSubject =
      cleanAssignments.find(
        (item) =>
          item.subjects.length ===
          0
      );

    if (classWithoutSubject) {
      return setError(
        `Dooro ugu yaraan hal maado: ${classWithoutSubject.className}`
      );
    }

    if (
      form.attendanceDays
        .length === 0
    ) {
      return setError(
        "Select at least one attendance day."
      );
    }

    if (
      !form.startTime ||
      !form.endTime
    ) {
      return setError(
        "Attendance start and end time are required (dooro AM ama PM)."
      );
    }

    if (
      form.startTime >=
      form.endTime
    ) {
      return setError(
        "End time must be after start time."
      );
    }

    setSaving(true);

    try {
      // ------------------------------------------------------
      // Build subject list from all assignments.
      // ------------------------------------------------------

      const allSubjects =
        allAssignedSubjects(
          cleanAssignments
        );

      const schedule = {
        password,

        fullName:
          form.fullName.trim(),

        phone:
          form.phone.trim(),

        // ====================================================
        // NEW MAIN STRUCTURE
        // ====================================================
        //
        // Example:
        //
        // classSubjectAssignments: [
        //   {
        //     className: "Class A English Elementary",
        //     subjects: ["English", "Math"]
        //   },
        //   {
        //     className: "Class B English Elementary",
        //     subjects: ["English", "Science"]
        //   }
        // ]
        //
        // ====================================================

        classSubjectAssignments:
          cleanAssignments,

        // Compatibility.
        classAssignments:
          cleanAssignments,

        classGroups:
          cleanAssignments.map(
            (item) =>
              item.className
          ),

        classNames:
          cleanAssignments.map(
            (item) =>
              item.className
          ),

        // Old single-class field.
        className:
          cleanAssignments[0]
            .className,

        // All subjects teacher teaches.
        subjects:
          allSubjects,

        // Old single-subject field.
        subject:
          allSubjects[0] || "",

        attendanceDays:
          form.attendanceDays,

        // Old field compatibility.
        attendanceDay:
          form.attendanceDays[0],

        startTime:
          form.startTime,

        endTime:
          form.endTime,
      };

      // ------------------------------------------------------
      // EDIT
      // ------------------------------------------------------

      if (isEdit) {
        const id =
          editTeacher.username ||
          editTeacher.teacherId;

        await updateDoc(
          doc(
            db,
            TEACHERS_COLLECTION,
            id
          ),
          {
            ...schedule,
            updatedAt:
              serverTimestamp(),
          }
        );

        onDone?.({
          username: id,
          password,
          classSubjectAssignments:
            cleanAssignments,
        });

        return;
      }

      // ------------------------------------------------------
      // CREATE
      // ------------------------------------------------------

      const teacherUsername =
        await generateUsername(
          form.fullName
        );

      const data = {
        teacherId:
          teacherUsername,

        username:
          teacherUsername,

        ...schedule,

        role: "teacher",

        createdAt:
          serverTimestamp(),
      };

      await setDoc(
        doc(
          db,
          TEACHERS_COLLECTION,
          teacherUsername
        ),
        data
      );

      setCreated({
        ...data,
        createdAt: null,
      });

      setForm({
        ...emptyForm,
        classSubjectAssignments: [],
        classGroups: [],
      });

      onRegistered?.(
        teacherUsername
      );
    } catch (err) {
      console.error(
        "Teacher save error:",
        err
      );

      setError(
        err.message ||
          "Failed to save teacher."
      );
    } finally {
      setSaving(false);
    }
  }

  // ----------------------------------------------------------
  // Copy credentials
  // ----------------------------------------------------------

  function copyCredentials() {
    if (!created) return;

    const assignmentsText =
      created.classSubjectAssignments
        ?.map(
          (item) =>
            `${item.className}: ${item.subjects.join(
              ", "
            )}`
        )
        .join("\n") ||
      "";

    const text =
      `Rising Star School — Teacher Login\n` +
      `Username: ${created.username}\n` +
      `Password: ${created.password}\n\n` +
      `Classes & Subjects:\n${assignmentsText}`;

    navigator.clipboard
      ?.writeText(text)
      .then(() =>
        setCopied(true)
      );
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <form
      className={
        isEdit
          ? "form"
          : "panel form"
      }
      onSubmit={
        handleSubmit
      }
    >
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="panel-head">
        <div className="panel-icon">
          <UserPlus size={20} />
        </div>

        <div>
          <h2>
            {isEdit
              ? `Edit Teacher — ${
                  editTeacher.username ||
                  editTeacher.teacherId
                }`
              : "Register New Teacher"}
          </h2>

          <p>
            {isEdit
              ? "Wax ka beddel xogta macalinka, classes-ka, maadooyinka iyo goorta xaadirinta."
              : "Hal macallin u qoondee classes badan iyo maadooyin kala duwan."}
          </p>
        </div>
      </div>

      {/* ======================================================
          SUCCESS CARD
      ====================================================== */}

      {created && (
        <div className="credential-card">
          <div className="credential-head">
            <CheckCircle2
              size={22}
            />

            <div>
              <strong>
                Teacher registered
                successfully
              </strong>

              <span>
                {created.fullName}
              </span>
            </div>
          </div>

          <div className="credential-grid">
            <div>
              <span>
                Username
              </span>

              <strong>
                {
                  created.username
                }
              </strong>
            </div>

            <div>
              <span>
                Password
              </span>

              <strong>
                {
                  created.password
                }
              </strong>
            </div>

            <div>
              <span>
                Classes & Subjects
              </span>

              <strong>
                {created
                  .classSubjectAssignments
                  ?.map(
                    (item) =>
                      `${item.className}: ${item.subjects.join(
                        ", "
                      )}`
                  )
                  .join(
                    " • "
                  )}
              </strong>
            </div>

            <div>
              <span>
                Days
              </span>

              <strong>
                {created
                  .attendanceDays
                  .join(
                    ", "
                  )}
              </strong>
            </div>

            <div>
              <span>
                Time
              </span>

              <strong>
                {formatTime12(
                  created.startTime
                )}
                {" – "}
                {formatTime12(
                  created.endTime
                )}
              </strong>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-light"
            onClick={
              copyCredentials
            }
          >
            <Copy size={15} />

            {copied
              ? "Copied!"
              : "Copy login details"}
          </button>
        </div>
      )}

      {error && (
        <p className="error">
          {error}
        </p>
      )}

      {/* ======================================================
          PERSONAL INFO
      ====================================================== */}

      <div className="form-section-title">
        Personal info
      </div>

      <div className="form-grid">
        <label>
          Full Name

          <input
            type="text"
            value={
              form.fullName
            }
            onChange={(e) =>
              update(
                "fullName",
                e.target.value
              )
            }
            placeholder="Teacher full name"
            required
          />
        </label>

        <label>
          Phone

          <input
            type="text"
            value={
              form.phone
            }
            onChange={(e) =>
              update(
                "phone",
                e.target.value
              )
            }
            placeholder="061xxxxxxx"
          />
        </label>

        {isEdit && (
          <label>
            Username (login)

            <input
              type="text"
              value={
                editTeacher.username ||
                editTeacher.teacherId
              }
              readOnly
              disabled
            />
          </label>
        )}

        <label>
          Portal Password
          (Password-ka
          macalinka)

          <div
            style={{
              display:
                "flex",
              gap: 8,
            }}
          >
            <div
              className="input-icon"
              style={{
                flex: 1,
              }}
            >
              <KeyRound
                size={17}
              />

              <input
                type="text"
                value={
                  form.password
                }
                onChange={(e) =>
                  update(
                    "password",
                    e.target.value
                  )
                }
                placeholder="Maamulka ayaa gelinaya"
                autoComplete="new-password"
                required
              />
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              title="Samee password"
              onClick={() =>
                update(
                  "password",
                  generatePassword()
                )
              }
            >
              <Shuffle
                size={14}
              />
              Generate
            </button>
          </div>
        </label>
      </div>

      {!isEdit && (
        <p className="hint">
          Username-ka si toos ah
          ayaa loo sameeyaa
          (tusaale: ahmed482).
          Macalinku wuxuu Teacher
          Portal-ka ku galayaa
          username-kaas iyo
          password-ka aad halkan
          geliso.
        </p>
      )}

      {/* ======================================================
          CLASS + SUBJECT ASSIGNMENTS
      ====================================================== */}

      <div className="form-section-title">
        <BookOpen size={15} />
        Classes & Subjects
      </div>

      <div
        style={{
          marginBottom: 18,
          padding: 16,
          border:
            "1px solid #e2e8f0",
          borderRadius: 16,
          background:
            "#f8fafc",
        }}
      >
        {/* Header */}

        <div
          style={{
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "space-between",
            gap: 12,
            marginBottom:
              14,
            flexWrap:
              "wrap",
          }}
        >
          <div>
            <strong
              style={{
                display:
                  "block",
                fontSize: 16,
                color:
                  "#0f172a",
              }}
            >
              Assign Classes
              & Subjects
            </strong>

            <span
              style={{
                fontSize: 12,
                color:
                  "#64748b",
              }}
            >
              Hal macallin waxaa
              loo diri karaa
              classes badan,
              class kasta-na
              maadooyin gaar ah.
            </span>
          </div>

          <span
            style={{
              padding:
                "7px 12px",
              borderRadius:
                999,
              background:
                selectedClasses.length
                  ? "#dcfce7"
                  : "#f1f5f9",
              color:
                selectedClasses.length
                  ? "#166534"
                  : "#64748b",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {
              selectedClasses.length
            }{" "}
            class selected
          </span>
        </div>

        {/* ====================================================
            CLASS SELECTOR
        ==================================================== */}

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 10,
          }}
        >
          {CLASS_GROUPS.map(
            (className) => {
              const selected =
                selectedClasses.includes(
                  className
                );

              return (
                <button
                  key={
                    className
                  }
                  type="button"
                  onClick={() =>
                    toggleClass(
                      className
                    )
                  }
                  style={{
                    textAlign:
                      "left",
                    padding:
                      "14px 15px",
                    border:
                      selected
                        ? "2px solid #2563eb"
                        : "1px solid #dbe2ea",
                    borderRadius:
                      14,
                    background:
                      selected
                        ? "#eff6ff"
                        : "#ffffff",
                    color:
                      "#0f172a",
                    cursor:
                      "pointer",
                    transition:
                      "all .15s ease",
                    boxShadow:
                      selected
                        ? "0 3px 12px rgba(37,99,235,.10)"
                        : "none",
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "space-between",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontWeight:
                          700,
                        fontSize:
                          14,
                      }}
                    >
                      {
                        className
                      }
                    </span>

                    <span
                      style={{
                        width: 23,
                        height: 23,
                        borderRadius:
                          "50%",
                        border:
                          selected
                            ? "0"
                            : "1px solid #cbd5e1",
                        background:
                          selected
                            ? "#2563eb"
                            : "#fff",
                        color:
                          "#fff",
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        fontSize:
                          13,
                        fontWeight:
                          800,
                        flexShrink:
                          0,
                      }}
                    >
                      {selected
                        ? "✓"
                        : ""}
                    </span>
                  </div>
                </button>
              );
            }
          )}
        </div>

        {/* ====================================================
            SUBJECTS PER CLASS
        ==================================================== */}

        {selectedClasses.length >
          0 && (
          <div
            style={{
              marginTop:
                18,
              display:
                "flex",
              flexDirection:
                "column",
              gap: 12,
            }}
          >
            {selectedClasses.map(
              (className) => {
                const assignment =
                  assignments.find(
                    (item) =>
                      item.className ===
                      className
                  );

                const selectedSubjects =
                  assignment?.subjects ||
                  [];

                return (
                  <div
                    key={
                      className
                    }
                    style={{
                      padding:
                        15,
                      border:
                        "1px solid #dbe2ea",
                      borderRadius:
                        14,
                      background:
                        "#ffffff",
                    }}
                  >
                    {/* Class title */}

                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "space-between",
                        gap: 10,
                        marginBottom:
                          12,
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <div>
                        <strong
                          style={{
                            display:
                              "block",
                            fontSize:
                              15,
                            color:
                              "#0f172a",
                          }}
                        >
                          {
                            className
                          }
                        </strong>

                        <span
                          style={{
                            fontSize:
                              12,
                            color:
                              "#64748b",
                          }}
                        >
                          Dooro
                          maadooyinka
                          macallinku
                          class-kan
                          ka dhigi
                          doono.
                        </span>
                      </div>

                      <span
                        style={{
                          padding:
                            "5px 9px",
                          borderRadius:
                            999,
                          background:
                            selectedSubjects.length
                              ? "#dcfce7"
                              : "#fef2f2",
                          color:
                            selectedSubjects.length
                              ? "#166534"
                              : "#b91c1c",
                          fontSize:
                            11,
                          fontWeight:
                            700,
                        }}
                      >
                        {
                          selectedSubjects.length
                        }{" "}
                        subject
                        {selectedSubjects.length ===
                        1
                          ? ""
                          : "s"}
                      </span>
                    </div>

                    {/* Subject chips */}

                    <div
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(150px, 1fr))",
                        gap: 8,
                      }}
                    >
                      {SUBJECT_OPTIONS.map(
                        (subject) => {
                          const selected =
                            selectedSubjects.includes(
                              subject
                            );

                          return (
                            <button
                              key={
                                subject
                              }
                              type="button"
                              onClick={() =>
                                toggleSubject(
                                  className,
                                  subject
                                )
                              }
                              style={{
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "space-between",
                                gap: 8,
                                padding:
                                  "10px 12px",
                                borderRadius:
                                  11,
                                border:
                                  selected
                                    ? "2px solid #16a34a"
                                    : "1px solid #dbe2ea",
                                background:
                                  selected
                                    ? "#f0fdf4"
                                    : "#ffffff",
                                color:
                                  selected
                                    ? "#166534"
                                    : "#334155",
                                fontWeight:
                                  650,
                                cursor:
                                  "pointer",
                                textAlign:
                                  "left",
                              }}
                            >
                              <span>
                                {
                                  subject
                                }
                              </span>

                              {selected && (
                                <Check
                                  size={
                                    16
                                  }
                                />
                              )}
                            </button>
                          );
                        }
                      )}
                    </div>

                    {/* Selected subjects */}

                    {selectedSubjects.length >
                      0 && (
                      <div
                        style={{
                          marginTop:
                            11,
                          padding:
                            9,
                          borderRadius:
                            10,
                          background:
                            "#ecfdf5",
                          color:
                            "#166534",
                          fontSize:
                            12,
                          lineHeight:
                            1.6,
                        }}
                      >
                        <strong>
                          Assigned:
                        </strong>{" "}
                        {selectedSubjects.join(
                          " • "
                        )}
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* ======================================================
          ATTENDANCE DAYS
      ====================================================== */}

      <div className="form-section-title">
        <CalendarDays size={15} />
        Attendance days
        (maalmaha)
      </div>

      <div className="day-picker">
        {DAYS.map(
          (day) => (
            <button
              key={day}
              type="button"
              className={`day-chip ${
                form.attendanceDays.includes(
                  day
                )
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                toggleDay(day)
              }
            >
              {day.slice(
                0,
                3
              )}
            </button>
          )
        )}
      </div>

      {/* ======================================================
          ATTENDANCE TIME
      ====================================================== */}

      <div className="form-section-title">
        <Clock size={15} />
        Attendance time
        (goorta xaadirinta)
      </div>

      <div className="form-grid">
        <label>
          Start time

          <TimePicker12
            value={
              form.startTime
            }
            onChange={(value) =>
              update(
                "startTime",
                value
              )
            }
          />
        </label>

        <label>
          End time

          <TimePicker12
            value={
              form.endTime
            }
            onChange={(value) =>
              update(
                "endTime",
                value
              )
            }
          />
        </label>
      </div>

      <p className="hint">
        Dooro AM (subax) ama PM
        (galab). PM wuxuu ka
        bilaabmaa 12:00 duhurnimo.
        Tusaale: 1:00 PM = 13:00.
        Macallinku wuxuu qaadan
        karaa attendance-ka
        classes-ka loo xilsaaray.
      </p>

      {/* ======================================================
          BUTTONS
      ====================================================== */}

      <div
        style={{
          display:
            "flex",
          gap: 10,
          flexWrap:
            "wrap",
        }}
      >
        <button
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={saving}
        >
          {isEdit && (
            <Save size={16} />
          )}

          {saving
            ? "Saving..."
            : isEdit
            ? "Save Changes"
            : "Register Teacher"}
        </button>

        {isEdit && (
          <button
            type="button"
            className="btn btn-ghost btn-lg"
            onClick={
              onCancel
            }
            disabled={
              saving
            }
          >
            <X size={16} />
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
