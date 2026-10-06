// src/components/CashierClasses.jsx
//
// Cashier Portal → Classes: fasal kasta, ardayda ku jirta, iyo lacagta bisha.
// Cashier-ku halkan ayuu ka qaadi karaa lacagta (Receive) sida Monthly Fees.

import { useMemo, useState } from "react";
import { Users, Search, Layers } from "lucide-react";
import { CLASSES, studentInClass, studentInSub } from "../config/schoolOptions";
import { money } from "../utils/payments";
import FeeRow from "./FeeRow";

function inClass(student, cls) {
  return studentInClass(student, cls.id);
}
function inSub(student, cls, sub) {
  return studentInSub(student, cls.id, sub.id);
}

// rows = [{ student, due, paid, remaining, status }]
export default function CashierClasses({ rows, month, monthLabel, lastReceiptFor, onReceipt, onEdit, onPay }) {
  const [activeId, setActiveId] = useState(CLASSES[0].id);
  const [subId, setSubId] = useState("");
  const [search, setSearch] = useState("");

  const byClass = useMemo(() => {
    const map = {};
    CLASSES.forEach((c) => (map[c.id] = rows.filter((r) => inClass(r.student, c))));
    map.unassigned = rows.filter((r) => !CLASSES.some((c) => inClass(r.student, c)));
    return map;
  }, [rows]);

  const totals = (list) =>
    list.reduce(
      (t, r) => ({ expected: t.expected + r.due, paid: t.paid + r.paid, left: t.left + r.remaining }),
      { expected: 0, paid: 0, left: 0 }
    );

  const active = CLASSES.find((c) => c.id === activeId);
  const isUnassigned = activeId === "unassigned";

  let list = byClass[activeId] || [];
  if (active?.subs && subId) {
    const sub = active.subs.find((s) => s.id === subId);
    list = list.filter((r) => inSub(r.student, active, sub));
  }
  const q = search.trim().toLowerCase();
  const shown = q
    ? list.filter(
        (r) =>
          String(r.student.fullName || "").toLowerCase().includes(q) ||
          String(r.student.studentId).includes(q)
      )
    : list;
  const t = totals(list);

  function choose(id) {
    setActiveId(id);
    setSubId("");
    setSearch("");
  }

  return (
    <div className="stack">
      <div className="class-grid">
        {CLASSES.map((c, i) => {
          const ct = totals(byClass[c.id]);
          return (
            <button
              key={c.id}
              type="button"
              className={`class-card tone-${c.color} ${activeId === c.id ? "active" : ""}`}
              onClick={() => choose(c.id)}
            >
              <span className="class-num">{i + 1}</span>
              <div className="class-card-body">
                <strong>{c.name}</strong>
                <span>{c.so}</span>
                <div className="class-subs">
                  <em>{money(ct.paid)} paid</em>
                  <em>{money(ct.left)} left</em>
                </div>
              </div>
              <div className="class-count">
                <strong>{byClass[c.id].length}</strong>
                <span>students</span>
              </div>
            </button>
          );
        })}
        {byClass.unassigned.length > 0 && (
          <button
            type="button"
            className={`class-card tone-slate ${isUnassigned ? "active" : ""}`}
            onClick={() => choose("unassigned")}
          >
            <span className="class-num">?</span>
            <div className="class-card-body">
              <strong>No class yet</strong>
              <span>Students without one of the classes</span>
            </div>
            <div className="class-count">
              <strong>{byClass.unassigned.length}</strong>
              <span>students</span>
            </div>
          </button>
        )}
      </div>

      <div className="panel">
        <div className="section-head">
          <div>
            <h2>
              {isUnassigned ? "Students without a class" : active?.name}{" "}
              <span className="muted-sm">({list.length})</span>
            </h2>
            <p>
              {monthLabel}: {money(t.paid)} collected of {money(t.expected)} • {money(t.left)} outstanding
            </p>
          </div>
          <div className="search-box">
            <Search size={16} />
            <input placeholder="Search student" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {active?.subs && (
          <div className="chip-filter" style={{ marginBottom: 14 }}>
            <button type="button" className={`chip ${!subId ? "active" : ""}`} onClick={() => setSubId("")}>
              <Layers size={13} /> All
            </button>
            {active.subs.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`chip ${subId === s.id ? "active" : ""}`}
                onClick={() => setSubId(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {shown.length === 0 ? (
          <div className="empty">
            <Users size={34} />
            <strong>No students here</strong>
          </div>
        ) : (
          <div className="record-list">
            {shown.map((r) => (
              <FeeRow
                key={r.student.studentId}
                row={r}
                last={lastReceiptFor(r.student.studentId)}
                onReceipt={onReceipt}
                onEdit={onEdit}
                onPay={onPay}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}