import { el, toast } from "../shared/ui.js";
import { extractTextFromFile } from "../shared/text-extract.js";
import { aiGenerateQuiz } from "../shared/api.js";
import { saveResource } from "../shared/library.js";
import { recordQuizResult } from "../shared/analytics.js";

export async function quizView(root) {
  const state = { text: "", fileName: "", quiz: null };

  const fileInput = el("input", { type: "file", accept: ".pdf,.docx,.txt", multiple: "multiple" });
  const title = el("input", { placeholder: "Quiz title (optional)" });
  const kind = el("select", {}, [
    el("option", { value: "mcq", text: "Multiple Choice (MCQ)" }),
    el("option", { value: "true_false", text: "True / False" })
  ]);
  const difficulty = el("select", {}, [
    el("option", { value: "easy", text: "Easy" }),
    el("option", { value: "medium", text: "Medium" }),
    el("option", { value: "hard", text: "Hard" })
  ]);
  const count = el("select", {}, [
    el("option", { value: "5", text: "5 questions" }),
    el("option", { value: "10", text: "10 questions" }),
    el("option", { value: "15", text: "15 questions" })
  ]);

  const extractBtn = el("button", { class: "btn", text: "Extract content" });
  const genBtn = el("button", { class: "btn primary", text: "Generate quiz" });
  const scoreBtn = el("button", { class: "btn", text: "Score quiz" });
  const saveBtn = el("button", { class: "btn", text: "Save result" });

  const quizWrap = el("section", { class: "card", style: "grid-column: span 12" }, [
    el("h2", { text: "Quiz" }),
    el("p", { text: "Generate questions from your notes and get instant scoring." }),
    el("div", { class: "muted", id: "quizMeta", style: "font-size:12px" })
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
      toast("Extracted", "Ready to generate a quiz.", "success");
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

      state.quiz = await aiGenerateQuiz({
        kind: kind.value,
        difficulty: difficulty.value,
        count: Number(count.value),
        title: title.value || state.fileName || "Untitled quiz",
        text: state.text
      });

      renderQuiz(quizWrap, state.quiz);
      toast("Done", "Quiz generated.", "success");
    } catch (e) {
      toast("AI error", e.message || String(e), "danger");
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = "Generate quiz";
    }
  });

  scoreBtn.addEventListener("click", async () => {
    try {
      if (!state.quiz) return toast("No quiz", "Generate a quiz first.", "warning");
      const { score, total } = scoreQuiz(state.quiz);
      const pct = Math.round((score / total) * 100);
      toast("Score", `${score}/${total} (${pct}%)`, pct >= 70 ? "success" : "warning");
      await recordQuizResult(pct);
      document.getElementById("quizMeta").textContent = `Latest score: ${score}/${total} (${pct}%).`;
    } catch (e) {
      toast("Scoring error", e.message || String(e), "danger");
    }
  });

  saveBtn.addEventListener("click", async () => {
    try {
      if (!state.quiz) return toast("Nothing to save", "Generate a quiz first.", "warning");
      const { score, total } = scoreQuiz(state.quiz);
      const pct = Math.round((score / total) * 100);
      const id = await saveResource({
        type: "quiz",
        title: state.quiz.title || title.value || state.fileName || "Quiz",
        payload: {
          quiz: state.quiz,
          scoredAt: new Date().toISOString(),
          score,
          total,
          percent: pct
        }
      });
      toast("Saved", `Quiz saved to library (id: ${id}).`, "success");
    } catch (e) {
      toast("Save failed", e.message || String(e), "danger");
    }
  });

  root.append(
    el("section", { class: "card", style: "grid-column: span 12" }, [
      el("h2", { text: "AI Quiz Generator" }),
      el("p", { text: "Upload notes, choose difficulty, and generate practice questions instantly." }),
      el("div", { class: "row" }, [
        el("div", {}, [el("label", { text: "Upload files (PDF/DOCX/TXT)" }), fileInput]),
        el("div", {}, [el("label", { text: "Quiz type" }), kind]),
        el("div", {}, [el("label", { text: "Difficulty" }), difficulty]),
        el("div", {}, [el("label", { text: "Count" }), count])
      ]),
      el("div", { class: "row" }, [el("div", {}, [el("label", { text: "Title" }), title])]),
      el("div", { class: "actions" }, [extractBtn, genBtn, scoreBtn, saveBtn])
    ]),
    quizWrap
  );
}

function renderQuiz(container, quiz) {
  // Clear previous content while keeping header.
  container.querySelectorAll(".q").forEach((n) => n.remove());
  document.getElementById("quizMeta").textContent = `${quiz.difficulty.toUpperCase()} • ${quiz.kind.toUpperCase()} • ${quiz.questions.length} questions`;

  quiz.questions.forEach((q, idx) => {
    const group = `q_${idx}`;
    const options = q.options || (q.kind === "true_false" ? ["True", "False"] : []);

    const node = el("div", { class: "q", style: "margin-top:12px; padding-top:12px; border-top:1px solid var(--border)" }, [
      el("div", { style: "font-weight:700; font-size:13px", text: `${idx + 1}. ${q.question}` }),
      el("div", { style: "margin-top:8px; display:grid; gap:8px" },
        options.map((opt, oi) => {
          const id = `${group}_${oi}`;
          return el("label", { style: "display:flex; gap:10px; align-items:flex-start; cursor:pointer; color:var(--muted)" }, [
            el("input", { type: "radio", name: group, id, value: opt, style: "margin-top:3px" }),
            el("span", { text: opt })
          ]);
        })
      ),
      el("div", { style: "margin-top:8px; color:var(--muted); font-size:12px" }, [
        el("span", { text: "Tip: answer first, then click “Score quiz”." })
      ])
    ]);
    container.append(node);
  });
}

function scoreQuiz(quiz) {
  let score = 0;
  quiz.questions.forEach((q, idx) => {
    const group = `q_${idx}`;
    const selected = document.querySelector(`input[name="${group}"]:checked`)?.value;
    if (!selected) return;
    if (selected.trim().toLowerCase() === String(q.answer).trim().toLowerCase()) score += 1;
  });
  return { score, total: quiz.questions.length };
}
