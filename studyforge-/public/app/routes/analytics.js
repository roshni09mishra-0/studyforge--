import { el, toast } from "../shared/ui.js";
import { addStudyMinutes } from "../shared/analytics.js";
import { auth, db } from "../shared/firebase.js";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export async function analyticsView(root) {
  const minutes = el("input", { type: "number", min: "5", step: "5", value: "30" });
  const logBtn = el("button", { class: "btn primary", text: "Log study time" });

  const hoursCanvas = el("canvas", { id: "hoursChart", height: "120" });
  const scoreCanvas = el("canvas", { id: "scoreChart", height: "120" });

  logBtn.addEventListener("click", async () => {
    try {
      await addStudyMinutes(Number(minutes.value));
      toast("Logged", "Study time added to today.", "success");
      await renderCharts(hoursCanvas, scoreCanvas);
    } catch (e) {
      toast("Log failed", e.message || String(e), "danger");
    }
  });

  root.append(
    el("section", { class: "card", style: "grid-column: span 12" }, [
      el("h2", { text: "Analytics Dashboard" }),
      el("p", { text: "Track your learning streak, study hours, and quiz performance." }),
      el("div", { class: "row" }, [
        el("div", {}, [el("label", { text: "Add minutes studied today" }), minutes]),
        el("div", { style: "align-self:end" }, [logBtn])
      ])
    ]),
    el("section", { class: "card", style: "grid-column: span 6" }, [
      el("h2", { text: "Study hours (last 14 days)" }),
      hoursCanvas
    ]),
    el("section", { class: "card", style: "grid-column: span 6" }, [
      el("h2", { text: "Avg quiz score (last 14 days)" }),
      scoreCanvas
    ])
  );

  await renderCharts(hoursCanvas, scoreCanvas);
}

async function renderCharts(hoursCanvas, scoreCanvas) {
  const u = auth.currentUser;
  if (!u) return;
  const col = collection(db, `users/${u.uid}/metrics/daily`);
  const q = query(col, orderBy("__name__", "desc"), limit(14));
  const snaps = await getDocs(q);
  const rows = snaps.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();

  const labels = rows.map((r) => r.id.slice(5)); // MM-DD
  const hours = rows.map((r) => Math.round(((r.studiedMinutes || 0) / 60) * 10) / 10);
  const scores = rows.map((r) => (typeof r.avgQuizScore === "number" ? r.avgQuizScore : null));

  // Chart.js is loaded via <script defer>, so it should be available.
  const Chart = window.Chart;
  if (!Chart) return;

  if (hoursCanvas._chart) hoursCanvas._chart.destroy();
  if (scoreCanvas._chart) scoreCanvas._chart.destroy();

  hoursCanvas._chart = new Chart(hoursCanvas, {
    type: "line",
    data: { labels, datasets: [{ label: "Hours", data: hours, borderColor: "#22d3ee", backgroundColor: "rgba(34,211,238,.15)", tension: 0.35, fill: true }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: "rgba(232,238,252,.65)" } }, y: { ticks: { color: "rgba(232,238,252,.65)" } } }
    }
  });

  scoreCanvas._chart = new Chart(scoreCanvas, {
    type: "bar",
    data: { labels, datasets: [{ label: "Score", data: scores, backgroundColor: "rgba(124,58,237,.40)", borderColor: "rgba(124,58,237,.70)" }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: "rgba(232,238,252,.65)" } }, y: { min: 0, max: 100, ticks: { color: "rgba(232,238,252,.65)" } } }
    }
  });
}

