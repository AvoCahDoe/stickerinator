export function createImageData(width: number, height: number, fill?: [number, number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  if (fill) {
    const [r, g, b, a] = fill;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return new ImageData(data, width, height);
}

export function cloneImageData(src: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
}

export function imageDataToCanvas(image: ImageData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to encode canvas"));
    }, type);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function imageDataToObjectUrl(image: ImageData): string {
  return imageDataToCanvas(image).toDataURL("image/png");
}

export async function bitmapToImageData(bitmap: ImageBitmap): Promise<ImageData> {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function scaleImageData(image: ImageData, maxSide: number): ImageData {
  const longest = Math.max(image.width, image.height);
  if (longest <= maxSide || maxSide <= 0) return image;
  const scale = maxSide / longest;
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));
  const src = imageDataToCanvas(image);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

export function rgbToHex([r, g, b]: [number, number, number]) {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function hexToRgb(value: string, fallback: [number, number, number] = [0, 0, 0]): [number, number, number] {
  const text = (value || "").trim().toLowerCase();
  if (text.startsWith("#")) {
    let hex = text.slice(1);
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    if (hex.length >= 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
  }
  const match = text.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i);
  if (match) {
    return [
      Math.max(0, Math.min(255, Math.round(Number(match[1])))),
      Math.max(0, Math.min(255, Math.round(Number(match[2])))),
      Math.max(0, Math.min(255, Math.round(Number(match[3])))),
    ];
  }
  return fallback;
}

export function sourceStem(filename: string) {
  const name = filename.split(/[/\\]/).pop() || "sticker";
  return name.replace(/\.[^.]+$/, "") || "sticker";
}
