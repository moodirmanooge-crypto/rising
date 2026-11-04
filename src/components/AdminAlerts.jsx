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
  alertNewExam, alertResults, enableAdminAlerts, notifPermission, notifSupported, playAlarm, systemNotify,
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

export default function AdminAlerts({ admin, onOpen }) {
  const [perm, setPerm] = useState(notifPermission());
  const [push, setPush] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [hideBanner, setHideBanner] = useState(false);
  const prev = useRef(null); // { examId: status }

  function toast(kind, title, body) {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((t) => [{ id, kind, title, body }, ...t].slice(0, 4));
  }

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
          if (missed.length === 1) {
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

  const showBanner = !hideBanner && perm !== "granted";

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

      {perm === "granted" && (
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
                    onOpen?.();
                    setToasts((x) => x.filter((y) => y.id !== t.id));
                  }}
                >
                  Eeg
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