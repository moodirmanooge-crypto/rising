// src/components/CashierTotals.jsx
// Admin → Cashiers: wadarta lacagta ardayda ka soo gashay iyo intii cashier kasta qaaday (live).

import { Fragment, useMemo, useState } from "react";
import { Wallet, DollarSign, CalendarDays, GraduationCap, Users, Target, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { money, formatMonth } from "../utils/payments";
import { formatDate, formatTimestamp, todayStr } from "../utils/attendance";
import { LiveBadge, initials } from "./PortalLayout";

export default function CashierTotals({ students = [], payments, cashiers, lastSeenByCashier = {} }) {
  const [openId, setOpenId] = useState(null);
  const today = todayStr();
  const thisMonth = today.slice(0, 7);

  const data = useMemo(() => {
    const amt = (p) => Number(p.amount || 0);
    const total = payments.reduce((s, p) => s + amt(p), 0);
    const todayTotal = payments.filter((p) => p.date === today).reduce((s, p) => s + amt(p), 0);
    const monthTotal = payments
      .filter((p) => String(p.date || "").slice(0, 7) === thisMonth)
      .reduce((s, p) => s + amt(p), 0);
    // Ardayda diiwaan gashan iyo lacagta bishan laga rabo dhammaantood
    const expected = students.reduce((s, st) => s + (Number(st.monthlyFee) || 0), 0);
    const payers = students.filter((st) => Number(st.monthlyFee) > 0).length;
    const paidBy = {};
    let feeCollected = 0;
    payments.forEach((p) => {
      if (p.month !== thisMonth) return;
      paidBy[p.studentId] = (paidBy[p.studentId] || 0) + amt(p);
      feeCollected += amt(p);
    });
    const outstanding = students.reduce(
      (s, st) => s + Math.max(0, (Number(st.monthlyFee) || 0) - (paidBy[st.studentId] || 0)),
      0
    );
    const percent = expected ? Math.min(100, Math.round((feeCollected / expected) * 100)) : 0;
    const studentsPaid = new Set(payments.map((p) => String(p.studentId))).size;

    // Cashier kasta (xitaa kuwa aan weli lacag qaadin) + rasiidyada cashier la tirtiray
    const map = {};
    cashiers.forEach((c) => {
      map[c.id] = { id: c.id, name: c.fullName, email: c.email || c.username || "", active: c.active !== false, total: 0, today: 0, count: 0, students: new Set(), byStudent: {} };
    });
    payments.forEach((p) => {
      const key = p.cashierId || p.cashierEmail || p.cashierName || "unknown";
      if (!map[key]) {
        map[key] = { id: key, name: p.cashierName || "Unknown", email: p.cashierEmail || "", active: false, removed: true, total: 0, today: 0, count: 0, students: new Set(), byStudent: {} };
      }
      const r = map[key];
      r.total += amt(p);
      r.count += 1;
      r.students.add(String(p.studentId));
      if (p.date === today) r.today += amt(p);
      const sid = String(p.studentId);
      const b = (r.byStudent[sid] = r.byStudent[sid] || { id: sid, name: p.studentName || "", total: 0, count: 0, last: "" });
      b.total += amt(p);
      b.count += 1;
      if (String(p.date || "") > b.last) b.last = String(p.date || "");
    });
    const rows = Object.values(map).sort((a, b) => b.total - a.total);
    return { total, todayTotal, monthTotal, studentsPaid, rows, expected, payers, feeCollected, outstanding, percent };
  }, [students, payments, cashiers, today, thisMonth]);

  return (
    <div className="panel">
      <div className="section-head">
        <div>
          <h2>Money received & cashier totals</h2>
          <p>Wadarta lacagta ardayda ka soo gashay iyo intii cashier kasta qaaday</p>
        </div>
        <LiveBadge />
      </div>

      <div className="stat-grid">
        <div className="stat-card tone-blue">
          <span className="stat-icon"><GraduationCap size={20} /></span>
          <span className="stat-label">Registered students<em>{data.payers} pay a fee</em></span>
          <strong className="stat-value">{students.length}</strong>
        </div>
        <div className="stat-card tone-violet">
          <span className="stat-icon"><Target size={20} /></span>
          <span className="stat-label">Total to collect<em>Lacagta laga rabo / bishii</em></span>
          <strong className="stat-value">{money(data.expected)}</strong>
        </div>
        <div className="stat-card tone-green">
          <span className="stat-icon"><Wallet size={20} /></span>
          <span className="stat-label">Collected for {formatMonth(thisMonth)}<em>La qaaday ({data.percent}%)</em></span>
          <strong className="stat-value">{money(data.feeCollected)}</strong>
        </div>
        <div className="stat-card tone-red">
          <span className="stat-icon"><AlertCircle size={20} /></span>
          <span className="stat-label">Still outstanding<em>Wali lama bixin</em></span>
          <strong className="stat-value">{money(data.outstanding)}</strong>
        </div>
      </div>

      <div className="stat-grid" style={{ marginTop: 14 }}>
        <div className="stat-card tone-green">
          <span className="stat-icon"><Wallet size={20} /></span>
          <span className="stat-label">Total received<em>Wadarta guud</em></span>
          <strong className="stat-value">{money(data.total)}</strong>
        </div>
        <div className="stat-card tone-blue">
          <span className="stat-icon"><CalendarDays size={20} /></span>
          <span className="stat-label">{formatMonth(thisMonth)}<em>Bishan la qaaday</em></span>
          <strong className="stat-value">{money(data.monthTotal)}</strong>
        </div>
        <div className="stat-card tone-violet">
          <span className="stat-icon"><DollarSign size={20} /></span>
          <span className="stat-label">Today<em>Maanta</em></span>
          <strong className="stat-value">{money(data.todayTotal)}</strong>
        </div>
        <div className="stat-card tone-amber">
          <span className="stat-icon"><GraduationCap size={20} /></span>
          <span className="stat-label">Students who paid<em>Ardayda bixisay</em></span>
          <strong className="stat-value">{data.studentsPaid}</strong>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: "1rem" }}><Users size={16} /> Collected by each cashier <span className="muted-sm">— guji cashier si aad u aragto ardayda uu ka qaaday</span></h2>
      </div>

      {data.rows.length === 0 ? (
        <p className="muted">No cashiers yet.</p>
      ) : (
        <div className="table-scroll fit">
          <table className="compact-table">
            <thead>
              <tr>
                <th>Cashier</th>
                <th>Total collected</th>
                <th>Share</th>
                <th>Today</th>
                <th>Payments</th>
                <th>Students</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const seen = lastSeenByCashier[r.id];
                const share = data.total ? Math.round((r.total / data.total) * 100) : 0;
                const isOpen = openId === r.id;
                const people = Object.values(r.byStudent).sort((a, b) => b.total - a.total);
                return (
                  <Fragment key={r.id}>
                  <tr style={{ cursor: "pointer" }} onClick={() => setOpenId(isOpen ? null : r.id)}>
                    <td>
                      <div className="cell-person">
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span className="avatar avatar-placeholder">{initials(r.name)}</span>
                        <div className="cell-stack">
                          <strong>{r.name}</strong>
                          <span className="muted-sm">
                            {r.email}{r.removed ? " • account removed" : !r.active ? " • disabled" : ""}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td><strong className="txt-green">{money(r.total)}</strong></td>
                    <td style={{ minWidth: 110 }}>
                      <div style={{ height: 8, borderRadius: 99, background: "var(--line)" }}>
                        <div style={{ width: `${share}%`, height: "100%", borderRadius: 99, background: "var(--accent)" }} />
                      </div>
                      <span className="muted-sm">{share}%</span>
                    </td>
                    <td>{money(r.today)}</td>
                    <td>{r.count}</td>
                    <td>{r.students.size}</td>
                    <td>
                      {seen ? (
                        <>
                          <strong>{seen.summary ? seen.type.replace("_", " ") : seen.type}</strong>
                          <div className="muted-sm">
                            {formatDate(seen.date)} {formatTimestamp(seen.createdAt) && `• ${formatTimestamp(seen.createdAt)}`}
                          </div>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} style={{ background: "#fafcfb" }}>
                        {people.length === 0 ? (
                          <span className="muted">Wali lacag ma qaadin.</span>
                        ) : (
                          <table className="compact-table">
                            <thead>
                              <tr><th>Student</th><th>ID</th><th>Paid to {r.name}</th><th>Payments</th><th>Last payment</th></tr>
                            </thead>
                            <tbody>
                              {people.map((b) => (
                                <tr key={b.id}>
                                  <td><strong>{b.name || "—"}</strong></td>
                                  <td><span className="id-chip">{b.id}</span></td>
                                  <td><strong className="txt-green">{money(b.total)}</strong></td>
                                  <td>{b.count}</td>
                                  <td>{b.last ? formatDate(b.last) : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}