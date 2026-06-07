/**
 * Client-side text extraction for:
 * - PDF (pdfjs)
 * - DOCX (mammoth)
 * - TXT (plain)
 *
 * This keeps uploads private to the browser by default.
 * You can also upload originals to Firebase Storage separately if desired.
 */

export async function extractTextFromFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt")) return (await file.text()).trim();
  if (name.endsWith(".docx")) return extractDocx(file);
  if (name.endsWith(".pdf")) return extractPdf(file);
  throw new Error("Unsupported file type. Please upload PDF, DOCX, or TXT.");
}

async function extractDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  // Mammoth converts DOCX to raw text in the browser.
  const mammoth = await import("https://cdn.jsdelivr.net/npm/mammoth@1.7.1/+esm");
  const res = await mammoth.extractRawText({ arrayBuffer });
  return (res.value || "").trim();
}

async function extractPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer());

  // pdfjs-dist ESM build
  const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.mjs");
  // Worker must be configured manually when loading from CDN.
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.mjs";

  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((it) => it.str);
    // Page marker helps the backend include rough citations like "(Page 3)".
    text += `\n\n[Page ${i}]\n` + strings.join(" ") + "\n";
  }
  return text.trim();
}
