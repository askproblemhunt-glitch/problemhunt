// Reads text from a screenshot entirely on the user's device (nothing is uploaded).
// Engine, worker and the English + Hindi language packs are served by the backend from backend/static/tesseract.
// Other Indian languages download their pack (~1–10 MB) once from the jsDelivr CDN, then the browser caches it.
const OCR_LANG: Record<string, string[]> = {
  en: ["eng"], hi: ["hin", "eng"], ta: ["tam", "eng"], te: ["tel", "eng"], bn: ["ben", "eng"], mr: ["mar", "eng"],
  kn: ["kan", "eng"], ml: ["mal", "eng"], gu: ["guj", "eng"], pa: ["pan", "eng"], or: ["ori", "eng"], ur: ["urd", "eng"],
};
const LOCAL = new Set(["eng", "hin"]);

// One engine file is shipped per CPU feature level (SIMD or not) to keep the download small.
const SIMD_TEST = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
function simd(): boolean {
  try { return WebAssembly.validate(SIMD_TEST); } catch { return false; }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const h = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(h); resolve(v); }, (e) => { clearTimeout(h); reject(e); });
  });
}

export async function readScreenshot(file: Blob, uiLang: string, onProgress?: (p: number) => void): Promise<string> {
  const langs = OCR_LANG[uiLang] || ["eng"];
  try {
    return await run(file, langs, onProgress);
  } catch (e) {
    if (langs.every((l) => LOCAL.has(l))) throw e;
    return await run(file, ["eng"], onProgress); // offline / CDN blocked: fall back to built-in English
  }
}

async function run(file: Blob, langs: string[], onProgress?: (p: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const local = langs.every((l) => LOCAL.has(l));
  const worker = await withTimeout(createWorker(langs, 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: simd() ? "/tesseract/tesseract-core-simd-lstm.wasm.js" : "/tesseract/tesseract-core-lstm.wasm.js",
    workerBlobURL: false,
    ...(local ? { langPath: "/tesseract/lang" } : {}),
    logger: (m: { status: string; progress: number }) => {
      if (onProgress && m.status === "recognizing text") onProgress(Math.round(m.progress * 100));
    },
  }), 60000);
  try {
    const { data } = await withTimeout(worker.recognize(file), 60000);
    return (data.text || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  } finally {
    worker.terminate().catch(() => {});
  }
}
