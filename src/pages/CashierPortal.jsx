import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import {
  Wallet, Receipt as ReceiptIcon, Search, DollarSign, CheckCircle2,
  AlertCircle, Clock, Users, X, Printer, CalendarDays,
} from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import PortalLayout, { LiveBadge, initials } from "../components/PortalLayout";
import Receipt from "../components/Receipt";
import { STUDENTS_COLLECTION } from "../config/collections";
import { CLASSES, PAYMENT_METHODS, studentGroups } from "../config/schoolOptions";
import { subscribePayments, recordPayment, currentMonth, formatMonth, money } from "../utils/payments";
import { formatDate, todayStr } from "../utils/attendance";

const STATUS = {
  paid: { label: "Paid", so: "Bixiyay", cls: "pill-green" },
  partial: { label: "Partial", so: "Qayb", cls: "pill-amber" },
  unpaid: { label: "Unpaid", so: "Lama bixin", cls: "pill-red" },
  free: { label: "No fee", so: "Bilaash", cls: "pill-blue" },
};

function studentInClass(student, classId) {
  const cls = CLASSES.find((c) => c.id === classId);
  if (!cls) return true;
  if (student.classId === cls.id) return true;
  return studentGroups(student).some((g) => g === cls.name || g.startsWith(`${cls.name} – `));
}

export default function CashierPortal() {
  const { user } = useAuth();
  const [tab, setTab] = useState("fees");
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(currentMonth());
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [paySearch, setPaySearch] = useState("");
  const [payFor, setPayFor] = useState(null);
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    const unsubS = onSnapshot(
      collection(db, STUDENTS_COLLECTION),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => String(a.studentId).localeCompare(String(b.studentId)));
        setStudents(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    const unsubP = subscribePayments(setPayments, () => {});
    return () => {
      unsubS();
      unsubP();
    };
  }, []);

  const monthPayments = useMemo(() => payments.filter((p) => p.month === month), [payments, month]);

  const paidByStudent = useMemo(() => {
    const map = {};
    monthPayments.forEach((p) => (map[p.studentId] = (map[p.studentId] || 0) + Number(p.amount || 0)));
    return map;
  }, [monthPayments]);

  const rows = useMemo(
    () =>
      students.map((s) => {
        const due = Number(s.monthlyFee) || 0;
        const paid = paidByStudent[s.studentId] || 0;
        let status = "unpaid";
        if (due === 0) status = "free";
        else if (paid >= due) status = "paid";
        else if (paid > 0) status = "partial";
        return { student: s, due, paid, remaining: Math.max(0, due - paid), status };
      }),
    [students, paidByStudent]
  );

  const stats = useMemo(() => {
    const s = { expected: 0, collected: 0, outstanding: 0, paid: 0, partial: 0, unpaid: 0, today: 0 };
    rows.forEach((r) => {
      s.expected += r.due;
      s.outstanding += r.remaining;
      if (r.status in s) s[r.status]++;
    });
    monthPayments.forEach((p) => (s.collected += Number(p.amount || 0)));
    const today = todayStr();
    payments.forEach((p) => p.date === today && (s.today += Number(p.amount || 0)));
    return s;
  }, [rows, monthPayments, payments]);

  const filteredRows = rows.filter((r) => {
    if (classFilter && !studentInClass(r.student, classFilter)) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (q && !String(r.student.fullName || "").toLowerCase().includes(q) && !String(r.student.studentId).includes(q)) return false;
    return true;
  });

  const filteredPayments = payments.filter((p) => {
    const q = paySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      String(p.studentName || "").toLowerCase().includes(q) ||
      String(p.studentId).includes(q) ||
      String(p.receiptNo || "").toLowerCase().includes(q)
    );
  });

  function lastReceiptFor(studentId) {
    return monthPayments.find((p) => p.studentId === studentId);
  }

  const nav = [
    { key: "fees", label: "Monthly Fees", Icon: Wallet },
    { key: "payments", label: "Payments & Receipts", Icon: ReceiptIcon, badge: payments.length || null },
  ];

  return (
    <PortalLayout
      role="cashier"
      title={tab === "fees" ? "Monthly Fees" : "Payments & Receipts"}
      subtitle={tab === "fees" ? `Lacagta bisha — ${formatMonth(month)}` : "Every payment, live — reprint any receipt"}
      nav={nav}
      active={tab}
      onNavigate={setTab}
      actions={<LiveBadge />}
    >
      {tab === "fees" && (
        <div className="stack">
          <div className="hero-banner">
            <div>
              <span className="hero-kicker">{formatMonth(month)}</span>
              <h2>{money(stats.collected)} collected</h2>
              <p>
                of {money(stats.expected)} expected • {money(stats.outstanding)} still outstanding
              </p>
            </div>
            <div className="hero-ring" style={{ "--p": stats.expected ? Math.min(100, Math.round((stats.collected / stats.expected) * 100)) : 0 }}>
              <div>
                <strong>{stats.expected ? Math.min(100, Math.round((stats.collected / stats.expected) * 100)) : 0}%</strong>
                <span>collected</span>
              </div>
            </div>
          </div>

          <div className="stat-grid">
            <button type="button" className={`stat-card tone-green ${statusFilter === "paid" ? "selected" : ""}`} onClick={() => setStatusFilter(statusFilter === "paid" ? "" : "paid")}>
              <span className="stat-icon"><CheckCircle2 size={20} /></span>
              <span className="stat-label">Paid<em>Bixiyay</em></span>
              <strong className="stat-value">{stats.paid}</strong>
            </button>
            <button type="button" className={`stat-card tone-amber ${statusFilter === "partial" ? "selected" : ""}`} onClick={() => setStatusFilter(statusFilter === "partial" ? "" : "partial")}>
              <span className="stat-icon"><Clock size={20} /></span>
              <span className="stat-label">Partial<em>Qayb bixiyay</em></span>
              <strong className="stat-value">{stats.partial}</strong>
            </button>
            <button type="button" className={`stat-card tone-red ${statusFilter === "unpaid" ? "selected" : ""}`} onClick={() => setStatusFilter(statusFilter === "unpaid" ? "" : "unpaid")}>
              <span className="stat-icon"><AlertCircle size={20} /></span>
              <span className="stat-label">Unpaid<em>Lama bixin</em></span>
              <strong className="stat-value">{stats.unpaid}</strong>
            </button>
            <div className="stat-card tone-violet">
              <span className="stat-icon"><DollarSign size={20} /></span>
              <span className="stat-label">Collected today<em>Maanta</em></span>
              <strong className="stat-value">{money(stats.today)}</strong>
            </div>
          </div>

          <div className="filter-bar">
            <div className="filter-date">
              <CalendarDays size={16} />
              <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
            </div>
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">All classes</option>
              {CLASSES.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <div className="search-box">
              <Search size={16} />
              <input placeholder="Search student name or ID" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="panel">
            <div className="section-head">
              <h2>Students <span className="muted-sm">({filteredRows.length})</span></h2>
            </div>
            {loading ? (
              <p className="muted">Loading...</p>
            ) : filteredRows.length === 0 ? (
              <div className="empty"><Users size={34} /><strong>No students match</strong></div>
            ) : (
              <div className="record-list">
                {filteredRows.map(({ student, due, paid, remaining, status }) => {
                  const st = STATUS[status];
                  const last = lastReceiptFor(student.studentId);
                  const groups = studentGroups(student);
                  return (
                    <div key={student.studentId} className="record-row fee-row">
                      <div className="record-student">
                        {student.photoUrl ? (
                          <img src={student.photoUrl} alt={student.fullName} className="avatar" />
                        ) : (
                          <span className="avatar avatar-placeholder">{initials(student.fullName)}</span>
                        )}
                        <div>
                          <strong>{student.fullName}</strong>
                          <span>ID {student.studentId} • {groups.join(", ") || "No class"}</span>
                        </div>
                      </div>
                      <div className="fee-figures">
                        <div><span>Fee</span><strong>{money(due)}</strong></div>
                        <div><span>Paid</span><strong className="txt-green">{money(paid)}</strong></div>
                        <div><span>Left</span><strong className={remaining ? "txt-red" : ""}>{money(remaining)}</strong></div>
                      </div>
                      <span className={`pill ${st.cls}`}><span className="pill-dot" />{st.label}</span>
                      <div className="fee-actions">
                        {last && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReceipt(last)} title="Last receipt">
                            <Printer size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={status === "paid" || status === "free"}
                          onClick={() => setPayFor({ student, due, paid, remaining })}
                        >
                          <DollarSign size={14} /> {status === "paid" ? "Paid" : "Receive"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "payments" && (
        <div className="stack">
          <div className="filter-bar">
            <div className="search-box">
              <Search size={16} />
              <input placeholder="Search by student, ID or receipt number" value={paySearch} onChange={(e) => setPaySearch(e.target.value)} />
            </div>
          </div>
          <div className="panel">
            {filteredPayments.length === 0 ? (
              <div className="empty"><ReceiptIcon size={34} /><strong>No payments yet</strong></div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Receipt</th>
                      <th>Student</th>
                      <th>Month</th>
                      <th>Amount</th>
                      <th>Balance</th>
                      <th>Method</th>
                      <th>Date</th>
                      <th>Cashier</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((p) => (
                      <tr key={p.id}>
                        <td><span className="id-chip">{p.receiptNo}</span></td>
                        <td>
                          <strong>{p.studentName}</strong>
                          <div className="muted-sm">ID {p.studentId}</div>
                        </td>
                        <td>{formatMonth(p.month)}</td>
                        <td><strong className="txt-green">{money(p.amount)}</strong></td>
                        <td>{money(p.balance)}</td>
                        <td><span className="tag tag-soft">{p.method}</span></td>
                        <td>{formatDate(p.date)}</td>
                        <td>{p.cashierName}</td>
                        <td>
                          <button type="button" className="btn btn-light btn-sm" onClick={() => setReceipt(p)}>
                            <Printer size={14} /> Receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {payFor && (
        <PaymentModal
          data={payFor}
          month={month}
          cashier={user}
          onClose={() => setPayFor(null)}
          onSaved={(p) => {
            setPayFor(null);
            setReceipt(p);
          }}
        />
      )}

      {receipt && <Receipt payment={receipt} onClose={() => setReceipt(null)} />}
    </PortalLayout>
  );
}

function PaymentModal({ data, month, cashier, onClose, onSaved }) {
  const { student, due, paid, remaining } = data;
  const [amount, setAmount] = useState(String(remaining));
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    setError("");
    const value = Number(amount);
    if (!value || value <= 0) return setError("Enter an amount greater than 0.");
    if (value > remaining) return setError(`Amount is more than what's left (${money(remaining)}).`);
    setSaving(true);
    try {
      const saved = await recordPayment({
        student,
        month,
        amount: value,
        amountDue: due,
        paidBefore: paid,
        method,
        note,
        cashier,
      });
      onSaved(saved);
    } catch (err) {
      setError(err.message || "Failed to save payment.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onSubmit={save} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="record-student">
            <span className="avatar avatar-placeholder">{initials(student.fullName)}</span>
            <div>
              <strong>{student.fullName}</strong>
              <span>ID {student.studentId} • {formatMonth(month)}</span>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="fee-summary">
          <div><span>Monthly fee</span><strong>{money(due)}</strong></div>
          <div><span>Paid already</span><strong>{money(paid)}</strong></div>
          <div className="hl"><span>Remaining</span><strong>{money(remaining)}</strong></div>
        </div>

        {error && <p className="error">{error}</p>}

        <label>
          Amount received ($)
          <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus required />
        </label>
        <div className="field">
          <span className="field-label">Payment method</span>
          <div className="day-picker">
            {PAYMENT_METHODS.map((m) => (
              <button key={m} type="button" className={`day-chip ${method === m ? "active" : ""}`} onClick={() => setMethod(m)}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <label>
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. paid by father" />
        </label>

        <button type="submit" className="btn btn-primary btn-lg full" disabled={saving}>
          {saving ? "Saving..." : `Save & print receipt`}
        </button>
      </form>
    </div>
  );
}