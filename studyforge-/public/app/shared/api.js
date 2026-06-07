/**
 * StudyForge AI — AI API client
 * Uses Firebase Callable Functions:
 * - summarize
 * - generateQuiz
 * - generateFlashcards
 * - generateStudyPlan
 */
import { functions } from "./firebase.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js";

const summarizeFn = httpsCallable(functions, "summarize");
const quizFn = httpsCallable(functions, "generateQuiz");
const flashFn = httpsCallable(functions, "generateFlashcards");
const planFn = httpsCallable(functions, "generateStudyPlan");

function ensureTextSize(text, maxChars = 45_000) {
  // Protect function payload size; you can raise this if you know your limits.
  const t = (text || "").trim();
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars) + "\n\n[TRUNCATED]";
}

export async function aiSummarize({ mode, text, title }) {
  const res = await summarizeFn({ mode, title, text: ensureTextSize(text) });
  return res.data;
}

export async function aiGenerateQuiz({ kind, difficulty, count, text, title }) {
  const res = await quizFn({ kind, difficulty, count, title, text: ensureTextSize(text) });
  return res.data;
}

export async function aiGenerateFlashcards({ count, text, title }) {
  const res = await flashFn({ count, title, text: ensureTextSize(text) });
  return res.data;
}

export async function aiGenerateStudyPlan({ examDate, subjects, availableHoursPerDay, preferences }) {
  const res = await planFn({ examDate, subjects, availableHoursPerDay, preferences });
  return res.data;
}

