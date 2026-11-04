// src/components/AdminAlerts.jsx
//
// Admin: digniin (cod dheer + system notification + toast) marka:
//  • macallin exam soo diro            → "📝 Exam cusub ayaa la soo diray!"
//  • macallin natiijada gudbiyo         → "✅ Natiijo la gudbiyay"
// Exam-yada la soo diray intii admin-ku maqnaa (browser xiran) → marka uu soo
// galo isla markiiba ayaa loo sheegayaa. Marka hore: "Allow" (ogolaansho).

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, BellRing, Volume2, X } from "lucide-react";
import { subscribeExams } from "../utils/exams";
import {
  alertNewExam, alertPayment, alertResults, alertsMuted, enableAdminAlerts, notifPermission, notifSupported, playAlarm, systemNotify,
} from "../utils/adminAlerts";
import { VAPID_KEY } from "../config/push";

const SEEN_KEY = "rss_admin_exam_seen";
const ms = (ts) => (ts?.toMillis ? ts.toMillis() : ts?.seconds ? ts.seconds * 1000 : 0);

function readSeen() {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}
function writeSeen(v) {
  try {
    localStorage.setItem(SEEN_KEY, String(v));
  } catch {
    /* ignore */
  }
}

const PAY_SEEN_KEY = "rss_admin_pay_seen";

export default function AdminAlerts({ admin, onOpen, payments = [], paymentsReady = false, onReceipt, money }) {
  const [perm, setPerm] = useState(notifPermission());
  const [push, setPush] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [hideBanner, setHideBanner] = useState(false);
  const [muted, setMuted] = useState(alertsMuted());

  // Settings-ka ka beddelay (allow / mute)
  useEffect(() => {
    const sync = () => {
      setPerm(notifPermission());
      setMuted(alertsMuted());
    };
    window.addEventListener("rss-alerts-changed", sync);
    return () => window.removeEventListener("rss-alerts-changed", sync);
  }, []);
  const prev = useRef(null); // { examId: status }

  function toast(kind, title, body, payment) {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((t) => [{ id, kind, title, body, payment }, ...t].slice(0, 4));
  }

  // ---- Lacagaha cashier-ka (rasiid cusub) ----
  const seenPay = useRef(null);
  useEffect(() => {
    if (!paymentsReady) return;
    const now = Date.now();
    if (seenPay.current === null) {
      let since = 0;
      try {
        since = Number(localStorage.getItem(PAY_SEEN_KEY)) || 0;
      } catch {
        /* ignore */
      }
      const missed = since ? payments.filter((p) => ms(p.createdAt) > since) : [];
      if (missed.length === 1) {
        const m = alertPayment(missed[0], money);
        toast("pay", m.title, m.body, missed[0]);
      } else if (missed.length > 1) {
        const total = missed.reduce((n, p) => n + Number(p.amount || 0), 0);
        if (!alertsMuted()) {
          playAlarm(2);
          systemNotify(`💵 ${missed.length} lacag ayaa la qaaday`, `Wadar: $${total.toFixed(2)} — intii aad maqnayd.`, "rss-pay-missed");
        }
        toast("pay", `💵 ${missed.length} lacag ayaa la qaaday`, `Wadar: $${total.toFixed(2)} — intii aad maqnayd. Fur Messages.`);
      }
      seenPay.current = new Set(payments.map((p) => p.id || p.receiptNo));
    } else {
      payments.forEach((p) => {
        const key = p.id || p.receiptNo;
        if (seenPay.current.has(key)) return;
        seenPay.current.add(key);
        const m = alertPayment(p, money);
        toast("pay", m.title, m.body, p);
      });
    }
    try {
      localStorage.setItem(PAY_SEEN_KEY, String(now));
    } catch {
      /* ignore */
    }
  }, [payments, paymentsReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unsub = subscribeExams(
      (list) => {
        const now = Date.now();
        if (prev.current === null) {
          // Markii ugu horreysay: exam-yadii la soo diray intii admin-ku maqnaa
          const seen = readSeen();
          const missed = seen
            ? list.filter((e) => e.status === "sent" && Math.max(ms(e.sentAt), ms(e.createdAt)) > seen)
            : [];
          if (missed.length && alertsMuted()) {
            toast("exam", `📝 ${missed.length} exam cusub`, "Intii aad maqnayd ayaa la soo diray — fur Exams & Results.");
          } else if (missed.length === 1) {
            const m = alertNewExam(missed[0]);
            toast("exam", m.title, m.body);
          } else if (missed.length > 1) {
            playAlarm(3);
            systemNotify(`📝 ${missed.length} exam cusub ayaa la soo diray`, "Intii aad maqnayd — fur Exams & Results.", "rss-missed");
            toast("exam", `📝 ${missed.length} exam cusub`, "Intii aad maqnayd ayaa la soo diray — fur Exams & Results.");
          }
          prev.current = Object.fromEntries(list.map((e) => [e.id, e.status || ""]));
          writeSeen(now);
          return;
        }
        list.forEach((e) => {
          const before = prev.current[e.id];
          if (e.status === "sent" && before !== "sent" && before !== "partial" && before !== "results") {
            const m = alertNewExam(e);
            toast("exam", m.title, m.body);
          } else if (e.status === "results" && before && before !== "results") {
            const m = alertResults(e);
            toast("results", m.title, m.body);
          }
        });
        prev.current = Object.fromEntries(list.map((e) => [e.id, e.status || ""]));
        writeSeen(now);
      },
      () => {}
    );
    return unsub;
  }, []);

  async function allow() {
    const r = await enableAdminAlerts(admin);
    setPerm(r.permission);
    setPush(r.push);
    if (r.permission === "granted") {
      playAlarm(1);
      systemNotify("🔔 Digniinaha waa la shiday", "Marka macallin exam soo diro, cod iyo fariin ayaad heli doontaa.", "rss-test");
    }
  }

  const showBanner = !hideBanner && !muted && perm !== "granted";

  return (
    <>
      {showBanner && (
        <div className={`aa-banner ${perm === "denied" ? "denied" : ""}`}>
          <span className="aa-ico">{perm === "denied" ? <BellOff size={20} /> : <BellRing size={20} />}</span>
          <div>
            <strong>{perm === "denied" ? "Digniinaha waa la xannibay" : "Shid digniinaha exam-yada"}</strong>
            <span>
              {perm === "unsupported"
                ? "Browser-kan notification ma taageero — isticmaal Chrome ama Edge."
                : perm === "denied"
                ? "Browser-ka: guji 🔒 (address bar-ka bidixdiisa) → Notifications → Allow, kadib dib u furo bogga."
                : "Marka macallin exam ama natiijo soo diro — cod dheer + fariin (xitaa tab kale ama browser minimized). Riix Allow, kadib browser-ka ku ogolow."}
            </span>
          </div>
          {perm === "default" && (
            <button type="button" className="btn btn-primary" onClick={allow}>
              <Bell size={16} /> Allow
            </button>
          )}
          <button type="button" className="icon-btn" aria-label="Close" onClick={() => setHideBanner(true)}>
            <X size={16} />
          </button>
        </div>
      )}

      {perm === "granted" && !muted && (
        <div className="aa-on" title={push || VAPID_KEY ? "Push notifications on" : "Alerts on while the browser is open"}>
          <Bell size={14} /> Alerts on
          <button type="button" onClick={() => { playAlarm(1); systemNotify("🔔 Tijaabo", "Digniinaha way shaqaynayaan.", "rss-test"); }}>
            <Volume2 size={13} /> Test
          </button>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="aa-toasts" role="status" aria-live="assertive">
          {toasts.map((t) => (
            <div key={t.id} className={`aa-toast ${t.kind}`}>
              <div>
                <strong>{t.title}</strong>
                <span>{t.body}</span>
              </div>
              <div className="aa-toast-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    if (t.payment && onReceipt) onReceipt(t.payment);
                    else onOpen?.();
                    setToasts((x) => x.filter((y) => y.id !== t.id));
                  }}
                >
                  {t.payment ? "Receipt" : "Eeg"}
                </button>
                <button type="button" className="icon-btn" aria-label="Close" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
                  <X size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export { notifSupported };