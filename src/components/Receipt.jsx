import { useEffect } from "react";
import { Printer, X, Phone, MapPin } from "lucide-react";
import { formatDate } from "../utils/attendance";
import { formatMonth, money, amountInWords } from "../utils/payments";

function paidTime(payment) {
  const d = payment.createdAt?.toDate ? payment.createdAt.toDate() : payment.localTime ? new Date(payment.localTime) : null;
  return d ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
}

// A5 printable receipt. Shown in a modal; "Print" prints only the receipt
// sheet (see .receipt-print rules in index.css — @page size A5).
export default function Receipt({ payment, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!payment) return null;

  const fullyPaid = Number(payment.balance) <= 0;
  const classText = payment.classGroups?.length ? payment.classGroups.join(", ") : payment.className || "—";
  const totalPaid = Number(payment.paidBefore || 0) + Number(payment.amount || 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="receipt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="receipt-toolbar">
          <strong>Receipt {payment.receiptNo}</strong>
          <div>
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              <Printer size={16} /> Print A5
            </button>
            <button type="button" className="icon-btn" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="receipt-scroll">
          <div className="receipt-print">
            <div className="receipt-sheet">
              <img src="/logo.png" alt="" className="receipt-watermark" />

              <header className="rc-head">
                <img src="/logo.png" alt="Rising Star School" className="rc-logo" />
                <div className="rc-school">
                  <h1>Rising Star</h1>
                  <p>Primary &amp; Secondary School</p>
                  <span>Knowledge Today • Better Tomorrow</span>
                </div>
              </header>

              <div className="rc-title">
                <div>
                  <h2>PAYMENT RECEIPT</h2>
                  <span>Rasiidka Lacag Bixinta</span>
                </div>
                <div className="rc-no">
                  <span>Receipt No.</span>
                  <strong>{payment.receiptNo}</strong>
                </div>
              </div>

              <div className="rc-meta">
                <div><span>Date</span><strong>{formatDate(payment.date)}</strong></div>
                <div><span>Time</span><strong>{paidTime(payment) || "—"}</strong></div>
                <div><span>Method</span><strong>{payment.method}</strong></div>
              </div>

              <section className="rc-box">
                <div className="rc-row"><span>Student Name</span><strong>{payment.studentName}</strong></div>
                <div className="rc-row"><span>Student ID</span><strong>{payment.studentId}</strong></div>
                <div className="rc-row"><span>Class</span><strong>{classText}</strong></div>
                {payment.parentPhone && (
                  <div className="rc-row"><span>Parent Phone</span><strong>{payment.parentPhone}</strong></div>
                )}
              </section>

              <table className="rc-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Monthly fee — {formatMonth(payment.month)}</td>
                    <td>{money(payment.amountDue)}</td>
                  </tr>
                  {Number(payment.paidBefore) > 0 && (
                    <tr>
                      <td>Paid earlier this month</td>
                      <td>− {money(payment.paidBefore)}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="rc-paid">
                    <td>Amount Paid</td>
                    <td>{money(payment.amount)}</td>
                  </tr>
                  <tr>
                    <td>Balance</td>
                    <td>{money(payment.balance)}</td>
                  </tr>
                </tfoot>
              </table>

              <p className="rc-words">
                <span>Amount in words:</span> {amountInWords(payment.amount)} only.
              </p>

              <div className="rc-stamp-row">
                <div className={`rc-stamp ${fullyPaid ? "paid" : "partial"}`}>
                  {fullyPaid ? "PAID" : "PARTIAL"}
                  <small>{formatMonth(payment.month)}</small>
                </div>
                <div className="rc-total-box">
                  <span>Total paid for {formatMonth(payment.month)}</span>
                  <strong>{money(totalPaid)}</strong>
                </div>
              </div>

              {payment.note && <p className="rc-note"><span>Note:</span> {payment.note}</p>}

              <div className="rc-sign">
                <div>
                  <strong>{payment.cashierName || "—"}</strong>
                  <span>Cashier</span>
                </div>
                <div>
                  <strong>&nbsp;</strong>
                  <span>Parent / Student</span>
                </div>
              </div>

              <footer className="rc-foot">
                <span><MapPin size={10} /> Rising Star School</span>
                <span>Thank you for your payment • Mahadsanid</span>
                <span><Phone size={10} /> Keep this receipt</span>
              </footer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}