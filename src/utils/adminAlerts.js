// src/utils/adminAlerts.js
//
// Digniinta admin-ka marka macallin exam soo diro:
//  • Cod aad u dheer (alarm) — Web Audio, 3 jeer
//  • Fariinta system-ka (Windows / Android notification) — requireInteraction
//  • Title-ka tab-ka wuu boodboodaa ilaa admin-ku soo laabto
//  • (Ikhtiyaari) FCM push — browser-ka oo xiran (VAPID_KEY + functions/)
// Marka hore admin-ku waa inuu riixo "Allow" (browser-ka ayaa ogolaansho weydiiya).

import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import app, { db } from "../firebase";
import { VAPID_KEY, PUSH_TOKENS_COLLECTION } from "../config/push";

const SW_URL = "/firebase-messaging-sw.js";
let audioCtx = null;

// Settings: digniinaha (cod + fariin) dami / shid — browser-kan
const MUTE_KEY = "rss_alerts_muted";
export function alertsMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}
export function setAlertsMuted(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("rss-alerts-changed"));
}

export const notifSupported = () => typeof window !== "undefined" && "Notification" in window;
export const notifPermission = () => (notifSupported() ? Notification.permission : "unsupported");

function ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

// Cod dheer: "bii-baa" × 3 (≈ 3.5 ilbiriqsi)
export function playAlarm(times = 3) {
  const ac = ctx();
  if (!ac) return;
  const master = ac.createGain();
  master.gain.value = 1;
  master.connect(ac.destination);
  let t = ac.currentTime + 0.05;
  for (let r = 0; r < times; r++) {
    [988, 1319, 988, 1319].forEach((freq) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "square";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9, t + 0.02);
      g.gain.setValueAtTime(0.9, t + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + 0.26);
      t += 0.28;
    });
    t += 0.25;
  }
}

let flashTimer = null;
export function flashTitle(text) {
  stopFlash();
  const original = document.title;
  let on = false;
  flashTimer = setInterval(() => {
    document.title = on ? original : `🔔 ${text}`;
    on = !on;
  }, 900);
  const stop = () => {
    if (!document.hidden) {
      stopFlash(original);
      window.removeEventListener("focus", stop);
      document.removeEventListener("visibilitychange", stop);
    }
  };
  window.addEventListener("focus", stop);
  document.addEventListener("visibilitychange", stop);
}
function stopFlash(original) {
  if (flashTimer) clearInterval(flashTimer);
  flashTimer = null;
  if (original) document.title = original;
}

async function swRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration(SW_URL)) || (await navigator.serviceWorker.register(SW_URL));
  } catch {
    return null;
  }
}

// Fariinta system-ka (waxay muuqataa xitaa tab kale / browser minimized)
export async function systemNotify(title, body, tag = "rss-exam") {
  if (notifPermission() !== "granted") return;
  const opts = {
    body,
    tag,
    renotify: true,
    requireInteraction: true,
    icon: "/logo.png",
    badge: "/logo.png",
    vibrate: [300, 150, 300, 150, 600],
    data: { url: "/admin" },
  };
  const reg = await swRegistration();
  try {
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch {
    try {
      new Notification(title, opts);
    } catch {
      /* ignore */
    }
  }
}

// Riix "Allow" → ogolaansho + cod furan + (haddii la dejiyay) FCM token
export async function enableAdminAlerts(admin) {
  ctx(); // cod-ka waa in user gesture lagu furo
  if (!notifSupported()) return { permission: "unsupported", push: false };
  const permission = await Notification.requestPermission();
  let push = false;
  if (permission === "granted") {
    const reg = await swRegistration();
    if (VAPID_KEY && reg) {
      try {
        const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
        if (await isSupported()) {
          const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
          if (token) {
            await setDoc(doc(db, PUSH_TOKENS_COLLECTION, token), {
              token,
              role: "admin",
              admin: admin?.username || admin?.email || admin?.id || "",
              userAgent: navigator.userAgent.slice(0, 200),
              updatedAt: serverTimestamp(),
            });
            push = true;
          }
        }
      } catch (e) {
        console.warn("FCM push lama dejin:", e);
      }
    }
  }
  return { permission, push };
}

// Exam cusub → dhammaan digniinaha
export function alertNewExam(exam) {
  const title = "📝 Exam cusub ayaa la soo diray!";
  const body = `${exam.teacherName || exam.createdBy || "Macallin"} — ${exam.title || "Exam"} · ${exam.classGroup || ""}${
    exam.subjects?.[0]?.name ? ` · ${exam.subjects[0].name}` : ""
  }`;
  if (alertsMuted()) return { title, body };
  playAlarm(3);
  systemNotify(title, body, `rss-exam-${exam.id}`);
  flashTitle("Exam cusub!");
  return { title, body };
}

export function alertResults(exam) {
  const title = "✅ Natiijo la gudbiyay";
  const body = `${exam.teacherName || "Macallin"} — ${exam.title || "Exam"} · ${exam.classGroup || ""}`;
  if (alertsMuted()) return { title, body };
  playAlarm(1);
  systemNotify(title, body, `rss-results-${exam.id}`);
  flashTitle("Natiijo cusub!");
  return { title, body };
}