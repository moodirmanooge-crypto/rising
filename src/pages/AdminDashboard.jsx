import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import StudentForm from "../components/StudentForm";
import TeacherForm from "../components/TeacherForm";
import { getAllAttendance } from "../utils/attendance";
import { STUDENTS_COLLECTION, TEACHERS_COLLECTION } from "../config/collections";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [tab, setTab] = useState("students");

  useEffect(() => {
    const q = query(collection(db, STUDENTS_COLLECTION), orderBy("studentId"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setStudents(snap.docs.map((d) => d.data()));
        setLoadingStudents(false);
      },
      () => setLoadingStudents(false)
    );
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, TEACHERS_COLLECTION), orderBy("teacherId"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTeachers(snap.docs.map((d) => d.data()));
        setLoadingTeachers(false);
      },
      () => setLoadingTeachers(false)
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (tab !== "attendance") return;
    setLoadingAttendance(true);
    getAllAttendance()
      .then(setAttendance)
      .finally(() => setLoadingAttendance(false));
  }, [tab]);

  const studentNameById = Object.fromEntries(students.map((s) => [s.studentId, s.fullName]));

  return (
    <div className="portal">
      <header className="portal-header">
        <div className="portal-header-title">
          <img src="/logo.png" alt="Rising Star School" className="portal-logo" />
          <h1>Admin Portal — welcome, {user?.fullName || user?.username}</h1>
        </div>
        <button onClick={logout}>Log out</button>
      </header>

      <div className="tabs">
        <button
          className={tab === "students" ? "tab active" : "tab"}
          onClick={() => setTab("students")}
        >
          Students ({students.length})
        </button>
        <button
          className={tab === "teachers" ? "tab active" : "tab"}
          onClick={() => setTab("teachers")}
        >
          Teachers ({teachers.length})
        </button>
        <button
          className={tab === "attendance" ? "tab active" : "tab"}
          onClick={() => setTab("attendance")}
        >
          Attendance
        </button>
      </div>

      {tab === "students" && (
        <>
          <StudentForm />
          <div className="card">
            <h2>All Students ({students.length})</h2>
            {loadingStudents ? (
              <p>Loading...</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Photo</th>
                      <th>ID</th>
                      <th>Full Name</th>
                      <th>Mother's Name</th>
                      <th>Student Phone</th>
                      <th>Parent Phone</th>
                      <th>Subjects</th>
                      <th>Shift</th>
                      <th>Fee Type</th>
                      <th>Reg. Fee</th>
                      <th>Monthly Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.studentId}>
                        <td>
                          {s.photoUrl ? (
                            <img src={s.photoUrl} alt={s.fullName} className="avatar" />
                          ) : (
                            <span className="avatar avatar-placeholder">🎓</span>
                          )}
                        </td>
                        <td>{s.studentId}</td>
                        <td>{s.fullName}</td>
                        <td>{s.motherName}</td>
                        <td>{s.studentPhone}</td>
                        <td>{s.parentPhone}</td>
                        <td>{Array.isArray(s.subjects) ? s.subjects.join(", ") : s.subjects}</td>
                        <td>{s.shift}</td>
                        <td>{s.feeType}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "teachers" && (
        <>
          <TeacherForm />
          <div className="card">
            <h2>All Teachers ({teachers.length})</h2>
            {loadingTeachers ? (
              <p>Loading...</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Full Name</th>
                      <th>Username</th>
                      <th>Phone</th>
                      <th>Subjects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((t) => (
                      <tr key={t.teacherId}>
                        <td>{t.teacherId}</td>
                        <td>{t.fullName}</td>
                        <td>{t.username}</td>
                        <td>{t.phone}</td>
                        <td>{Array.isArray(t.subjects) ? t.subjects.join(", ") : t.subjects}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "attendance" && (
        <div className="card">
          <h2>Attendance — all records ({attendance.length})</h2>
          {loadingAttendance ? (
            <p>Loading...</p>
          ) : attendance.length === 0 ? (
            <p>No attendance recorded yet.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Student ID</th>
                    <th>Full Name</th>
                    <th>Status</th>
                    <th>Marked by (Teacher ID)</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((r) => (
                    <tr key={`${r.studentId}_${r.date}`}>
                      <td>{r.date}</td>
                      <td>{r.studentId}</td>
                      <td>{studentNameById[r.studentId] || "—"}</td>
                      <td>
                        <span className={`pill ${r.status === "present" ? "pill-green" : "pill-red"}`}>
                          {r.status === "present" ? "Present" : "Absent"}
                        </span>
                      </td>
                      <td>{r.teacherId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}