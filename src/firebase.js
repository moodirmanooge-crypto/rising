// Firebase setup for the Rising Star School project.
// NOTE: it is normal/expected for these web config values to be public in a
// client app — they are not secret keys. What actually protects your data
// is your Firestore Security Rules (set in the Firebase console). Make sure
// those rules only allow admins/teachers/students to read/write the
// collections they're supposed to.
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBXFegVGIyVk02zY6Ks3DhcoWjomNw_ht0",
  authDomain: "one-click-onilne.firebaseapp.com",
  projectId: "one-click-onilne",
  storageBucket: "one-click-onilne.firebasestorage.app",
  messagingSenderId: "988928725446",
  appId: "1:988928725446:web:1c9c9c5a30b7ea0b43a2c7",
  measurementId: "G-NRKM2YSD8Z",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
