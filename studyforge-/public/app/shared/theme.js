/**
 * Light/Dark theme
 * - Stored in localStorage under "sf_theme"
 * - Applied to <html data-theme="...">
 */
const KEY = "sf_theme";

export function initTheme() {
  const saved = localStorage.getItem(KEY);
  const preferred = window.matchMedia?.("(prefers-color-scheme: light)")?.matches ? "light" : "dark";
  applyTheme(saved || preferred);
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "light" ? "dark" : "light";
  applyTheme(next);
  localStorage.setItem(KEY, next);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

