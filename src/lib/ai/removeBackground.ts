import { imageDataToCanvas } from "@/lib/sticker/imageData";

export type BgRemoveProgress = {
  phase: "loading" | "removing" | "done" | "error";
  message: string;
};

export async function removeBackgroundAi(
  image: ImageData,
  onProgress?: (p: BgRemoveProgress) => void,
): Promise<ImageData> {
  onProgress?.({ phase: "loading", message: "Loading AI model…" });
  const { removeBackground } = await import("@imgly/background-removal");

  onProgress?.({ phase: "removing", message: "Removing background…" });
  const canvas = imageDataToCanvas(image);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encode failed"))), "image/png");
  });

  const result = await removeBackground(blob, {
    progress: (key, current, total) => {
      if (!total) return;
      const pct = Math.round((current / total) * 100);
      onProgress?.({
        phase: key.includes("fetch") || key.includes("load") ? "loading" : "removing",
        message: `${key}: ${pct}%`,
      });
    },
  });

  const bitmap = await createImageBitmap(result);
  const out = document.createElement("canvas");
  out.width = bitmap.width;
  out.height = bitmap.height;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  onProgress?.({ phase: "done", message: "Background removed" });
  return ctx.getImageData(0, 0, out.width, out.height);
}
