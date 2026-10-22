import type { RGB } from "./types";

function modeColor(pixels: Uint8ClampedArray, count: number): RGB {
  const map = new Map<number, number>();
  for (let i = 0; i < count; i++) {
    const o = i * 3;
    const key = (pixels[o] << 16) | (pixels[o + 1] << 8) | pixels[o + 2];
    map.set(key, (map.get(key) || 0) + 1);
  }
  let best = 0;
  let bestCount = -1;
  for (const [key, n] of map) {
    if (n > bestCount) {
      best = key;
      bestCount = n;
    }
  }
  return [(best >> 16) & 255, (best >> 8) & 255, best & 255];
}

function roundedModeColor(pixels: Uint8ClampedArray, count: number): RGB {
  const rounded = new Uint8ClampedArray(count * 3);
  for (let i = 0; i < count * 3; i++) {
    rounded[i] = Math.min(250, Math.ceil(pixels[i] / 10) * 10);
  }
  return modeColor(rounded, count);
}

export function detectBackground(
  image: ImageData,
  cornerRatio = 0.05,
): { color: RGB; fromAlpha: boolean } {
  const { width, height, data } = image;
  const px = Math.max(1, Math.round(Math.min(width, height) * cornerRatio));
  const samples: number[] = [];
  const alphaFlags: boolean[] = [];

  const pushCorner = (x0: number, y0: number) => {
    for (let y = y0; y < y0 + px; y++) {
      for (let x = x0; x < x0 + px; x++) {
        const i = (y * width + x) * 4;
        samples.push(data[i], data[i + 1], data[i + 2]);
        alphaFlags.push(data[i + 3] < 16);
      }
    }
  };

  pushCorner(0, 0);
  pushCorner(width - px, 0);
  pushCorner(0, height - px);
  pushCorner(width - px, height - px);

  const fromAlpha = alphaFlags.filter(Boolean).length / alphaFlags.length >= 0.5;
  const selected: number[] = [];
  for (let i = 0; i < alphaFlags.length; i++) {
    if (fromAlpha ? alphaFlags[i] : true) {
      selected.push(samples[i * 3], samples[i * 3 + 1], samples[i * 3 + 2]);
    }
  }

  const buf = new Uint8ClampedArray(selected);
  const count = selected.length / 3;
  const exact = modeColor(buf, count);
  let matches = 0;
  for (let i = 0; i < count; i++) {
    const o = i * 3;
    if (buf[o] === exact[0] && buf[o + 1] === exact[1] && buf[o + 2] === exact[2]) matches++;
  }
  const color = matches / count >= 0.5 ? exact : roundedModeColor(buf, count);
  return { color, fromAlpha };
}
