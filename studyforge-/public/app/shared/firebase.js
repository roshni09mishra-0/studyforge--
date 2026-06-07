/**
 * Firebase client initialization (modular v9+ via CDN).
 *
 * IMPORTANT:
 * - Add your config in firebase-config.js
 * - If you use the emulator suite locally, update connectEmulator() below.
 */
import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

