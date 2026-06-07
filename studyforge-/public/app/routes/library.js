import { el, toast } from "../shared/ui.js";
import { listResources } from "../shared/library.js";

export async function libraryView(root) {
  const search = el("input", { placeholder: "Search (title / subject)…" });
  const type = el("select", {}, [
    el("option", { value: "", text: "All types" }),
    el("option", { value: "summary", text: "Summaries" }),
    el("option", { value: "quiz", text: "Quizzes" }),
    el("option", { value: "flashcards", text: "Flashcards" }),
    el("option", { value: "plan", text: "Study plans" }),
    el("option", { value: "note", text: "Notes" })
  ]);
  const refreshBtn = el("button", { class: "btn", text: "Refresh" });

  const details = el("textarea", { placeholder: "Click a row to view its saved payload…", style: "min-height:220px" });

  const tableCard = el("section", { class: "card", style: "grid-column: span 7" }, [
    el("h2", { text: "Saved resources" }),
    el("div", { class: "row" }, [
      el("div", {}, [el("label", { text: "Filter" }), type]),
      el("div", {}, [el("label", { text: "Search" }), search]),
      el("div", { style: "align-self:end" }, [refreshBtn])
    ]),
    el("div", { style: "overflow:auto" }, [
      el("table", { id: "tbl" }, [
        el("thead", {}, [el("tr", {}, [
          el("th", { text: "Type" }),
          el("th", { text: "Title" }),
          el("th", { text: "Created" })
        ])]),
        el("tbody")
      ])
    ])
  ]);

  const detailsCard = el("section", { class: "card", style: "grid-column: span 5" }, [
    el("h2", { text: "Details" }),
    el("p", { text: "This view is intentionally transparent for debugging. Replace with a richer reader UI as needed." }),
    details,
    el("div", { class: "actions" }, [
      el("button", { class: "btn", text: "Copy JSON", onclick: async () => {
        try {
          await navigator.clipboard.writeText(details.value);
          toast("Copied", "Resource JSON copied to clipboard.", "success");
        } catch {
          toast("Copy failed", "Clipboard permissions blocked by the browser.", "warning");
        }
      }})
    ])
  ]);

  async function refresh() {
    const items = await listResources({ type: type.value || null, qText: search.value || "" });
    const tbody = tableCard.querySelector("tbody");
    tbody.innerHTML = "";
    if (!items.length) {
      tbody.append(el("tr", {}, [el("td", { text: "No results", colspan: "3", style: "color:var(--muted)" })]));
      return;
    }
    items.forEach((it) => {
      const tr = el("tr", { style: "cursor:pointer" }, [
        el("td", { text: it.type }),
        el("td", { text: it.title || "Untitled" }),
        el("td", { text: it.createdAt?.toDate?.().toLocaleString?.() || "—" })
      ]);
      tr.addEventListener("click", () => {
        details.value = JSON.stringify(it, null, 2);
      });
      tbody.append(tr);
    });
  }

  refreshBtn.addEventListener("click", () => refresh().catch((e) => toast("Load failed", e.message || String(e), "danger")));
  search.addEventListener("input", () => refresh().catch(() => {}));
  type.addEventListener("change", () => refresh().catch(() => {}));

  root.append(tableCard, detailsCard);
  await refresh();
}

