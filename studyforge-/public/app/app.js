/**
 * StudyForge AI — App Shell
 * Vanilla JS SPA under /app/* (Firebase Hosting rewrite to /app/index.html).
 */
import { requireAuth, onUserChanged, logout } from "./shared/auth.js";
import { initTheme, toggleTheme } from "./shared/theme.js";
import { toast } from "./shared/ui.js";
import { getTodayStreak } from "./shared/analytics.js";
import { getCreditsBalance } from "./shared/billing.js";

import { dashboardView } from "./routes/dashboard.js";
import { summarizerView } from "./routes/summarizer.js";
import { quizView } from "./routes/quiz.js";
import { flashcardsView } from "./routes/flashcards.js";
import { plannerView } from "./routes/planner.js";
import { libraryView } from "./routes/library.js";
import { analyticsView } from "./routes/analytics.js";
import { profileView } from "./routes/profile.js";
import { billingView } from "./routes/billing.js";
import { reviewView } from "./routes/review.js";

const view = document.getElementById("view");
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");
const nav = document.getElementById("nav");
const mobileNav = document.getElementById("mobileNav");

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await logout();
  window.location.href = "/login.html";
});
document.getElementById("themeBtn").addEventListener("click", () => toggleTheme());

initTheme();

const routes = [
  { path: "/dashboard", title: "Dashboard", subtitle: "Your AI-powered study hub.", render: dashboardView },
  { path: "/summarizer", title: "Notes Summarizer", subtitle: "Upload notes and generate summaries + key points.", render: summarizerView },
  { path: "/quiz", title: "Quiz Generator", subtitle: "Generate quizzes and get instant scoring.", render: quizView },
  { path: "/flashcards", title: "Flashcards", subtitle: "Create flip-style flashcards and save them.", render: flashcardsView },
  { path: "/review", title: "Daily Review", subtitle: "Spaced repetition flashcard review.", render: reviewView },
  { path: "/planner", title: "Study Planner", subtitle: "Generate an AI timetable and track progress.", render: plannerView },
  { path: "/library", title: "Resource Library", subtitle: "Search and revisit saved materials.", render: libraryView },
  { path: "/analytics", title: "Analytics", subtitle: "Track streaks, scores, and hours studied.", render: analyticsView },
  { path: "/billing", title: "Billing & Credits", subtitle: "Buy credits and manage AI usage.", render: billingView },
  { path: "/profile", title: "Profile Settings", subtitle: "Manage your account and preferences.", render: profileView }
];

function getRoutePathname() {
  // For /app/<route> where hosting rewrite keeps the path.
  const url = new URL(window.location.href);
  const path = url.pathname.replace(/^\/app/, "") || "/dashboard";
  return path === "/" ? "/dashboard" : path;
}

function setActiveNav(path) {
  [...document.querySelectorAll('a[data-route]')].forEach((a) => {
    a.classList.toggle("active", a.getAttribute("data-route") === path);
  });
}

async function render() {
  let user;
  try {
    user = await requireAuth();
  } catch (e) {
    // If not signed in, send to login page.
    window.location.href = "/login.html";
    return;
  }
  const path = getRoutePathname();
  const route = routes.find((r) => r.path === path) || routes[0];

  pageTitle.textContent = route.title;
  pageSubtitle.textContent = route.subtitle;
  setActiveNav(route.path);

  view.innerHTML = "";
  await route.render(view, user);

  // Update streak badge (best-effort; page doesn't depend on it).
  try {
    const streak = await getTodayStreak();
    document.getElementById("streakBadge").textContent = `Streak: ${streak.days} day${streak.days === 1 ? "" : "s"}`;
  } catch (e) {
    // Silent.
  }

  // Update credits badge (best-effort).
  try {
    const bal = await getCreditsBalance();
    const el = document.getElementById("creditsBadge");
    if (el) el.textContent = `Credits: ${bal}`;
  } catch (e) {
    // Silent.
  }
}

// Intercept sidebar navigation for SPA experience.
nav.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-route]");
  if (!a) return;
  e.preventDefault();
  const route = a.getAttribute("data-route");
  history.pushState({}, "", `/app${route}`);
  render().catch((e2) => toast("Navigation error", e2.message || String(e2), "danger"));
});

// Intercept bottom mobile navigation for SPA experience.
mobileNav?.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-route]");
  if (!a) return;
  e.preventDefault();
  const route = a.getAttribute("data-route");
  history.pushState({}, "", `/app${route}`);
  render().catch((e2) => toast("Navigation error", e2.message || String(e2), "danger"));
});

window.addEventListener("popstate", () => render());

onUserChanged((user) => {
  document.getElementById("userName").textContent = user?.displayName || "Student";
  document.getElementById("userEmail").textContent = user?.email || "—";
});

render().catch((e) => {
  toast("App error", e.message || String(e), "danger");
});
