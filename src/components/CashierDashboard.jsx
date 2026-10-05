// src/components/CashierDashboard.jsx
//
// Cashier Portal → Dashboard: lacagaha dhamaan soo galay system-ka (dhammaan
// cashier-ada), oo lagu tiriyo maalinta lacagta la qaatay (payment.date).

import { useMemo } from "react";
import {
  Wallet,
  DollarSign,
  CalendarDays,
  Receipt as ReceiptIcon,
  Printer,
  TrendingUp,
  Users,
  GraduationCap,
  Target,
  AlertCircle,
} from "lucide-react";
import { money, formatMonth } from "../utils/payments";
import { formatDate, todayStr } from "../utils/attendance";

function monthsBack(n) {
  const out = [];
  const d = new Date();
  d.setDate(1);

  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(
      `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`
    );
  }

  return out;
}

export default function CashierDashboard({
  students = [],
  payments = [],
  onReceipt,
  onOpenPayments,
}) {
  const today = todayStr();
  const thisMonth = today.slice(0, 7);

  // ---------------------------------------------------------
  // ACTIVE PAYMENTS
  // Payment amount = 0 OR reversed = true
  // waxaa gabi ahaanba laga qarinayaa dashboard-ka.
  // ---------------------------------------------------------
  const activePayments = useMemo(
    () =>
      payments.filter(
        (p) => Number(p.amount || 0) > 0 && !p.reversed
      ),
    [payments]
  );

  // ---------------------------------------------------------
  // DASHBOARD DATA
  // ---------------------------------------------------------
  const data = useMemo(() => {
    const sum = (list) =>
      list.reduce((s, p) => s + Number(p.amount || 0), 0);

    const total = sum(activePayments);

    const todayTotal = sum(
      activePayments.filter((p) => p.date === today)
    );

    const monthTotal = sum(
      activePayments.filter(
        (p) =>
          String(p.date || "").slice(0, 7) === thisMonth
      )
    );

    const months = monthsBack(6).map((m) => ({
      month: m,
      total: sum(
        activePayments.filter(
          (p) =>
            String(p.date || "").slice(0, 7) === m
        )
      ),
    }));

    const maxMonth = Math.max(
      1,
      ...months.map((m) => m.total)
    );

    const byMethod = {};
    const byCashier = {};

    activePayments.forEach((p) => {
      const m = p.method || "—";

      byMethod[m] =
        (byMethod[m] || 0) + Number(p.amount || 0);

      const key =
        p.cashierName ||
        p.cashierEmail ||
        "—";

      byCashier[key] =
        byCashier[key] || {
          total: 0,
          count: 0,
        };

      byCashier[key].total += Number(
        p.amount || 0
      );

      byCashier[key].count += 1;
    });

    const methods = Object.entries(byMethod).sort(
      (a, b) => b[1] - a[1]
    );

    const cashiers = Object.entries(byCashier).sort(
      (a, b) => b[1].total - a[1].total
    );

    return {
      total,
      todayTotal,
      monthTotal,
      months,
      maxMonth,
      methods,
      cashiers,
    };
  }, [activePayments, today, thisMonth]);

  // ---------------------------------------------------------
  // STUDENTS & MONTHLY FEES
  // Reversed / $0 payments lama xisaabinayo.
  // ---------------------------------------------------------
  const fees = useMemo(() => {
    const paidBy = {};
    let collected = 0;

    activePayments.forEach((p) => {
      if (p.month !== thisMonth) return;

      paidBy[p.studentId] =
        (paidBy[p.studentId] || 0) +
        Number(p.amount || 0);

      collected += Number(p.amount || 0);
    });

    const f = {
      expected: 0,
      collected,
      outstanding: 0,
      paid: 0,
      partial: 0,
      unpaid: 0,
      free: 0,
      payers: 0,
    };

    students.forEach((s) => {
      const due = Number(s.monthlyFee) || 0;
      const got = paidBy[s.studentId] || 0;

      f.expected += due;
      f.outstanding += Math.max(0, due - got);

      if (due === 0) {
        f.free++;
      } else {
        f.payers++;

        if (got >= due) {
          f.paid++;
        } else if (got > 0) {
          f.partial++;
        } else {
          f.unpaid++;
        }
      }
    });

    f.percent = f.expected
      ? Math.min(
          100,
          Math.round(
            (f.collected / f.expected) * 100
          )
        )
      : 0;

    return f;
  }, [students, activePayments, thisMonth]);

  // ---------------------------------------------------------
  // PAYMENT COUNTS / LATEST PAYMENTS
  // Reversed payments lama soo bandhigayo.
  // ---------------------------------------------------------
  const todayCount = activePayments.filter(
    (p) => p.date === today
  ).length;

  const latest = activePayments.slice(0, 8);

  return (
    <div className="stack">
      {/* HERO */}
      <div className="hero-banner">
        <div>
          <span className="hero-kicker">
            All money received • Lacagta system-ka soo gashay
          </span>

          <h2>{money(data.total)} total</h2>

          <p>
            {activePayments.length} payments •{" "}
            {money(data.monthTotal)} in{" "}
            {formatMonth(thisMonth)} •{" "}
            {money(data.todayTotal)} today
          </p>
        </div>
      </div>

      {/* STUDENTS & MONTHLY FEES */}
      <div className="panel">
        <div className="section-head">
          <div>
            <h2>
              Students & monthly fees —{" "}
              {formatMonth(thisMonth)}
            </h2>

            <p>
              Ardayda diiwaan gashan iyo lacagta laga rabo
              dhammaantood
            </p>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-card tone-blue">
            <span className="stat-icon">
              <GraduationCap size={20} />
            </span>

            <span className="stat-label">
              Registered students
              <em>
                {fees.payers} pay a fee •{" "}
                {fees.free} no fee
              </em>
            </span>

            <strong className="stat-value">
              {students.length}
            </strong>
          </div>

          <div className="stat-card tone-violet">
            <span className="stat-icon">
              <Target size={20} />
            </span>

            <span className="stat-label">
              Total expected
              <em>Lacagta laga rabo</em>
            </span>

            <strong className="stat-value">
              {money(fees.expected)}
            </strong>
          </div>

          <div className="stat-card tone-green">
            <span className="stat-icon">
              <Wallet size={20} />
            </span>

            <span className="stat-label">
              Collected so far
              <em>
                La qaaday ({fees.percent}%)
              </em>
            </span>

            <strong className="stat-value">
              {money(fees.collected)}
            </strong>
          </div>

          <div className="stat-card tone-red">
            <span className="stat-icon">
              <AlertCircle size={20} />
            </span>

            <span className="stat-label">
              Still outstanding
              <em>Wali lama bixin</em>
            </span>

            <strong className="stat-value">
              {money(fees.outstanding)}
            </strong>
          </div>
        </div>

        <div
          style={{
            height: 10,
            borderRadius: 99,
            background: "var(--line)",
            marginTop: 16,
          }}
        >
          <div
            style={{
              width: `${fees.percent}%`,
              height: "100%",
              borderRadius: 99,
              background: "var(--accent-grad)",
            }}
          />
        </div>

        <div
          className="tag-list"
          style={{ marginTop: 12 }}
        >
          <span className="pill pill-green">
            <span className="pill-dot" />
            Paid {fees.paid}
          </span>

          <span className="pill pill-amber">
            <span className="pill-dot" />
            Partial {fees.partial}
          </span>

          <span className="pill pill-red">
            <span className="pill-dot" />
            Unpaid {fees.unpaid}
          </span>

          <span className="pill pill-blue">
            <span className="pill-dot" />
            No fee {fees.free}
          </span>
        </div>
      </div>

      {/* STATS */}
      <div className="stat-grid">
        <div className="stat-card tone-violet">
          <span className="stat-icon">
            <DollarSign size={20} />
          </span>

          <span className="stat-label">
            Today
            <em>Maanta</em>
          </span>

          <strong className="stat-value">
            {money(data.todayTotal)}
          </strong>
        </div>

        <div className="stat-card tone-green">
          <span className="stat-icon">
            <CalendarDays size={20} />
          </span>

          <span className="stat-label">
            Received this month
            <em>Bishan la qaaday</em>
          </span>

          <strong className="stat-value">
            {money(data.monthTotal)}
          </strong>
        </div>

        <div className="stat-card tone-blue">
          <span className="stat-icon">
            <Wallet size={20} />
          </span>

          <span className="stat-label">
            All time
            <em>Wadarta</em>
          </span>

          <strong className="stat-value">
            {money(data.total)}
          </strong>
        </div>

        <div className="stat-card tone-amber">
          <span className="stat-icon">
            <ReceiptIcon size={20} />
          </span>

          <span className="stat-label">
            Payments today
            <em>Rasiidyo maanta</em>
          </span>

          <strong className="stat-value">
            {todayCount}
          </strong>
        </div>
      </div>

      {/* LAST 6 MONTHS + PAYMENT METHODS */}
      <div className="two-col">
        <div className="panel">
          <div className="panel-head row">
            <div className="panel-icon">
              <TrendingUp size={18} />
            </div>

            <div>
              <h2>Last 6 months</h2>
              <p>Money received each month</p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 12,
              height: 190,
            }}
          >
            {data.months.map((m) => (
              <div
                key={m.month}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  height: "100%",
                  justifyContent: "flex-end",
                }}
              >
                <span
                  className="muted-sm"
                  style={{ fontWeight: 600 }}
                >
                  {m.total ? money(m.total) : ""}
                </span>

                <div
                  style={{
                    width: "100%",
                    maxWidth: 54,
                    height: `${Math.max(
                      4,
                      (m.total / data.maxMonth) * 130
                    )}px`,
                    borderRadius: 8,
                    background:
                      m.month === thisMonth
                        ? "var(--accent-grad)"
                        : "var(--green-light)",
                  }}
                />

                <span className="muted-sm">
                  {formatMonth(m.month)
                    .split(" ")[0]
                    .slice(0, 3)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head row">
            <div className="panel-icon">
              <Wallet size={18} />
            </div>

            <div>
              <h2>By payment method</h2>
              <p>Cash, EVC Plus, Zaad…</p>
            </div>
          </div>

          {data.methods.length === 0 ? (
            <p className="muted">
              No payments yet.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {data.methods.map(
                ([name, value]) => (
                  <div key={name}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        fontSize: "0.86rem",
                        marginBottom: 4,
                      }}
                    >
                      <strong>{name}</strong>
                      <span>{money(value)}</span>
                    </div>

                    <div
                      style={{
                        height: 8,
                        borderRadius: 99,
                        background:
                          "var(--line)",
                      }}
                    >
                      <div
                        style={{
                          width: `${
                            data.total
                              ? (value /
                                  data.total) *
                                100
                              : 0
                          }%`,
                          height: "100%",
                          borderRadius: 99,
                          background:
                            "var(--accent)",
                        }}
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* LATEST PAYMENTS */}
      <div className="two-col">
        <div className="panel">
          <div className="section-head">
            <h2>Latest payments</h2>

            <button
              type="button"
              className="btn btn-light btn-sm"
              onClick={onOpenPayments}
            >
              View all
            </button>
          </div>

          {latest.length === 0 ? (
            <div className="empty">
              <ReceiptIcon size={34} />
              <strong>No payments yet</strong>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Student</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {latest.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <span className="id-chip">
                          {p.receiptNo}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {p.studentName}
                        </strong>

                        <div className="muted-sm">
                          {p.method} •{" "}
                          {p.cashierName || "—"}
                        </div>
                      </td>

                      <td>
                        <strong className="txt-green">
                          {money(p.amount)}
                        </strong>
                      </td>

                      <td>
                        {formatDate(p.date)}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            onReceipt(p)
                          }
                        >
                          <Printer size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* BY CASHIER */}
        <div className="panel">
          <div className="panel-head row">
            <div className="panel-icon">
              <Users size={18} />
            </div>

            <div>
              <h2>By cashier</h2>
              <p>Who received how much</p>
            </div>
          </div>

          {data.cashiers.length === 0 ? (
            <p className="muted">
              No payments yet.
            </p>
          ) : (
            <ul className="activity-list">
              {data.cashiers.map(
                ([name, v]) => (
                  <li key={name}>
                    <span className="activity-dot" />

                    <div>
                      <strong>
                        {name}
                      </strong>{" "}
                      — {money(v.total)}

                      <span>
                        {v.count} payments
                      </span>
                    </div>
                  </li>
                )
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}