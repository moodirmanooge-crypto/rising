import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

import {
  getTodaySession,
  saveTodayAttendance,
  todayStr,
} from "../utils/attendance";

const STUDENTS_COLLECTION = "students1";

const DAYS = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

function getTodayDayName() {
  const jsDay = new Date().getDay();

  // JavaScript:
  // Sunday = 0
  // Monday = 1
  // ...
  // Saturday = 6

  const map = {
    0: "Sunday",
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
  };

  return map[jsDay];
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export default function TeacherPortal() {
  const { user, logout } = useAuth();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [statuses, setStatuses] = useState({});

  const [session, setSession] = useState(undefined);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const today = getTodayDayName();

  /*
   * Teacher information
   */
  const teacherClass =
    user?.className ||
    user?.class ||
    "";

  const teacherSubject =
    user?.subject ||
    (user?.subjects?.length
      ? user.subjects[0]
      : "");

  const teacherAttendanceDay =
    user?.attendanceDay || "";

  /*
   * Read students1
   */
  useEffect(() => {
    setLoading(true);

    const q = query(
      collection(db, STUDENTS_COLLECTION),
      orderBy("studentId")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setStudents(list);

        setStatuses((previous) => {
          const next = { ...previous };

          list.forEach((student) => {
            if (!next[student.studentId]) {
              next[student.studentId] = "present";
            }
          });

          return next;
        });

        setLoading(false);
      },
      (err) => {
        console.error("students1 error:", err);
        setError(
          "Unable to load students from students1."
        );
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  /*
   * Get today's attendance session
   */
  useEffect(() => {
    if (!user?.id && !user?.teacherId) return;

    const teacherId =
      user?.teacherId || user?.id;

    getTodaySession(teacherId)
      .then((result) => {
        setSession(result);
      })
      .catch((err) => {
        console.error(err);
        setSession(null);
      });
  }, [user?.id, user?.teacherId]);

  /*
   * Filter students:
   *
   * 1. Same class
   * 2. Same subject
   */
  const visibleStudents = useMemo(() => {
    if (!teacherClass || !teacherSubject) {
      return [];
    }

    return students.filter((student) => {
      const studentClass =
        student.className ||
        student.class ||
        student.studentClass ||
        "";

      const studentSubjects =
        Array.isArray(student.subjects)
          ? student.subjects
          : student.subject
          ? [student.subject]
          : [];

      const sameClass =
        normalize(studentClass) ===
        normalize(teacherClass);

      const sameSubject =
        studentSubjects.some(
          (subject) =>
            normalize(subject) ===
            normalize(teacherSubject)
        );

      return sameClass && sameSubject;
    });
  }, [
    students,
    teacherClass,
    teacherSubject,
  ]);

  function setStatus(studentId, status) {
    setStatuses((previous) => ({
      ...previous,
      [studentId]: status,
    }));
  }

  async function handleSave() {
    setError("");
    setSaving(true);

    try {
      const teacherId =
        user?.teacherId || user?.id;

      if (!teacherId) {
        throw new Error(
          "Teacher ID is missing."
        );
      }

      if (!teacherClass) {
        throw new Error(
          "Teacher class is missing."
        );
      }

      if (!teacherSubject) {
        throw new Error(
          "Teacher subject is missing."
        );
      }

      /*
       * Check selected attendance day
       */
      if (
        teacherAttendanceDay &&
        normalize(teacherAttendanceDay) !==
          normalize(today)
      ) {
        throw new Error(
          `Today is ${today}. Your attendance day is ${teacherAttendanceDay}.`
        );
      }

      const toSave = {};

      visibleStudents.forEach((student) => {
        toSave[student.studentId] =
          statuses[student.studentId] ||
          "present";
      });

      await saveTodayAttendance(
        teacherId,
        toSave,
        {
          teacherName:
            user?.fullName ||
            user?.username ||
            "",
          className: teacherClass,
          subject: teacherSubject,
          attendanceDay: today,
        }
      );

      const updatedSession =
        await getTodaySession(teacherId);

      setSession(updatedSession);
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Failed to save attendance."
      );
    } finally {
      setSaving(false);
    }
  }

  const alreadySubmitted = !!session;

  const attendanceDayMatches =
    !teacherAttendanceDay ||
    normalize(teacherAttendanceDay) ===
      normalize(today);

  return (
    <div className="portal">
      <header className="portal-header">
        <div className="portal-header-title">
          <img
            src="/logo.png"
            alt="Rising Star School"
            className="portal-logo"
          />

          <div>
            <h1>
              Teacher Portal
            </h1>

            <p>
              Welcome,{" "}
              <strong>
                {user?.fullName ||
                  user?.username}
              </strong>
            </p>
          </div>
        </div>

        <button onClick={logout}>
          Log out
        </button>
      </header>

      <div className="card">
        <h2>
          Attendance — {today}
        </h2>

        <div className="teacher-info">
          <p>
            <strong>Teacher:</strong>{" "}
            {user?.fullName ||
              user?.username}
          </p>

          <p>
            <strong>Class:</strong>{" "}
            {teacherClass || "Not assigned"}
          </p>

          <p>
            <strong>Subject:</strong>{" "}
            {teacherSubject || "Not assigned"}
          </p>

          <p>
            <strong>Attendance Day:</strong>{" "}
            {teacherAttendanceDay ||
              "Every day"}
          </p>
        </div>

        {!attendanceDayMatches && (
          <div className="error">
            <strong>
              Attendance is not available today.
            </strong>

            <p>
              Today is <strong>{today}</strong>.
              Your assigned attendance day is{" "}
              <strong>
                {teacherAttendanceDay}
              </strong>.
            </p>
          </div>
        )}

        {alreadySubmitted ? (
          <p className="success">
            Attendance for today has already
            been saved (
            {session.studentCount} students).
            Marking is locked until tomorrow.
          </p>
        ) : attendanceDayMatches ? (
          <p>
            Mark each student as Present or
            Absent, then save once for today.
          </p>
        ) : null}

        {error && (
          <p className="error">
            {error}
          </p>
        )}

        {loading ? (
          <p>Loading students...</p>
        ) : (
          <>
            {visibleStudents.length === 0 ? (
              <div className="error">
                <strong>
                  No students found.
                </strong>

                <p>
                  No students were found in{" "}
                  <strong>students1</strong>{" "}
                  for:
                </p>

                <p>
                  Class:{" "}
                  <strong>
                    {teacherClass}
                  </strong>
                  <br />

                  Subject:{" "}
                  <strong>
                    {teacherSubject}
                  </strong>
                </p>
              </div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Photo</th>
                      <th>Student ID</th>
                      <th>Full Name</th>
                      <th>Class</th>
                      <th>Attendance</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleStudents.map(
                      (student, index) => {
                        const studentClass =
                          student.className ||
                          student.class ||
                          student.studentClass ||
                          "";

                        return (
                          <tr
                            key={
                              student.studentId ||
                              student.id
                            }
                          >
                            <td>
                              {index + 1}
                            </td>

                            <td>
                              {student.photoUrl ? (
                                <img
                                  src={
                                    student.photoUrl
                                  }
                                  alt={
                                    student.fullName
                                  }
                                  className="avatar"
                                />
                              ) : (
                                <span className="avatar avatar-placeholder">
                                  🎓
                                </span>
                              )}
                            </td>

                            <td>
                              {student.studentId}
                            </td>

                            <td>
                              {student.fullName}
                            </td>

                            <td>
                              {studentClass}
                            </td>

                            <td>
                              <div className="toggle-group">
                                <button
                                  type="button"
                                  className={`toggle-btn present ${
                                    statuses[
                                      student
                                        .studentId
                                    ] ===
                                    "present"
                                      ? "active"
                                      : ""
                                  }`}
                                  disabled={
                                    alreadySubmitted ||
                                    !attendanceDayMatches
                                  }
                                  onClick={() =>
                                    setStatus(
                                      student.studentId,
                                      "present"
                                    )
                                  }
                                >
                                  Present
                                </button>

                                <button
                                  type="button"
                                  className={`toggle-btn absent ${
                                    statuses[
                                      student
                                        .studentId
                                    ] ===
                                    "absent"
                                      ? "active"
                                      : ""
                                  }`}
                                  disabled={
                                    alreadySubmitted ||
                                    !attendanceDayMatches
                                  }
                                  onClick={() =>
                                    setStatus(
                                      student.studentId,
                                      "absent"
                                    )
                                  }
                                >
                                  Absent
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {!alreadySubmitted &&
          !loading &&
          visibleStudents.length > 0 &&
          attendanceDayMatches && (
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ marginTop: 16 }}
            >
              {saving
                ? "Saving..."
                : "Save Today's Attendance"}
            </button>
          )}
      </div>
    </div>
  );
}