import { el, toast } from "../shared/ui.js";
import { extractTextFromFile } from "../shared/text-extract.js";
import { aiGenerateFlashcards } from "../shared/api.js";
import { saveResource } from "../shared/library.js";

export async function flashcardsView(root) {
  const state = { text: "", fileName: "", cards: [] };

  const fileInput = el("input", { type: "file", accept: ".pdf,.docx,.txt", multiple: "multiple" });
  const title = el("input", { placeholder: "Deck title (optional)" });
  const count = el("select", {}, [
    el("option", { value: "8", text: "8 cards" }),
    el("option", { value: "12", text: "12 cards" }),
    el("option", { value: "16", text: "16 cards" })
  ]);

  const extractBtn = el("button", { class: "btn", text: "Extract content" });
  const genBtn = el("button", { class: "btn primary", text: "Generate flashcards" });
  const saveBtn = el("button", { class: "btn", text: "Save deck" });

  const cardsWrap = el("section", { class: "card", style: "grid-column: span 12" }, [
    el("h2", { text: "Deck" }),
    el("p", { text: "Click a card to flip it." }),
    el("div", { class: "cards", id: "cards" })
  ]);

  extractBtn.addEventListener("click", async () => {
    try {
      const files = [...(fileInput.files || [])];
      if (!files.length) return toast("Missing file", "Upload a PDF, DOCX, or TXT first.", "warning");
      state.fileName = files.length === 1 ? files[0].name : `${files.length} files`;
      extractBtn.disabled = true;
      extractBtn.textContent = "Extracting…";
      let combined = "";
      for (const f of files) {
        const t = await extractTextFromFile(f);
        combined += `\n\n--- FILE: ${f.name} ---\n\n${t}\n`;
      }
      state.text = combined.trim();
      toast("Extracted", "Ready to generate flashcards.", "success");
    } catch (e) {
      toast("Extraction failed", e.message || String(e), "danger");
    } finally {
      extractBtn.disabled = false;
      extractBtn.textContent = "Extract content";
    }
  });

  genBtn.addEventListener("click", async () => {
    try {
      if (!state.text) return toast("No content", "Click “Extract content” first.", "warning");
      genBtn.disabled = true;
      genBtn.textContent = "Generating…";
      const res = await aiGenerateFlashcards({
        count: Number(count.value),
        title: title.value || state.fileName || "Untitled deck",
        text: state.text
      });
      state.cards = res.cards;
      renderCards();
      toast("Done", "Flashcards generated.", "success");
    } catch (e) {
      toast("AI error", e.message || String(e), "danger");
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = "Generate flashcards";
    }
  });

  saveBtn.addEventListener("click", async () => {
    try {
      if (!state.cards.length) return toast("Nothing to save", "Generate flashcards first.", "warning");
      // Initialize spaced-repetition metadata (Leitner)
      const nowIso = new Date().toISOString();
      const scheduledCards = state.cards.map((c) => ({
        front: c.front,
        back: c.back,
        box: 1,
        nextReviewAt: nowIso
      }));
      const id = await saveResource({
        type: "flashcards",
        title: title.value || state.fileName || "Flashcards",
        payload: { cards: scheduledCards, createdAtIso: nowIso }
      });
      toast("Saved", `Flashcard deck saved (id: ${id}).`, "success");
    } catch (e) {
      toast("Save failed", e.message || String(e), "danger");
    }
  });

  function renderCards() {
    const container = cardsWrap.querySelector("#cards");
    container.innerHTML = "";
    state.cards.forEach((c) => {
      const card = el("div", { class: "flashcard", tabindex: "0" }, [
        el("div", { class: "flash-inner" }, [
          el("div", { class: "flash-face front" }, [
            el("h3", { text: c.front }),
            el("p", { text: "Click to reveal" })
          ]),
          el("div", { class: "flash-face back" }, [
            el("h3", { text: "Answer" }),
            el("p", { text: c.back })
          ])
        ])
      ]);
      card.addEventListener("click", () => card.classList.toggle("flipped"));
      card.addEventListener("keypress", (e) => {
        if (e.key === "Enter" || e.key === " ") card.classList.toggle("flipped");
      });
      container.append(card);
    });
  }

  root.append(
    el("section", { class: "card", style: "grid-column: span 12" }, [
      el("h2", { text: "Flashcard Generator" }),
      el("p", { text: "Generate a deck from your notes and save it to your account." }),
      el("div", { class: "row" }, [
        el("div", {}, [el("label", { text: "Upload files (PDF/DOCX/TXT)" }), fileInput]),
        el("div", {}, [el("label", { text: "Cards" }), count]),
        el("div", {}, [el("label", { text: "Deck title" }), title])
      ]),
      el("div", { class: "actions" }, [extractBtn, genBtn, saveBtn])
    ]),
    cardsWrap
  );
}
