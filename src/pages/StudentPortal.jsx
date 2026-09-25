import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getStudentAttendance } from "../utils/attendance";

export default function StudentPortal() {
  const { user, logout } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.studentId) return;
    getStudentAttendance(user.studentId)
      .then(setRecords)
      .finally(() => setLoading(false));
  }, [user?.studentId]);

  const presentCount = records.filter((r) => r.status === "present").length;
  const absentCount = records.filter((r) => r.status === "absent").length;

  return (
    <div className="portal">
      <header className="portal-header">
        <div className="portal-header-title">
          <img src="/logo.png" alt="Rising Star School" className="portal-logo" />
          <h1>Student Portal</h1>
        </div>
        <button onClick={logout}>Log out</button>
      </header>

      <div className="card profile-card">
        {user?.photoUrl ? (
          <img src={user.photoUrl} alt={user.fullName} className="avatar avatar-lg" />
        ) : (
          <span className="avatar avatar-lg avatar-placeholder">🎓</span>
        )}
        <div>
          <h2 style={{ margin: 0 }}>{user?.fullName}</h2>
          <p style={{ margin: "4px 0 0", color: "#667085" }}>Student ID: {user?.studentId}</p>
        </div>
      </div>

      <div className="card">
        <h2>My Attendance</h2>
        <p>
          <span className="pill pill-green">Present: {presentCount}</span>{" "}
          <span className="pill pill-red">Absent: {absentCount}</span>
        </p>
        {loading ? (
          <p>Loading...</p>
        ) : records.length === 0 ? (
          <p>No attendance recorded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.date}>
                  <td>{r.date}</td>
                  <td>
                    <span className={`pill ${r.status === "present" ? "pill-green" : "pill-red"}`}>
                      {r.status === "present" ? "Present" : "Absent"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
