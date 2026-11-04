// src/config/push.js
//
// Push notifications (xitaa marka browser-ka la xiro) — Firebase Cloud Messaging.
// 1) Firebase console → Project settings → Cloud Messaging → "Web Push certificates"
//    → Generate key pair → koobiyee "Key pair" oo halkan dhig.
// 2) Deploy-garee functions/ (eeg ISBEDDELADA.md).
// Haddii VAPID_KEY bannaan yahay: digniinta waxay shaqaysaa marka browser-ku furan
// yahay (xitaa tab kale ama minimized), browser xiran-se ma gaarto.
export const VAPID_KEY = "";

export const PUSH_TOKENS_COLLECTION = "rssAdminPushTokens";