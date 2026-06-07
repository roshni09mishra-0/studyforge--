/* To‑Do App — clean state + localStorage persistence */

const STORAGE_KEY = "todo_tasks_v1";
const THEME_KEY = "todo_theme_v1";

/** @typedef {{ id: string, text: string, completed: boolean, createdAt: number, updatedAt: number }} Task */

const els = {
  date: document.getElementById("date"),
  time: document.getElementById("time"),
  themeToggle: document.getElementById("themeToggle"),
  form: document.getElementById("taskForm"),
  input: document.getElementById("taskInput"),
  list: document.getElementById("taskList"),
  empty: document.getElementById("emptyState"),
  tpl: document.getElementById("taskItemTemplate"),
  countTotal: document.getElementById("countTotal"),
  countDone: document.getElementById("countDone"),
  countPending: document.getElementById("countPending"),
};

/** @type {Task[]} */
let tasks = [];

let lastAddedId = null;
let editingId = null;

function uid() {
  // stable-ish, collision-resistant enough for localStorage apps
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t) => t && typeof t.text === "string")
      .map((t) => ({
        id: String(t.id || uid()),
        text: String(t.text || "").trim(),
        completed: Boolean(t.completed),
        createdAt: Number(t.createdAt || Date.now()),
        updatedAt: Number(t.updatedAt || t.createdAt || Date.now()),
      }))
      .filter((t) => t.text.length > 0);
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function formatWhen(ts) {
  const d = new Date(ts);
  const date = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${date} · ${time}`;
}

function updateClock() {
  const now = new Date();
  els.date.textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(now);

  els.time.textContent = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);
}

function getThemePreference() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

function updateCounters() {
  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const pending = total - done;
  els.countTotal.textContent = String(total);
  els.countDone.textContent = String(done);
  els.countPending.textContent = String(pending);
}

function setEmptyState() {
  const isEmpty = tasks.length === 0;
  els.empty.hidden = !isEmpty;
}

function createTaskNode(task) {
  const node = /** @type {HTMLLIElement} */ (els.tpl.content.firstElementChild.cloneNode(true));

  node.dataset.id = task.id;
  node.dataset.state = task.id === lastAddedId ? "enter" : "idle";

  if (task.completed) node.classList.add("is-done");

  const checkBtn = /** @type {HTMLButtonElement} */ (node.querySelector(".task__check"));
  const textEl = /** @type {HTMLDivElement} */ (node.querySelector(".task__text"));
  const hintEl = /** @type {HTMLDivElement} */ (node.querySelector(".task__hint"));
  const editBtn = /** @type {HTMLButtonElement} */ (node.querySelector(".iconBtn--edit"));
  const delBtn = /** @type {HTMLButtonElement} */ (node.querySelector(".iconBtn--del"));

  textEl.textContent = task.text;
  hintEl.textContent = task.updatedAt !== task.createdAt ? `Edited · ${formatWhen(task.updatedAt)}` : `Created · ${formatWhen(task.createdAt)}`;

  checkBtn.setAttribute("aria-label", task.completed ? "Mark as pending" : "Mark as completed");

  checkBtn.addEventListener("click", () => toggleTask(task.id));
  delBtn.addEventListener("click", () => requestDelete(task.id));
  editBtn.addEventListener("click", () => startEdit(task.id));

  // Quick edit affordance
  textEl.addEventListener("dblclick", () => startEdit(task.id));

  return node;
}

function render() {
  els.list.innerHTML = "";

  // newest first for a snappy feel
  const ordered = [...tasks].sort((a, b) => b.createdAt - a.createdAt);
  for (const task of ordered) {
    const node = createTaskNode(task);
    els.list.appendChild(node);
  }

  updateCounters();
  setEmptyState();

  // allow enter animation to settle
  if (lastAddedId) {
    const el = els.list.querySelector(`[data-id="${CSS.escape(lastAddedId)}"]`);
    requestAnimationFrame(() => {
      if (el) el.dataset.state = "idle";
      lastAddedId = null;
    });
  }
}

function addTask(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const now = Date.now();
  const task = { id: uid(), text: trimmed, completed: false, createdAt: now, updatedAt: now };
  tasks.unshift(task);
  lastAddedId = task.id;

  saveTasks();
  render();
}

function toggleTask(id) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  t.completed = !t.completed;
  t.updatedAt = Date.now();
  saveTasks();
  render();
}

function requestDelete(id) {
  // animate before re-render
  const row = els.list.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (row) {
    row.dataset.state = "leave";
    row.querySelectorAll("button, input").forEach((b) => (/** @type {HTMLElement} */ (b).disabled = true));
  }

  window.setTimeout(() => {
    tasks = tasks.filter((t) => t.id !== id);
    if (editingId === id) editingId = null;
    saveTasks();
    render();
  }, 230);
}

function startEdit(id) {
  if (editingId && editingId !== id) {
    // close any existing editor first
    render();
  }
  editingId = id;

  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  const row = /** @type {HTMLLIElement|null} */ (els.list.querySelector(`[data-id="${CSS.escape(id)}"]`));
  if (!row) return;

  row.classList.add("is-editing");

  const body = /** @type {HTMLDivElement} */ (row.querySelector(".task__body"));
  body.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "task__editRow";

  const input = document.createElement("input");
  input.className = "task__editInput";
  input.type = "text";
  input.value = task.text;
  input.maxLength = 180;
  input.setAttribute("aria-label", "Edit task text");

  const btns = document.createElement("div");
  btns.className = "task__miniBtns";

  const ok = document.createElement("button");
  ok.className = "miniBtn miniBtn--ok";
  ok.type = "button";
  ok.title = "Save";
  ok.setAttribute("aria-label", "Save edit");
  ok.textContent = "✓";

  const no = document.createElement("button");
  no.className = "miniBtn miniBtn--no";
  no.type = "button";
  no.title = "Cancel";
  no.setAttribute("aria-label", "Cancel edit");
  no.textContent = "✕";

  btns.append(ok, no);
  wrap.append(input, btns);
  body.appendChild(wrap);

  const save = () => {
    const next = input.value.trim();
    if (!next) {
      input.focus();
      input.select();
      return;
    }
    task.text = next;
    task.updatedAt = Date.now();
    editingId = null;
    saveTasks();
    render();
  };

  const cancel = () => {
    editingId = null;
    render();
  };

  ok.addEventListener("click", save);
  no.addEventListener("click", cancel);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  });

  // focus after paint (ensures selection works reliably)
  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}

function init() {
  // theme
  setTheme(getThemePreference());
  els.themeToggle.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(current === "dark" ? "light" : "dark");
  });

  // tasks
  tasks = loadTasks();
  render();

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    addTask(els.input.value);
    els.input.value = "";
    els.input.focus();
  });

  // clock
  updateClock();
  window.setInterval(updateClock, 1000);
}

init();

