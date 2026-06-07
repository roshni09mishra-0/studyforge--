# StudyForge AI (Firebase + Vanilla JS)

Modern full-stack AI SaaS web app (Firebase Hosting + Auth + Firestore + Storage + Cloud Functions).

## Features (implemented in this codebase)
- Firebase Authentication: Email/Password + Google Sign-In
- Premium SaaS UI (glassmorphism), mobile-first, light/dark theme toggle
- Dashboard: quick stats + quick actions
- AI Notes Summarizer: PDF/DOCX/TXT → summary + key points (via Cloud Functions + LLM)
- AI Quiz Generator: MCQ / True-False, difficulty levels, instant scoring
- Flashcard Generator: flip animation + save deck
- AI Study Planner: exam date + subjects + hours/day → timetable
- Billing & Credits (one-time): Stripe Checkout + credit balance enforced on AI calls
- Daily Review: spaced repetition (Leitner boxes) for saved flashcard decks
- Resource Library: save/search your generated content
- Analytics Dashboard: study hours + quiz scores charts + streak tracking

## Project structure
```
/
  firebase.json
  firestore.rules
  storage.rules
  functions/          # Cloud Functions (Node.js)
  public/             # Firebase Hosting static site
    index.html        # Landing page
    login.html        # Auth page
    app/              # Authenticated SPA (client-side routing)
```

## Firestore data model (per-user)
All user data is stored under `/users/{uid}/...` and protected by security rules.

- `users/{uid}`: profile
- `users/{uid}/resources/{resourceId}`: saved summaries/quizzes/flashcards/plans
  - `type`: `"summary" | "quiz" | "flashcards" | "plan" | "note"`
  - `title`, `subjects`, `payload`, timestamps
- `users/{uid}/metrics/daily/{yyyy-mm-dd}`: analytics + streak metrics
  - `studiedMinutes`, `quizzesTaken`, `avgQuizScore`, timestamps

## Setup (local)
1. Install Firebase CLI
   - `npm i -g firebase-tools`
2. Login
   - `firebase login`
3. Create a Firebase project + add a Web App
4. Update `.firebaserc`
   - Replace `studyforge-ai` with your Firebase project id
5. Configure the web app
   - Edit `public/app/shared/firebase-config.js` and paste your Firebase config
6. Enable Firebase services in Console
   - Authentication providers: Email/Password + Google
   - Firestore Database
   - Storage
   - Cloud Functions (Blaze plan required for external API calls)

## AI / LLM configuration
Cloud Functions call an LLM provider (default: OpenAI). You must set an API key:

- For deploy:
  - `firebase functions:config:set openai.key="YOUR_KEY" openai.model="gpt-4o-mini"`
- For emulator:
  - Copy `functions/.env.example` → `functions/.env` and set `OPENAI_API_KEY=...`

## Stripe credits setup (one-time packs)
1. Create Stripe Prices for your credit packs (e.g., Starter/Boost/Pro).
2. Set Stripe secrets:
   - `firebase functions:config:set stripe.secret="sk_..." stripe.webhook_secret="whsec_..."`
3. Set your Price IDs:
   - `firebase functions:config:set stripe.price_pack_small="price_..." stripe.price_pack_medium="price_..." stripe.price_pack_large="price_..."`
4. Add a webhook endpoint in Stripe pointing to:
   - `https://<YOUR_REGION>-<PROJECT>.cloudfunctions.net/stripeWebhook`
   - Listen to: `checkout.session.completed`

## Run emulators
From the repo root:
```bash
firebase emulators:start
```
Then open the Hosting emulator URL shown in the terminal.

## Deploy
```bash
firebase deploy
```

## Notes
- File text extraction happens client-side (PDF.js + Mammoth) so your raw documents do not need to be uploaded to the server.
- For “production-grade” search, consider Algolia / Meilisearch or Firestore + n-gram indexing.
- For large documents, use chunking + embeddings (not included in this MVP).
