// functions/index.js — Firebase Cloud Function (Blaze plan)
// Marka exam-ka macallinku noqdo status "sent" → push notification u dir
// admin-ka (xitaa haddii browser-kiisu xiran yahay). Token-yada waxaa keydiya
// admin-ka marka uu riixo "Allow" (rssAdminPushTokens).
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

exports.notifyAdminNewExam = onDocumentWritten("rssExams/{examId}", async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  if (!after) return;

  let title = "";
  if (after.status === "sent" && (!before || before.status !== "sent")) {
    title = "📝 Exam cusub ayaa la soo diray!";
  } else if (after.status === "results" && before && before.status !== "results") {
    title = "✅ Natiijo la gudbiyay";
  } else return;

  const body = `${after.teacherName || after.createdBy || "Macallin"} — ${after.title || "Exam"} · ${after.classGroup || ""}`;
  const db = getFirestore();
  const snap = await db.collection("rssAdminPushTokens").get();
  const tokens = snap.docs.map((d) => d.id);
  if (!tokens.length) return;

  const res = await getMessaging().sendEachForMulticast({
    tokens,
    data: { title, body, url: "/admin", tag: `rss-${event.params.examId}-${after.status}` },
    webpush: { headers: { Urgency: "high" }, fcmOptions: { link: "/admin" } },
  });

  // Token-yada aan shaqaynayn tirtir
  await Promise.all(
    res.responses.map((r, i) =>
      !r.success && /registration-token-not-registered|invalid-argument/.test(r.error?.code || "")
        ? db.collection("rssAdminPushTokens").doc(tokens[i]).delete()
        : null
    )
  );
});