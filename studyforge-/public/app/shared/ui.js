/**
 * Small UI helpers (toasts, DOM utilities).
 */
export function toast(title, message, variant = "info") {
  const el = document.getElementById("toast");
  const t = document.getElementById("toastTitle");
  const m = document.getElementById("toastMsg");
  if (!el || !t || !m) return;

  t.textContent = title;
  m.textContent = message;

  // Simple variant coloring (kept subtle for glass UI).
  el.style.borderColor =
    variant === "danger" ? "rgba(239,68,68,.35)" :
    variant === "success" ? "rgba(16,185,129,.35)" :
    variant === "warning" ? "rgba(245,158,11,.35)" :
    "rgba(255,255,255,.14)";

  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 4200);
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  for (const c of children) node.append(c);
  return node;
}

