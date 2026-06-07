/**
 * StudyForge AI — Firebase Cloud Functions (Callable API)
 * ------------------------------------------------------
 * These functions power the AI features:
 * - summarize
 * - generateQuiz
 * - generateFlashcards
 * - generateStudyPlan
 *
 * SECURITY:
 * - Requires authenticated callers (Firebase Auth)
 * - Keeps prompts constrained and output as strict JSON
 *
 * LLM PROVIDER:
 * - Default: OpenAI (set key via functions config)
 *   firebase functions:config:set openai.key="..." openai.model="gpt-4o-mini"
 */

/* eslint-disable no-console */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const dotenv = require("dotenv");
const { OpenAI } = require("openai");
const Stripe = require("stripe");

// Local emulator support: load functions/.env if present.
dotenv.config();

admin.initializeApp();

function getConfig() {
  const cfg = functions.config() || {};
  return {
    openaiKey: process.env.OPENAI_API_KEY || cfg?.openai?.key,
    openaiModel: process.env.OPENAI_MODEL || cfg?.openai?.model || "gpt-4o-mini",
    appOrigin: process.env.APP_ORIGIN || cfg?.app?.origin || "http://localhost:5000",
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || cfg?.stripe?.secret,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || cfg?.stripe?.webhook_secret,
    stripePriceIds: {
      pack_small: process.env.STRIPE_PRICE_ID_PACK_SMALL || cfg?.stripe?.price_pack_small,
      pack_medium: process.env.STRIPE_PRICE_ID_PACK_MEDIUM || cfg?.stripe?.price_pack_medium,
      pack_large: process.env.STRIPE_PRICE_ID_PACK_LARGE || cfg?.stripe?.price_pack_large
    }
  };
}

function requireAuth(context) {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Please sign in.");
  }
  return context.auth.uid;
}

function clampText(text, maxChars = 45_000) {
  const t = String(text || "").trim();
  if (!t) throw new functions.https.HttpsError("invalid-argument", "Text is required.");
  return t.length <= maxChars ? t : `${t.slice(0, maxChars)}\n\n[TRUNCATED]`;
}

function splitTextChunks(text, chunkSize = 10_000, overlap = 600) {
  const t = String(text || "");
  if (t.length <= chunkSize) return [t];
  const chunks = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(t.length, i + chunkSize);
    chunks.push(t.slice(i, end));
    if (end >= t.length) break;
    i = Math.max(0, end - overlap);
  }
  return chunks;
}

function safeInt(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function safeEnum(v, allowed, def) {
  return allowed.includes(v) ? v : def;
}

function parseJsonOrThrow(s) {
  try {
    return JSON.parse(s);
  } catch (e) {
    throw new functions.https.HttpsError(
      "internal",
      "Model returned invalid JSON. Try again with shorter input."
    );
  }
}

// -----------------------------
// Credits + Stripe Billing
// -----------------------------
let _stripe = null;
function stripeClient() {
  const { stripeSecretKey } = getConfig();
  if (!stripeSecretKey) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing Stripe secret. Set functions config: stripe.secret"
    );
  }
  if (!_stripe) _stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
  return _stripe;
}

function creditsDoc(uid) {
  return admin.firestore().doc(`users/${uid}/billing/credits`);
}

async function getOrInitCredits(uid) {
  const ref = creditsDoc(uid);
  const snap = await ref.get();
  if (snap.exists) return { ref, data: snap.data() || {} };
  // Free starter credits for new users (MVP). Adjust as desired.
  const starter = 5;
  await ref.set(
    { balance: starter, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
  return { ref, data: { balance: starter } };
}

async function spendCredits(uid, cost, reason) {
  const costInt = safeInt(cost, 1, 1, 999);
  const db = admin.firestore();
  const ref = creditsDoc(uid);
  const ledgerRef = db.collection(`users/${uid}/billing/ledger`).doc();

  const res = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    let balance = 0;
    if (snap.exists) balance = Number(snap.data()?.balance || 0);
    else balance = 5; // starter

    if (balance < costInt) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Insufficient credits. Need ${costInt}, have ${balance}.`
      );
    }

    const next = balance - costInt;
    tx.set(
      ref,
      {
        balance: next,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    tx.set(ledgerRef, {
      type: "spend",
      amount: -costInt,
      reason: reason || "ai_call",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { balance: next };
  });

  return res;
}

async function callOpenAIJson({ system, user, maxOutputTokens = 900 }) {
  const { openaiKey, openaiModel } = getConfig();
  if (!openaiKey) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing OpenAI API key. Set functions config: openai.key"
    );
  }
  const client = new OpenAI({ apiKey: openaiKey });

  const completion = await client.chat.completions.create({
    model: openaiModel,
    messages: [
      {
        role: "system",
        content:
          system +
          "\n\nReturn ONLY valid JSON. No markdown. No code fences. No extra keys."
      },
      { role: "user", content: user }
    ],
    temperature: 0.4,
    max_tokens: maxOutputTokens,
    response_format: { type: "json_object" }
  });

  const text = completion.choices?.[0]?.message?.content || "{}";
  return parseJsonOrThrow(text);
}

exports.getCredits = functions.https.onCall(async (_data, context) => {
  const uid = requireAuth(context);
  const { data } = await getOrInitCredits(uid);
  return { balance: Number(data.balance || 0) };
});

exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const cfg = getConfig();
  const pack = safeEnum(data?.pack, ["pack_small", "pack_medium", "pack_large"], "pack_small");

  const priceId = cfg.stripePriceIds?.[pack];
  if (!priceId) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      `Missing Stripe Price ID for ${pack}. Set functions config stripe.price_* or env STRIPE_PRICE_ID_*`
    );
  }

  const creditsByPack = { pack_small: 25, pack_medium: 60, pack_large: 150 };
  const credits = creditsByPack[pack];

  const successUrl = `${cfg.appOrigin}/app/billing?success=1`;
  const cancelUrl = `${cfg.appOrigin}/app/billing?canceled=1`;

  const session = await stripeClient().checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: uid,
    metadata: {
      uid,
      pack,
      credits: String(credits)
    }
  });

  return { url: session.url };
});

exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const cfg = getConfig();
  const secret = cfg.stripeWebhookSecret;
  if (!secret) {
    res.status(500).send("Missing webhook secret");
    return;
  }

  let event;
  try {
    event = stripeClient().webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], secret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const uid = session?.metadata?.uid || session?.client_reference_id;
      const credits = Number(session?.metadata?.credits || 0);
      const pack = session?.metadata?.pack || "unknown";

      if (uid && credits > 0) {
        const db = admin.firestore();
        const creditsRef = creditsDoc(uid);
        const ledgerRef = db.collection(`users/${uid}/billing/ledger`).doc(String(session.id));

        await db.runTransaction(async (tx) => {
          const snap = await tx.get(creditsRef);
          const current = snap.exists ? Number(snap.data()?.balance || 0) : 5; // starter
          const next = current + credits;
          tx.set(
            creditsRef,
            {
              balance: next,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              lastPurchase: {
                pack,
                credits,
                sessionId: session.id,
                purchasedAt: admin.firestore.FieldValue.serverTimestamp()
              }
            },
            { merge: true }
          );
          tx.set(
            ledgerRef,
            {
              type: "credit",
              amount: credits,
              pack,
              sessionId: session.id,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
          );
        });
      }
    }

    res.json({ received: true });
  } catch (e) {
    console.error("Webhook handler failed:", e);
    res.status(500).send("Webhook handler failed");
  }
});

exports.summarize = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);

  const mode = safeEnum(data?.mode, ["concise", "detailed"], "concise");
  const title = String(data?.title || "Untitled").slice(0, 120);
  const text = clampText(data?.text, 120_000);

  // Chunking for large inputs (map-reduce summarization).
  const chunks = splitTextChunks(text, 10_000, 700);

  // Credits (concise cheaper than detailed). Large inputs consume a little more.
  const baseCost = mode === "detailed" ? 3 : 2;
  const extra = Math.max(0, Math.ceil((chunks.length - 1) / 3)); // +1 per ~3 extra chunks
  await spendCredits(uid, baseCost + extra, `summarize_${mode}`);

  const system =
    "You are StudyForge AI, an expert study assistant. Your job is to summarize study notes accurately and clearly for students.";

  let sourceForFinal = text;
  if (chunks.length > 1) {
    const partials = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkUser = JSON.stringify({
        task: "chunk_summary",
        output_schema: { chunkSummary: "string" },
        instructions: [
          "Summarize this chunk faithfully in 5-10 bullet-like sentences.",
          "If you see markers like [Page 3], preserve page numbers when mentioning facts."
        ],
        chunkIndex: i + 1,
        totalChunks: chunks.length,
        title,
        sourceText: chunks[i]
      });
      // Keep chunk summaries compact.
      const out = await callOpenAIJson({ system, user: chunkUser, maxOutputTokens: 420 });
      partials.push(`Chunk ${i + 1}/${chunks.length}:\n${String(out.chunkSummary || "").trim()}`);
    }
    sourceForFinal = partials.join("\n\n");
  }

  const user = JSON.stringify({
    task: "summarize_notes",
    output_schema: {
      summary: "string",
      keyPoints: ["string"]
    },
    instructions: [
      `Write a ${mode} summary.`,
      "Be faithful to the source; do not invent facts.",
      "Prefer bullet-like sentences for key points.",
      "Keep keyPoints between 5 and 10 items.",
      "If the source contains markers like [Page 3], add citations to key points when possible (e.g., '... (Page 3)')."
    ],
    title,
    sourceText: sourceForFinal
  });

  const out = await callOpenAIJson({ system, user, maxOutputTokens: mode === "detailed" ? 1200 : 750 });
  // Basic normalization
  return {
    summary: String(out.summary || "").trim(),
    keyPoints: Array.isArray(out.keyPoints) ? out.keyPoints.map((s) => String(s).trim()).filter(Boolean) : []
  };
});

exports.generateQuiz = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);

  const kind = safeEnum(data?.kind, ["mcq", "true_false"], "mcq");
  const difficulty = safeEnum(data?.difficulty, ["easy", "medium", "hard"], "medium");
  const count = safeInt(data?.count, 10, 3, 20);
  const title = String(data?.title || "Quiz").slice(0, 120);
  const text = clampText(data?.text);

  await spendCredits(uid, 3, `quiz_${difficulty}_${kind}`);

  const system =
    "You are StudyForge AI. Create high-quality practice questions that test understanding, not trivia. Answers must be unambiguous.";

  const user = JSON.stringify({
    task: "generate_quiz",
    kind,
    difficulty,
    count,
    output_schema: {
      title: "string",
      kind: "mcq|true_false",
      difficulty: "easy|medium|hard",
      questions: [
        {
          question: "string",
          options: ["string"],
          answer: "string",
          explanation: "string"
        }
      ]
    },
    rules: [
      "Return exactly 'count' questions.",
      "For MCQ, provide 4 options. The 'answer' must exactly match one option.",
      "For true_false, options must be ['True','False'] and answer must be either 'True' or 'False'.",
      "Use short, clear explanations (1-2 sentences).",
      "Do not reference 'the text' explicitly; write self-contained questions."
    ],
    title,
    sourceText: text
  });

  const out = await callOpenAIJson({ system, user, maxOutputTokens: 1400 });

  const questions = Array.isArray(out.questions) ? out.questions : [];
  return {
    title: String(out.title || title),
    kind,
    difficulty,
    questions: questions.slice(0, count).map((q) => {
      const opts = Array.isArray(q.options) ? q.options.map((s) => String(s)) : [];
      const normalizedOptions = kind === "true_false" ? ["True", "False"] : opts.slice(0, 4);
      return {
        kind,
        question: String(q.question || "").trim(),
        options: normalizedOptions,
        answer: String(q.answer || "").trim(),
        explanation: String(q.explanation || "").trim()
      };
    })
  };
});

exports.generateFlashcards = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);

  const count = safeInt(data?.count, 12, 4, 30);
  const title = String(data?.title || "Flashcards").slice(0, 120);
  const text = clampText(data?.text);

  await spendCredits(uid, 3, "flashcards");

  const system =
    "You are StudyForge AI. Create flashcards that help memorize and understand key concepts. Each card should be atomic.";

  const user = JSON.stringify({
    task: "generate_flashcards",
    count,
    output_schema: {
      title: "string",
      cards: [{ front: "string", back: "string" }]
    },
    rules: [
      "Return exactly 'count' cards.",
      "Front should be a question/term. Back should be the answer/definition.",
      "Avoid duplicates and avoid overly long backs (max ~40 words)."
    ],
    title,
    sourceText: text
  });

  const out = await callOpenAIJson({ system, user, maxOutputTokens: 1200 });
  const cards = Array.isArray(out.cards) ? out.cards : [];
  return {
    title: String(out.title || title),
    cards: cards.slice(0, count).map((c) => ({
      front: String(c.front || "").trim(),
      back: String(c.back || "").trim()
    }))
  };
});

exports.generateStudyPlan = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);

  const examDate = String(data?.examDate || "").trim(); // YYYY-MM-DD
  const subjects = Array.isArray(data?.subjects) ? data.subjects.map((s) => String(s).trim()).filter(Boolean) : [];
  const availableHoursPerDay = Number(data?.availableHoursPerDay || 2);
  const preferences = String(data?.preferences || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate)) {
    throw new functions.https.HttpsError("invalid-argument", "examDate must be YYYY-MM-DD.");
  }
  if (!subjects.length) {
    throw new functions.https.HttpsError("invalid-argument", "At least one subject is required.");
  }
  if (!Number.isFinite(availableHoursPerDay) || availableHoursPerDay <= 0 || availableHoursPerDay > 12) {
    throw new functions.https.HttpsError("invalid-argument", "availableHoursPerDay must be between 0 and 12.");
  }

  await spendCredits(uid, 4, "study_plan");

  // Determine schedule length (cap to keep output manageable).
  const today = new Date();
  const exam = new Date(examDate + "T00:00:00Z");
  const diffDays = Math.max(1, Math.ceil((exam.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)));
  const daysToPlan = Math.min(diffDays, 45); // cap for MVP; generate a rolling plan for long horizons.

  const system =
    "You are StudyForge AI. Build realistic study timetables that prioritize spaced repetition and practice. Keep it actionable.";

  const user = JSON.stringify({
    task: "generate_study_plan",
    output_schema: {
      title: "string",
      examDate: "YYYY-MM-DD",
      subjects: ["string"],
      availableHoursPerDay: "number",
      tips: ["string"],
      days: [{ date: "YYYY-MM-DD", subject: "string", hours: "number", tasks: ["string"] }]
    },
    inputs: {
      examDate,
      subjects,
      availableHoursPerDay,
      preferences
    },
    rules: [
      `Create exactly ${daysToPlan} daily entries (days[]).`,
      "Each day.hours must sum to availableHoursPerDay (single number per day is fine).",
      "Rotate subjects across days (do not keep the same subject every day unless only one subject).",
      "Include practice (quizzes/flashcards/past questions) at least 3x per week.",
      "Include review days and a final revision phase near the exam.",
      "Tasks must be short and actionable."
    ]
  });

  const out = await callOpenAIJson({ system, user, maxOutputTokens: 1600 });
  const days = Array.isArray(out.days) ? out.days : [];

  return {
    title: String(out.title || "Personalized Study Plan"),
    examDate,
    subjects,
    availableHoursPerDay,
    tips: Array.isArray(out.tips) ? out.tips.map((s) => String(s).trim()).filter(Boolean).slice(0, 8) : [],
    days: days.slice(0, daysToPlan).map((d) => ({
      date: String(d.date || "").trim(),
      subject: String(d.subject || "").trim(),
      hours: Number(d.hours || availableHoursPerDay),
      tasks: Array.isArray(d.tasks) ? d.tasks.map((s) => String(s).trim()).filter(Boolean).slice(0, 6) : []
    }))
  };
});
