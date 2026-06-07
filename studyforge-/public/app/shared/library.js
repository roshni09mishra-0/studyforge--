/**
 * Resource Library (Firestore)
 * ----------------------------------------------------
 * Collections (per user):
 * /users/{uid}/resources/{resourceId}
 *   - type: "note" | "summary" | "flashcards" | "quiz" | "plan"
 *   - title: string
 *   - subjects: string[]
 *   - createdAt: timestamp
 *   - updatedAt: timestamp
 *   - searchText: string (lowercase for quick client-side filtering)
 *   - payload: object (type-specific content)
 */
import { auth, db } from "./firebase.js";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

function resourcesCol() {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");
  return collection(db, `users/${u.uid}/resources`);
}

export async function saveResource({ type, title, subjects = [], payload }) {
  const searchText = `${title} ${subjects.join(" ")}`.toLowerCase();
  const ref = await addDoc(resourcesCol(), {
    type,
    title,
    subjects,
    searchText,
    payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  // Store doc id in the document for convenience.
  await setDoc(doc(resourcesCol(), ref.id), { id: ref.id }, { merge: true });
  return ref.id;
}

export async function updateResource(id, patch) {
  if (!id) throw new Error("Missing resource id.");
  const ref = doc(resourcesCol(), id);
  await setDoc(ref, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}

export async function listResources({ type = null, qText = "" } = {}) {
  // Firestore full-text search isn't available by default; we keep this simple:
  // query by type and then filter by searchText client-side for small-to-mid libraries.
  const clauses = [];
  if (type) clauses.push(where("type", "==", type));
  const q = query(resourcesCol(), ...clauses, orderBy("createdAt", "desc"), limit(50));
  const snaps = await getDocs(q);
  const items = snaps.docs.map((d) => d.data());
  const qLower = qText.trim().toLowerCase();
  return qLower ? items.filter((i) => (i.searchText || "").includes(qLower)) : items;
}

export async function getDashboardStats() {
  // Lightweight stats that don't require server-side aggregation.
  const items = await listResources();
  const resourcesCount = items.length;

  // Quiz scores + study minutes come from /metrics/daily
  // For a "production" app you might pre-aggregate these in Cloud Functions.
  const u = auth.currentUser;
  if (!u) return { hoursStudied: 0, avgQuizScore: 0, resourcesCount };

  const metricsCol = collection(db, `users/${u.uid}/metrics/daily`);
  const q = query(metricsCol, orderBy("__name__", "desc"), limit(30));
  const snaps = await getDocs(q);
  const days = snaps.docs.map((d) => d.data());

  const totalMinutes = days.reduce((a, d) => a + (d.studiedMinutes || 0), 0);
  const scoreDays = days.filter((d) => typeof d.avgQuizScore === "number");
  const avgQuizScore = scoreDays.length
    ? Math.round(scoreDays.reduce((a, d) => a + (d.avgQuizScore || 0), 0) / scoreDays.length)
    : 0;

  return { hoursStudied: totalMinutes / 60, avgQuizScore, resourcesCount };
}
