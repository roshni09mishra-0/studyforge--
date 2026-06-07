/**
 * Analytics + streak tracking
 * ---------------------------------------
 * Data model (per user):
 * /users/{uid}/metrics/daily/{yyyy-mm-dd}
 *   - studiedMinutes: number
 *   - quizzesTaken: number
 *   - avgQuizScore: number (0..100)
 *   - updatedAt: timestamp
 */
import { auth, db } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export function yyyyMmDd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function userPath() {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");
  return `users/${u.uid}`;
}

export async function addStudyMinutes(minutes) {
  const id = yyyyMmDd();
  const ref = doc(db, `${userPath()}/metrics/daily/${id}`);
  const snap = await getDoc(ref);
  const current = snap.exists() ? (snap.data().studiedMinutes || 0) : 0;
  await setDoc(
    ref,
    {
      studiedMinutes: current + minutes,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function recordQuizResult(scorePercent) {
  const id = yyyyMmDd();
  const ref = doc(db, `${userPath()}/metrics/daily/${id}`);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  const taken = data.quizzesTaken || 0;
  const prevAvg = data.avgQuizScore || 0;
  const nextTaken = taken + 1;
  const nextAvg = Math.round(((prevAvg * taken) + scorePercent) / nextTaken);
  await setDoc(
    ref,
    {
      quizzesTaken: nextTaken,
      avgQuizScore: nextAvg,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function getTodayStreak() {
  // Streak definition: consecutive days with at least 1 studied minute OR at least 1 quiz taken.
  const col = collection(db, `${userPath()}/metrics/daily`);
  const q = query(col, orderBy("__name__", "desc"), limit(60)); // last ~2 months
  const snaps = await getDocs(q);
  const docs = snaps.docs.map((d) => ({ id: d.id, ...d.data() }));

  const today = yyyyMmDd();
  const hasActivity = (doc) => (doc.studiedMinutes || 0) > 0 || (doc.quizzesTaken || 0) > 0;

  // Build a set for faster membership checks.
  const map = new Map(docs.map((d) => [d.id, d]));
  let days = 0;
  let cursor = new Date();

  for (let i = 0; i < 365; i++) {
    const id = yyyyMmDd(cursor);
    const d = map.get(id);
    if (d && hasActivity(d)) days += 1;
    else break;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { days, todayHasActivity: !!(map.get(today) && hasActivity(map.get(today))) };
}

