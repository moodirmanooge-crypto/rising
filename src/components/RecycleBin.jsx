// src/components/RecycleBin.jsx
// Admin → Recycle Bin: ardayda la tirtiray. Dib u soo celi ama gacanta ugu tirtir.

import { useMemo, useState } from "react";
import { Trash2, RotateCcw, Search, Info } from "lucide-react";
import { restoreStudent, deleteStudentForever } from "../utils/recycleBin";
import { studentGroups } from "../config/schoolOptions";
import { initials } from "./PortalLayout";

function deletedWhen(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return "just now";
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} • ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

export default function RecycleBin({ items, onNote }) {
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => String(i.fullName || "").toLowerCase().includes(q) || String(i.studentId).includes(q)
    );
  }, [items, search]);

  async function restore(item) {
    setError("");
    setBusyId(item.id);
    try {
      await restoreStudent(item);
      onNote?.(`✓ ${item.fullName} (ID ${item.studentId}) waa dib loo soo celiyay Student List.`);
    } catch (err) {
      setError(err.message || "Lama soo celin karo.");
    } finally {
      setBusyId("");
    }
  }

  async function forever(item) {
    const ok = window.confirm(
      `Ma tirtiraysaa ${item.fullName} (ID ${item.studentId}) WELIGIIS?\n\nXogtiisa database-ka waa laga saarayaa, dib looguma soo celin karo.`
    );
    if (!ok) return;
    setError("");
    setBusyId(item.id);
    try {
      await deleteStudentForever(item);
      onNote?.(`${item.fullName} (ID ${item.studentId}) waa la tirtiray weligiis.`);
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
          Ardayda halkan jira database-ka way ku sugan yihiin, laakiin ma gali karaan portal-ka, Student List-kana kama muuqdaan.
          Dib u soo celi si ay ugu laabtaan, ama "Delete forever" si aad gacanta ugu tirtirto.
        </span>
      </p>

      <div className="panel">
        <div className="section-head">
          <h2>Recycle Bin <span className="muted-sm">({items.length})</span></h2>
          <div className="search-box">
            <Search size={16} />
            <input placeholder="Search name or ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        {shown.length === 0 ? (
          <div className="empty">
            <Trash2 size={34} />
            <strong>Recycle Bin is empty</strong>
          </div>
        ) : (
          <div className="table-scroll fit">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Deleted</th>
                  <th>Deleted by</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <div className="cell-person">
                        {i.student?.photoUrl ? (
                          <img src={i.student.photoUrl} alt={i.fullName} className="avatar" />
                        ) : (
                          <span className="avatar avatar-placeholder">{initials(i.fullName)}</span>
                        )}
                        <div className="cell-stack">
                          <strong>{i.fullName}</strong>
                          <span className="id-chip">ID {i.studentId}</span>
                        </div>
                      </div>
                    </td>
                    <td>{studentGroups(i.student || {}).join(", ") || "—"}</td>
                    <td>{deletedWhen(i.deletedAt)}</td>
                    <td>{i.deletedBy || "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" className="btn btn-primary btn-sm" disabled={busyId === i.id} onClick={() => restore(i)}>
                          <RotateCcw size={14} /> Restore
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === i.id} onClick={() => forever(i)}>
                          <Trash2 size={14} /> Delete forever
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}