import { el, toast } from "../shared/ui.js";
import { extractTextFromFile } from "../shared/text-extract.js";
import { aiSummarize } from "../shared/api.js";
import { saveResource } from "../shared/library.js";

export async function summarizerView(root) {
  const state = { extractedText: "", fileName: "" };

  const fileInput = el("input", { type: "file", accept: ".pdf,.docx,.txt", multiple: "multiple" });
  const mode = el("select", {}, [
    el("option", { value: "concise", text: "Concise summary" }),
    el("option", { value: "detailed", text: "Detailed summary" })
  ]);
  const title = el("input", { placeholder: "Title (e.g., Biology Chapter 3)" });
  const subjects = el("input", { placeholder: "Subjects (comma separated)" });
  const output = el("textarea", { placeholder: "Summary will appear here…" });
  const keyPoints = el("textarea", { placeholder: "Key points will appear here…" });

  const extractBtn = el("button", { class: "btn", text: "Extract content" });
  const genBtn = el("button", { class: "btn primary", text: "Generate" });
  const saveBtn = el("button", { class: "btn", text: "Save to library" });

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
      state.extractedText = combined.trim();
      toast("Extracted", `Loaded ${Math.min(state.extractedText.length, 5000)}+ characters from ${state.fileName}.`, "success");
    } catch (e) {
      toast("Extraction failed", e.message || String(e), "danger");
    } finally {
      extractBtn.disabled = false;
      extractBtn.textContent = "Extract content";
    }
  });

  genBtn.addEventListener("click", async () => {
    try {
      if (!state.extractedText) return toast("No content", "Click “Extract content” first.", "warning");
      genBtn.disabled = true;
      genBtn.textContent = "Generating…";
      const result = await aiSummarize({
        mode: mode.value,
        text: state.extractedText,
        title: title.value || state.fileName
      });
      output.value = result.summary;
      keyPoints.value = result.keyPoints.join("\n");
      toast("Done", "Summary generated.", "success");
    } catch (e) {
      toast("AI error", e.message || String(e), "danger");
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = "Generate";
    }
  });

  saveBtn.addEventListener("click", async () => {
    try {
      if (!output.value.trim()) return toast("Nothing to save", "Generate a summary first.", "warning");
      const id = await saveResource({
        type: "summary",
        title: title.value || state.fileName || "Untitled summary",
        subjects: subjects.value.split(",").map((s) => s.trim()).filter(Boolean),
        payload: {
          summaryMode: mode.value,
          summary: output.value,
          keyPoints: keyPoints.value.split("\n").map((s) => s.trim()).filter(Boolean),
          sourceFileName: state.fileName || null
        }
      });
      toast("Saved", `Added to library (id: ${id}).`, "success");
    } catch (e) {
      toast("Save failed", e.message || String(e), "danger");
    }
  });

  root.append(
    el("section", { class: "card", style: "grid-column: span 12" }, [
      el("h2", { text: "AI Notes Summarizer" }),
      el("p", { text: "Upload study materials and generate a concise or detailed summary + key points." }),
      el("div", { class: "row" }, [
        el("div", {}, [el("label", { text: "Upload files (PDF/DOCX/TXT)" }), fileInput]),
        el("div", {}, [el("label", { text: "Summary type" }), mode])
      ]),
      el("div", { class: "row" }, [
        el("div", {}, [el("label", { text: "Title" }), title]),
        el("div", {}, [el("label", { text: "Subjects" }), subjects])
      ]),
      el("div", { class: "actions" }, [extractBtn, genBtn, saveBtn])
    ]),
    el("section", { class: "card", style: "grid-column: span 6" }, [
      el("h2", { text: "Summary" }),
      output
    ]),
    el("section", { class: "card", style: "grid-column: span 6" }, [
      el("h2", { text: "Key points" }),
      keyPoints
    ])
  );
}
