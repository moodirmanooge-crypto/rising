// src/components/RecycleBin.jsx
// Admin → Recycle Bin: ardayda IYO macallimiinta la tirtiray.
//  • Restore         → dib ayay ugu laabanayaan, portal-kuna wuu u shaqeynayaa
//  • Delete forever  → app-ka oo dhan way ka baxayaan, database-ka way ku
//                      sii jiraan (permanentlyDeleted: true). Haddii Firestore-ka
//                      looga beddelo false, dib ayay halkan ugu soo laabanayaan.

import { useMemo, useState } from "react";
import { Trash2, RotateCcw, Search, Info, GraduationCap, BookOpen, AlertTriangle, X } from "lucide-react";
import {
  restoreStudent, deleteStudentForever, restoreTeacher, deleteTeacherForever,
} from "../utils/recycleBin";
import { studentGroups } from "../config/schoolOptions";
import { teacherAssignments } from "../utils/teacherClasses";
import { initials } from "./PortalLayout";
import "../styles/teachers.css";

function deletedWhen(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return "just now";
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} • ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

export default function RecycleBin({ items = [], teacherItems = [], onNote, adminName }) {
  const [tab, setTab] = useState("students");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(null); // { item, kind }

  const isTeachers = tab === "teachers";
  const list = isTeachers ? teacherItems : items;

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((i) =>
      [i.fullName, i.studentId, i.username].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [list, search]);

  const label = (i, kind) => (kind === "teacher" ? `${i.fullName} (@${i.username})` : `${i.fullName} (ID ${i.studentId})`);

  async function restore(item, kind) {
    setError("");
    setBusyId(item.id);
    try {
      if (kind === "teacher") {
        await restoreTeacher(item);
        onNote?.(`✓ ${label(item, kind)} waa dib loo soo celiyay Teacher List — portal-ka hadda wuu geli karaa.`);
      } else {
        await restoreStudent(item);
        onNote?.(`✓ ${label(item, kind)} waa dib loo soo celiyay Student List.`);
      }
    } catch (err) {
      setError(err.message || "Lama soo celin karo.");
    } finally {
      setBusyId("");
    }
  }

  async function forever() {
    const { item, kind } = confirm;
    setError("");
    setBusyId(item.id);
    try {
      if (kind === "teacher") await deleteTeacherForever(item, adminName);
      else await deleteStudentForever(item, adminName);
      onNote?.(`${label(item, kind)} waa laga tirtiray app-ka weligiis (database-ka wuu ku jiraa: permanentlyDeleted = true).`);
      setConfirm(null);
    } catch (err) {
      setError(err.message || "Lama tirtiri karin.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="stack">
      <p className="banner banner-blue" style={{ margin: 0 }}>
        <Info size={18} />
        <span>
          Ardayda iyo macallimiinta halkan jira portal-ka ma geli karaan, liisaskana kama muuqdaan. <b>Restore</b> si ay
          ugu laabtaan. <b>Delete forever</b> app-ka ayay ka baxayaan, laakiin database-ka way ku sii jiraan
          (<code>permanentlyDeleted: true</code>) — haddii aad Firestore-ka ka dhigto <code>false</code>, halkan ayay dib
          ugu soo laabanayaan.
        </span>
      </p>

      <div className="panel">
        <div className="section-head">
          <div className="tl-chips">
            <button type="button" className={`tl-chip ${!isTeachers ? "active" : ""}`} onClick={() => setTab("students")}>
              <GraduationCap size={13} style={{ verticalAlign: "-2px" }} /> Students ({items.length})
            </button>
            <button type="button" className={`tl-chip ${isTeachers ? "active" : ""}`} onClick={() => setTab("teachers")}>
              <BookOpen size={13} style={{ verticalAlign: "-2px" }} /> Teachers ({teacherItems.length})
            </button>
          </div>
          <div className="search-box">
            <Search size={16} />
            <input
              placeholder={isTeachers ? "Search name or username" : "Search name or ID"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        {shown.length === 0 ? (
          <div className="empty">
            <Trash2 size={34} />
            <strong>{isTeachers ? "No teachers in the Recycle Bin" : "No students in the Recycle Bin"}</strong>
          </div>
        ) : (
          <div className="table-scroll fit">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>{isTeachers ? "Teacher" : "Student"}</th>
                  <th>{isTeachers ? "Classes" : "Class"}</th>
                  <th>Deleted</th>
                  <th>Deleted by</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((i) => {
                  const kind = isTeachers ? "teacher" : "student";
                  const photo = isTeachers ? null : i.student?.photoUrl;
                  return (
                    <tr key={i.id}>
                      <td>
                        <div className="cell-person">
                          {photo ? (
                            <img src={photo} alt={i.fullName} className="avatar" />
                          ) : (
                            <span className={`avatar avatar-placeholder ${isTeachers ? "amber" : ""}`}>{initials(i.fullName)}</span>
                          )}
                          <div className="cell-stack">
                            <strong>{i.fullName}</strong>
                            <span className="id-chip">{isTeachers ? `@${i.username}` : `ID ${i.studentId}`}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {isTeachers
                          ? teacherAssignments(i.teacher || {}).map((a) => a.className).join(", ") || "—"
                          : studentGroups(i.student || {}).join(", ") || "—"}
                      </td>
                      <td>{deletedWhen(i.deletedAt)}</td>
                      <td>{i.deletedBy || "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" className="btn btn-primary btn-sm" disabled={busyId === i.id} onClick={() => restore(i, kind)}>
                            <RotateCcw size={14} /> Restore
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === i.id} onClick={() => setConfirm({ item: i, kind })}>
                            <Trash2 size={14} /> Delete forever
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirm && (
        <div className="modal-backdrop" onClick={() => !busyId && setConfirm(null)}>
          <div className="modal tl-del-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <button type="button" className="tl-del-close" onClick={() => setConfirm(null)} disabled={!!busyId} aria-label="Close">
              <X size={18} />
            </button>
            <div className="tl-del-icon"><AlertTriangle size={26} /></div>
            <h3>Delete forever?</h3>
            <p>
              <b>{label(confirm.item, confirm.kind)}</b>
            </p>
            <ul className="tl-del-list">
              <li>App-ka oo dhan wuu ka baxayaa — Recycle Bin-ka-na kama muuqanayo.</li>
              <li>Portal-ka weligiis ma geli karo.</li>
              <li>
                Database-ka wuu ku sii jirayaa: <code>permanentlyDeleted: true</code>. Haddii aad Firestore-ka ka dhigto{" "}
                <code>false</code>, Recycle Bin-ka ayuu dib ugu soo laabanayaa.
              </li>
            </ul>
            <div className="tl-del-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)} disabled={!!busyId}>
                Cancel
              </button>
              <button type="button" className="btn tl-del-confirm" onClick={forever} disabled={!!busyId}>
                <Trash2 size={15} /> {busyId ? "Deleting..." : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}