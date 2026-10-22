import { createImageData } from "./imageData";
import type { LayerSpec, RGB } from "./types";

function ellipseKernel(radius: number): { offsets: number[]; size: number } {
  const size = radius * 2 + 1;
  const offsets: number[] = [];
  const r2 = radius * radius;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= r2) offsets.push(dy, dx);
    }
  }
  return { offsets, size };
}

function dilate(mask: Uint8Array, width: number, height: number, radius: number) {
  const out = new Uint8Array(width * height);
  if (radius <= 0) {
    out.set(mask);
    return out;
  }
  const { offsets } = ellipseKernel(radius);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      for (let k = 0; k < offsets.length; k += 2) {
        const ny = y + offsets[k];
        const nx = x + offsets[k + 1];
        if (ny < 0 || nx < 0 || ny >= height || nx >= width) continue;
        out[ny * width + nx] = 1;
      }
    }
  }
  return out;
}

function padMask(mask: Uint8Array, width: number, height: number, pad: number) {
  const nw = width + pad * 2;
  const nh = height + pad * 2;
  const out = new Uint8Array(nw * nh);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      out[(y + pad) * nw + (x + pad)] = mask[y * width + x];
    }
  }
  return { mask: out, width: nw, height: nh };
}

function padRgba(data: Uint8ClampedArray, width: number, height: number, pad: number) {
  const nw = width + pad * 2;
  const nh = height + pad * 2;
  const out = new Uint8ClampedArray(nw * nh * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = ((y + pad) * nw + (x + pad)) * 4;
      out[di] = data[si];
      out[di + 1] = data[si + 1];
      out[di + 2] = data[si + 2];
      out[di + 3] = data[si + 3];
    }
  }
  return { data: out, width: nw, height: nh };
}

export function ringStack(
  subjectMask: boolean[] | Uint8Array,
  source: ImageData,
  options: {
    addBorder?: boolean;
    borderRadius?: number;
    layers?: LayerSpec[];
    crop?: boolean;
    cropPad?: number;
    cropPadRatio?: number;
  } = {},
) {
  const {
    addBorder = true,
    borderRadius = 8,
    layers = [],
    crop = true,
    cropPad,
    cropPadRatio = 0.05,
  } = options;

  let width = source.width;
  let height = source.height;
  let mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = subjectMask[i] ? 1 : 0;

  if (!mask.some(Boolean)) {
    return {
      image: createImageData(Math.max(width, 1), Math.max(height, 1)),
      info: {
        subjectPixels: 0,
        borderPixels: 0,
        layers: [] as LayerSpec[],
        outputSize: [Math.max(width, 1), Math.max(height, 1)] as [number, number],
        warning: "No opaque subject found to outline.",
      },
    };
  }

  const rings: LayerSpec[] = [];
  if (addBorder && borderRadius > 0) rings.push({ thickness: borderRadius, color: [255, 255, 255] });
  for (const layer of layers) {
    if (layer.thickness > 0) rings.push({ thickness: Math.round(layer.thickness), color: layer.color });
  }

  const pad = rings.reduce((s, r) => s + r.thickness, 0);
  let rgba = new Uint8ClampedArray(source.data);
  if (pad > 0) {
    const paddedMask = padMask(mask, width, height, pad);
    const paddedRgba = padRgba(rgba, width, height, pad);
    mask = paddedMask.mask;
    width = paddedMask.width;
    height = paddedMask.height;
    rgba = paddedRgba.data;
  }

  let occupied = dilate(mask, width, height, 0);
  const painted: { ring: Uint8Array; color: RGB }[] = [];
  for (const ring of rings) {
    const dilated = dilate(occupied, width, height, ring.thickness);
    const band = new Uint8Array(width * height);
    for (let i = 0; i < band.length; i++) band[i] = dilated[i] && !occupied[i] ? 1 : 0;
    occupied = dilated;
    painted.push({ ring: band, color: ring.color });
  }

  const out = new Uint8ClampedArray(width * height * 4);
  let subjectPixels = 0;
  let borderPixels = 0;
  for (let i = 0; i < width * height; i++) {
    if (mask[i]) {
      const o = i * 4;
      out[o] = rgba[o];
      out[o + 1] = rgba[o + 1];
      out[o + 2] = rgba[o + 2];
      out[o + 3] = rgba[o + 3] || 255;
      subjectPixels++;
    }
  }
  for (const { ring, color } of painted) {
    for (let i = 0; i < ring.length; i++) {
      if (!ring[i]) continue;
      const o = i * 4;
      out[o] = color[0];
      out[o + 1] = color[1];
      out[o + 2] = color[2];
      out[o + 3] = 255;
      borderPixels++;
    }
  }

  let image = new ImageData(out, width, height);
  if (crop && occupied.some(Boolean)) {
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!occupied[y * width + x]) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    let padPx = cropPad;
    if (padPx == null) {
      padPx = Math.round(Math.max(maxX - minX, maxY - minY) * cropPadRatio);
    }
    padPx = Math.max(0, Math.round(padPx));
    const x0 = Math.max(0, minX - padPx);
    const y0 = Math.max(0, minY - padPx);
    const x1 = Math.min(width, maxX + 1 + padPx);
    const y1 = Math.min(height, maxY + 1 + padPx);
    const cw = x1 - x0;
    const ch = y1 - y0;
    const cropped = createImageData(cw, ch);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const si = ((y0 + y) * width + (x0 + x)) * 4;
        const di = (y * cw + x) * 4;
        cropped.data[di] = out[si];
        cropped.data[di + 1] = out[si + 1];
        cropped.data[di + 2] = out[si + 2];
        cropped.data[di + 3] = out[si + 3];
      }
    }
    image = cropped;
  }

  return {
    image,
    info: {
      subjectPixels,
      borderPixels,
      layers: rings,
      outputSize: [image.width, image.height] as [number, number],
    },
  };
}
