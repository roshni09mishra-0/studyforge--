/**
 * Auth helpers (Firebase Authentication).
 */
import { auth, db } from "./firebase.js";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export function onUserChanged(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function requireAuth() {
  const u = auth.currentUser;
  if (u) return u;
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user) resolve(user);
      else reject(new Error("Not signed in"));
    });
  });
}

export async function loginEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerEmail(email, password, displayName = "Student") {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await ensureUserDoc(cred.user);
  return cred;
}

export async function loginGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  await ensureUserDoc(cred.user);
  return cred;
}

export async function logout() {
  return signOut(auth);
}

async function ensureUserDoc(user) {
  // Minimal user profile (you can extend with more fields later).
  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      email: user.email || null,
      displayName: user.displayName || "Student",
      photoURL: user.photoURL || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

