// src/components/CashierActivityLog.jsx
// Admin → Cashiers: dhaqdhaqaaqa cashier-ka oo dhan (live).

import { useMemo, useState } from "react";
import { Activity, Search, LogIn, LogOut, DollarSign, Pencil, Printer } from "lucide-react";
import { ACTIVITY_TYPES } from "../utils/cashierActivity";
import { formatDate, todayStr } from "../utils/attendance";
import { money } from "../utils/payments";
import { LiveBadge } from "./PortalLayout";

const ICONS = { login: LogIn, logout: LogOut, payment: DollarSign, payment_edit: Pencil, receipt_print: Printer };

function when(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return { date: "", time: "just now" };
  return {
    date: formatDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

export default function CashierActivityLog({ activity, cashiers }) {
  const [cashierFilter, setCashierFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const today = todayStr();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activity.filter((a) => {
      if (cashierFilter && a.cashierId !== cashierFilter && a.targetCashierId !== cashierFilter) return false;
      if (typeFilter && a.type !== typeFilter) return false;
      if (!q) return true;
      return [a.cashierName, a.summary, a.receiptNo, a.studentName, a.studentId]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [activity, cashierFilter, typeFilter, search]);

  const todayRows = activity.filter((a) => a.date === today);
  const count = (type) => todayRows.filter((a) => a.type === type).length;

  return (
    <div className="panel">
      <div className="section-head">
        <div>
          <h2>Cashier activity log</h2>
          <p>Wax kasta oo cashier-ku sameeyo — gelitaan, lacag qaadasho, wax ka beddel iyo daabacaad.</p>
        </div>
        <LiveBadge />
      </div>

      <div className="stat-grid">
        <div className="stat-card tone-blue">
          <span className="stat-icon"><LogIn size={20} /></span>
          <span className="stat-label">Logins today<em>Gelitaan maanta</em></span>
          <strong className="stat-value">{count("login")}</strong>
        </div>
        <div className="stat-card tone-green">
          <span className="stat-icon"><DollarSign size={20} /></span>
          <span className="stat-label">Payments today<em>Lacag qaadasho</em></span>
          <strong className="stat-value">{count("payment")}</strong>
        </div>
        <div className="stat-card tone-amber">
          <span className="stat-icon"><Pencil size={20} /></span>
          <span className="stat-label">Edits today<em>Wax ka beddel</em></span>
          <strong className="stat-value">{count("payment_edit")}</strong>
        </div>
        <div className="stat-card tone-violet">
          <span className="stat-icon"><Activity size={20} /></span>
          <span className="stat-label">All actions today<em>Dhammaan</em></span>
          <strong className="stat-value">{todayRows.length}</strong>
        </div>
      </div>

      <div className="filter-bar">
        <select value={cashierFilter} onChange={(e) => setCashierFilter(e.target.value)}>
          <option value="">All cashiers</option>
          {cashiers.map((c) => (
            <option key={c.id} value={c.id}>{c.fullName} — {c.email || c.username || c.id}</option>
          ))}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All actions</option>
          {Object.entries(ACTIVITY_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <div className="search-box">
          <Search size={16} />
          <input placeholder="Search student, receipt or details" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty"><Activity size={34} /><strong>No activity yet</strong></div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Cashier</th>
                <th>Action</th>
                <th>Details</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const meta = ACTIVITY_TYPES[a.type] || { label: a.type, tone: "gray" };
                const Icon = ICONS[a.type] || Activity;
                const w = when(a.createdAt);
                return (
                  <tr key={a.id}>
                    <td>
                      <strong>{w.time}</strong>
                      <div className="muted-sm">{w.date || formatDate(a.date)}</div>
                    </td>
                    <td>
                      <strong>{a.cashierName || "—"}</strong>
                      {a.actorRole === "admin" && <div className="muted-sm">Admin</div>}
                    </td>
                    <td>
                      <span className={`pill pill-${meta.tone}`}>
                        <Icon size={12} /> {meta.label}
                      </span>
                    </td>
                    <td>
                      {a.summary || "—"}
                      {a.receiptNo && <div className="muted-sm">{a.receiptNo}</div>}
                    </td>
                    <td>{a.amount != null ? <strong className="txt-green">{money(a.amount)}</strong> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}