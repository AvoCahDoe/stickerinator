import type { Margins, RGB } from "./types";

function colorDiff(a: RGB, b: RGB) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

export function seedPoint(width: number, height: number, margins: Margins): [number, number] {
  const [top, , , left] = margins;
  if (top > 0) return [Math.min(10, width - 1), Math.min(10, top - 1)];
  if (left > 0) return [Math.min(10, left - 1), Math.min(10, height - 1)];
  return [Math.min(10, Math.max(0, width - 1)), Math.min(10, Math.max(0, height - 1))];
}

/** Flood-fill background; returns boolean subject mask (true = keep). */
export function floodFillSubject(
  image: ImageData,
  seed: [number, number],
  threshold: number,
  fill: RGB = [255, 0, 255],
): boolean[] {
  const { width, height, data } = image;
  const subject = new Array(width * height).fill(true);
  const [sx, sy] = seed;
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return subject;

  const idx = (x: number, y: number) => y * width + x;
  const getRgb = (i: number): RGB => {
    const o = i * 4;
    return [data[o], data[o + 1], data[o + 2]];
  };

  const background = getRgb(idx(sx, sy));
  if (colorDiff(fill, background) <= threshold) {
    // Already fill-colored; treat nothing as background
    return subject;
  }

  const visited = new Uint8Array(width * height);
  const stack: number[] = [idx(sx, sy)];
  visited[idx(sx, sy)] = 1;

  while (stack.length) {
    const i = stack.pop()!;
    const rgb = getRgb(i);
    if (colorDiff(rgb, background) > threshold) continue;
    subject[i] = false;
    const x = i % width;
    const y = (i / width) | 0;
    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = idx(nx, ny);
      if (visited[ni]) continue;
      visited[ni] = 1;
      stack.push(ni);
    }
  }

  return subject;
}
