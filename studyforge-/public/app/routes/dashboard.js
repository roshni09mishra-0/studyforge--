import { el } from "../shared/ui.js";
import { getDashboardStats } from "../shared/library.js";

export async function dashboardView(root, user) {
  const stats = await getDashboardStats();

  root.append(
    cardStat("Hours studied", stats.hoursStudied.toFixed(1), "This month"),
    cardStat("Average quiz score", `${stats.avgQuizScore}%`, "Last 30 days"),
    cardStat("Resources saved", String(stats.resourcesCount), "Notes, summaries, flashcards"),
    quickActions()
  );
}

function cardStat(title, value, label) {
  const node = el("section", { class: "card", style: "grid-column: span 4" }, [
    el("h2", { text: title }),
    el("div", { class: "stat" }, [
      el("div", {}, [el("div", { class: "value", text: value }), el("div", { class: "label", text: label })]),
      el("span", { class: "badge", text: "Live" })
    ])
  ]);
  return node;
}

function quickActions() {
  return el("section", { class: "card", style: "grid-column: span 12" }, [
    el("h2", { text: "Quick actions" }),
    el("p", { text: "Jump into your most-used tools." }),
    el("div", { class: "actions" }, [
      el("a", { class: "btn primary", href: "/app/summarizer", text: "Summarize notes" }),
      el("a", { class: "btn", href: "/app/quiz", text: "Generate quiz" }),
      el("a", { class: "btn", href: "/app/flashcards", text: "Make flashcards" }),
      el("a", { class: "btn", href: "/app/planner", text: "Build study plan" })
    ])
  ]);
}

