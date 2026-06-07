import { el, toast } from "../shared/ui.js";
import { listResources, updateResource } from "../shared/library.js";

const INTERVAL_DAYS = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 };

export async function reviewView(root) {
  const header = el("section", { class: "card", style: "grid-column: span 12" }, [
    el("h2", { text: "Daily Review (Spaced Repetition)" }),
    el("p", { text: "Review due flashcards from your saved decks. Your progress is saved automatically." })
  ]);

  const deckSelect = el("select");
  const startBtn = el("button", { class: "btn primary", text: "Start review" });
  const stats = el("div", { class: "badge", text: "Due: —" });

  header.append(
    el("div", { class: "row" }, [
      el("div", {}, [el("label", { text: "Deck" }), deckSelect]),
      el("div", { style: "align-self:end" }, [startBtn]),
      el("div", { style: "align-self:end" }, [stats])
    ])
  );

  const stage = el("section", { class: "card", style: "grid-column: span 12; display:none" });
  root.append(header, stage);

  const decks = await listResources({ type: "flashcards" });
  deckSelect.append(el("option", { value: "", text: "Select a deck…" }));
  decks.forEach((d) => deckSelect.append(el("option", { value: d.id, text: d.title || d.id })));

  function dueCards(deck) {
    const now = Date.now();
    const cards = (deck.payload?.cards || []).map((c, idx) => ({ ...c, _index: idx }));
    return cards.filter((c) => {
      const t = Date.parse(c.nextReviewAt || "");
      return !Number.isFinite(t) || t <= now;
    });
  }

  function updateDueBadge() {
    const id = deckSelect.value;
    const deck = decks.find((d) => d.id === id);
    if (!deck) {
      stats.textContent = "Due: —";
      return;
    }
    stats.textContent = `Due: ${dueCards(deck).length}`;
  }

  deckSelect.addEventListener("change", updateDueBadge);
  updateDueBadge();

  startBtn.addEventListener("click", async () => {
    const id = deckSelect.value;
    const deck = decks.find((d) => d.id === id);
    if (!deck) return toast("Select a deck", "Choose a deck to review.", "warning");

    let queue = dueCards(deck);
    if (!queue.length) return toast("Nothing due", "You’re all caught up. Nice work.", "success");

    stage.style.display = "block";

    let idx = 0;
    const render = () => {
      const card = queue[idx];
      stage.innerHTML = "";
      stage.append(
        el("h2", { text: `Card ${idx + 1} / ${queue.length}` }),
        el("p", { text: "Tap the card to flip. Then grade your recall." })
      );

      const flash = el("div", { class: "flashcard", style: "max-width:520px" }, [
        el("div", { class: "flash-inner" }, [
          el("div", { class: "flash-face front" }, [
            el("h3", { text: card.front }),
            el("p", { text: "Tap to reveal answer" })
          ]),
          el("div", { class: "flash-face back" }, [
            el("h3", { text: "Answer" }),
            el("p", { text: card.back })
          ])
        ])
      ]);
      flash.addEventListener("click", () => flash.classList.toggle("flipped"));
      stage.append(flash);

      const actions = el("div", { class: "actions", style: "margin-top:12px" }, [
        el("button", { class: "btn danger", text: "Again", onclick: () => grade(0) }),
        el("button", { class: "btn", text: "Good", onclick: () => grade(1) }),
        el("button", { class: "btn primary", text: "Easy", onclick: () => grade(2) })
      ]);
      stage.append(actions);
    };

    const grade = async (score) => {
      const current = queue[idx];
      const cards = deck.payload?.cards || [];
      const now = new Date();

      let box = Number(current.box || 1);
      if (score === 0) box = 1;
      if (score === 1) box = Math.min(5, box + 1);
      if (score === 2) box = Math.min(5, box + 2);

      const days = INTERVAL_DAYS[box] || 2;
      const next = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

      cards[current._index] = { ...cards[current._index], box, nextReviewAt: next, lastReviewedAt: now.toISOString() };
      try {
        await updateResource(deck.id, { payload: { ...deck.payload, cards } });
      } catch (e) {
        toast("Save failed", e.message || String(e), "danger");
      }

      idx += 1;
      if (idx >= queue.length) {
        stage.innerHTML = "";
        stage.append(
          el("h2", { text: "Review complete" }),
          el("p", { text: "Great work. Come back tomorrow for your next review." })
        );
        // Refresh due count
        const refreshed = await listResources({ type: "flashcards" });
        decks.length = 0;
        refreshed.forEach((d) => decks.push(d));
        updateDueBadge();
        return;
      }
      render();
      updateDueBadge();
    };

    render();
  });
}

