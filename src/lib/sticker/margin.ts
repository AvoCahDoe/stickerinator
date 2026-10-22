import { detectBackground } from "./detectBackground";
import { createImageData } from "./imageData";
import type { Margins, RGB } from "./types";

export function normalizeMargins(
  margin: number | Margins | null | undefined,
  imageSize: [number, number],
  marginRatio = 0.1,
): Margins {
  if (margin == null) {
    const px = Math.round(Math.max(imageSize[0], imageSize[1]) * marginRatio);
    return [px, px, px, px];
  }
  if (typeof margin === "number") {
    const px = Math.max(0, Math.round(margin));
    return [px, px, px, px];
  }
  return margin.map((v) => Math.max(0, Math.round(v))) as Margins;
}

export function renderMargin(
  image: ImageData,
  margin: number | Margins | null = null,
  background: RGB | null = null,
) {
  const detected = detectBackground(image);
  const bg = background ?? detected.color;
  const margins = normalizeMargins(margin, [image.width, image.height]);
  const [top, right, bottom, left] = margins;
  const outW = image.width + left + right;
  const outH = image.height + top + bottom;
  const out = createImageData(outW, outH, [bg[0], bg[1], bg[2], 255]);

  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const si = (y * image.width + x) * 4;
      const a = image.data[si + 3] / 255;
      const di = ((y + top) * outW + (x + left)) * 4;
      out.data[di] = Math.round(image.data[si] * a + bg[0] * (1 - a));
      out.data[di + 1] = Math.round(image.data[si + 1] * a + bg[1] * (1 - a));
      out.data[di + 2] = Math.round(image.data[si + 2] * a + bg[2] * (1 - a));
      out.data[di + 3] = 255;
    }
  }

  return {
    image: out,
    info: {
      sourceSize: [image.width, image.height] as [number, number],
      margins,
      background: bg,
      detected: detected.color,
      backgroundFromAlpha: detected.fromAlpha,
      outputSize: [outW, outH] as [number, number],
    },
  };
}
