import { bitmapToImageData, scaleImageData, sourceStem } from "@/lib/sticker/imageData";

const RASTER_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/x-ms-bmp",
]);

const EXT_TYPE: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

export type IngestResult = {
  image: ImageData;
  stem: string;
  filename: string;
  mime: string;
  kind: "raster" | "svg" | "pdf";
};

function extOf(name: string) {
  const m = name.toLowerCase().match(/\.[a-z0-9]+$/);
  return m ? m[0] : "";
}

function mimeOf(file: File) {
  if (file.type) return file.type;
  return EXT_TYPE[extOf(file.name)] || "";
}

async function loadRaster(file: File, maxSide: number): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  try {
    const data = await bitmapToImageData(bitmap);
    return scaleImageData(data, maxSide);
  } finally {
    bitmap.close();
  }
}

async function loadSvg(file: File, maxSide: number): Promise<ImageData> {
  const text = await file.text();
  const blob = new Blob([text], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to decode SVG"));
      el.src = url;
    });
    const w = img.naturalWidth || 1024;
    const h = img.naturalHeight || 1024;
    const longest = Math.max(w, h);
    const scale = longest > maxSide ? maxSide / longest : 1;
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, cw, ch);
    return ctx.getImageData(0, 0, cw, ch);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadPdf(file: File, maxSide: number): Promise<ImageData> {
  const pdfjs = await import("pdfjs-dist");
  // Use CDN worker compatible with the installed pdfjs version
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const unscaled = page.getViewport({ scale: 1 });
  const longest = Math.max(unscaled.width, unscaled.height);
  const scale = Math.min(2, maxSide / longest);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function isSupportedFile(file: File) {
  const mime = mimeOf(file);
  const ext = extOf(file.name);
  return (
    RASTER_TYPES.has(mime) ||
    mime === "image/svg+xml" ||
    mime === "application/pdf" ||
    Boolean(EXT_TYPE[ext])
  );
}

export async function ingestFile(file: File, maxSide = 1280): Promise<IngestResult> {
  const mime = mimeOf(file);
  const ext = extOf(file.name);
  const stem = sourceStem(file.name);

  if (mime === "image/svg+xml" || ext === ".svg") {
    const image = await loadSvg(file, maxSide);
    return { image, stem, filename: file.name, mime: "image/svg+xml", kind: "svg" };
  }

  if (mime === "application/pdf" || ext === ".pdf") {
    const image = await loadPdf(file, maxSide);
    return { image, stem, filename: file.name, mime: "application/pdf", kind: "pdf" };
  }

  if (RASTER_TYPES.has(mime) || EXT_TYPE[ext]?.startsWith("image/")) {
    const image = await loadRaster(file, maxSide);
    return { image, stem, filename: file.name, mime: mime || EXT_TYPE[ext], kind: "raster" };
  }

  throw new Error(`Unsupported file type: ${file.name}. Use PNG, JPG, WebP, GIF, SVG, or PDF.`);
}

export async function ingestUrl(url: string, filename: string, maxSide = 1280): Promise<IngestResult> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${filename}`);
  const blob = await res.blob();
  const file = new File([blob], filename, { type: blob.type || EXT_TYPE[extOf(filename)] });
  return ingestFile(file, maxSide);
}
