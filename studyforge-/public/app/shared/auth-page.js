/**
 * Login / Register page logic.
 */
import { loginEmail, registerEmail, loginGoogle } from "./auth.js";
import { initTheme } from "./theme.js";
import { toast } from "./ui.js";

initTheme();

const email = document.getElementById("email");
const password = document.getElementById("password");

document.getElementById("loginBtn").addEventListener("click", async () => {
  try {
    await loginEmail(email.value.trim(), password.value);
    window.location.href = "/app/dashboard";
  } catch (e) {
    toast("Login failed", e.message || String(e), "danger");
  }
});

document.getElementById("registerBtn").addEventListener("click", async () => {
  try {
    await registerEmail(email.value.trim(), password.value, "Student");
    window.location.href = "/app/dashboard";
  } catch (e) {
    toast("Registration failed", e.message || String(e), "danger");
  }
});

document.getElementById("googleBtn").addEventListener("click", async () => {
  try {
    await loginGoogle();
    window.location.href = "/app/dashboard";
  } catch (e) {
    toast("Google login failed", e.message || String(e), "danger");
  }
});

