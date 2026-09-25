import { createContext, useContext, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { STUDENTS_COLLECTION, TEACHERS_COLLECTION } from "../config/collections";

const AuthContext = createContext(null);

const COLLECTION_BY_ROLE = {
  admin: "admin",
  teacher: TEACHERS_COLLECTION,
  student: STUDENTS_COLLECTION,
};

// Finds the login doc for a given role + identifier. Admin can sign in
// with either their username or their email (this fixes the "Account not
// found" bug — the admin doc has username: "admin" but you were typing the
// email). Teachers sign in with username. Students sign in with their
// Student ID.
async function findAccount(role, identifier) {
  const collectionName = COLLECTION_BY_ROLE[role];
  const colRef = collection(db, collectionName);

  if (role === "admin") {
    const byUsername = await getDocs(query(colRef, where("username", "==", identifier)));
    if (!byUsername.empty) return byUsername.docs[0];

    const byEmail = await getDocs(query(colRef, where("email", "==", identifier)));
    if (!byEmail.empty) return byEmail.docs[0];

    return null;
  }

  if (role === "teacher") {
    const byUsername = await getDocs(query(colRef, where("username", "==", identifier)));
    return byUsername.empty ? null : byUsername.docs[0];
  }

  // student: identifier is the Student ID (e.g. "000")
  const byId = await getDocs(query(colRef, where("studentId", "==", identifier)));
  return byId.empty ? null : byId.docs[0];
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem("rss_user");
    return saved ? JSON.parse(saved) : null;
  });

  async function login(role, identifier, password) {
    const docSnap = await findAccount(role, identifier);
    if (!docSnap) throw new Error("Account not found.");

    const data = docSnap.data();
    if (String(data.password) !== String(password)) {
      throw new Error("Incorrect password.");
    }

    // Spread Firestore's own data first, then force `role` from the portal
    // being logged into — otherwise a stray "role" field already stored in
    // Firestore (e.g. a typo like "admim" instead of "admin") silently
    // overwrites this and ProtectedRoute rejects the login.
    const loggedInUser = { id: docSnap.id, ...data, role };
    delete loggedInUser.password;
    setUser(loggedInUser);
    sessionStorage.setItem("rss_user", JSON.stringify(loggedInUser));
    return loggedInUser;
  }

  function logout() {
    setUser(null);
    sessionStorage.removeItem("rss_user");
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
