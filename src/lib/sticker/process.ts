import { floodFillSubject, seedPoint } from "./floodFill";
import { createImageData } from "./imageData";
import { normalizeMargins, renderMargin } from "./margin";
import { ringStack } from "./rings";
import type { LayerSpec, Margins, ProcessOptions, RGB, StickerInfo } from "./types";

function subjectFromAlpha(image: ImageData, alphaThreshold = 16): Uint8Array {
  const mask = new Uint8Array(image.width * image.height);
  let hasTransparent = false;
  let hasOpaque = false;
  for (let i = 0; i < mask.length; i++) {
    const a = image.data[i * 4 + 3];
    if (a < alphaThreshold) hasTransparent = true;
    else hasOpaque = true;
    mask[i] = a >= alphaThreshold ? 1 : 0;
  }
  if (!(hasTransparent && hasOpaque)) mask.fill(1);
  return mask;
}

export function layerSticker(
  image: ImageData,
  options: {
    addBorder?: boolean;
    borderRadius?: number;
    layers?: LayerSpec[];
    crop?: boolean;
    cropPad?: number;
  } = {},
) {
  if (image.width < 1 || image.height < 1) {
    const empty = createImageData(1, 1);
    return {
      image: empty,
      info: {
        mode: "layers_only" as const,
        subjectPixels: 0,
        borderPixels: 0,
        layers: [] as LayerSpec[],
        outputSize: [1, 1] as [number, number],
        warning: "Image is too small.",
      },
    };
  }

  const subject = subjectFromAlpha(image);
  const { image: out, info } = ringStack(subject, image, options);
  return {
    image: out,
    info: { ...info, mode: "layers_only" as const } satisfies StickerInfo,
  };
}

export function cutSticker(
  image: ImageData,
  options: {
    margins?: Margins;
    threshold?: number;
    addBorder?: boolean;
    borderRadius?: number;
    layers?: LayerSpec[];
    crop?: boolean;
    cropPad?: number;
  } = {},
) {
  const {
    margins = [0, 0, 0, 0],
    threshold = 150,
    addBorder = true,
    borderRadius = 8,
    layers = [],
    crop = true,
    cropPad = 16,
  } = options;

  if (image.width < 3 || image.height < 3) {
    const empty = createImageData(Math.max(image.width, 1), Math.max(image.height, 1));
    return {
      image: empty,
      info: {
        mode: "full" as const,
        subjectPixels: 0,
        borderPixels: 0,
        layers: [] as LayerSpec[],
        outputSize: [empty.width, empty.height] as [number, number],
        warning: "Image is too small to cut out.",
      },
    };
  }

  const seed = seedPoint(image.width, image.height, margins);
  const subject = floodFillSubject(image, seed, threshold);
  const sourceRgba = createImageData(image.width, image.height);
  for (let i = 0; i < subject.length; i++) {
    const o = i * 4;
    if (subject[i]) {
      sourceRgba.data[o] = image.data[o];
      sourceRgba.data[o + 1] = image.data[o + 1];
      sourceRgba.data[o + 2] = image.data[o + 2];
      sourceRgba.data[o + 3] = 255;
    }
  }

  const { image: out, info } = ringStack(subject, sourceRgba, {
    addBorder,
    borderRadius,
    layers,
    crop,
    cropPad,
  });

  return {
    image: out,
    info: {
      ...info,
      mode: "full" as const,
      seed,
      warning:
        info.subjectPixels === 0
          ? "No subject left. Lower the threshold or pick a background that is not part of the logo."
          : info.warning,
    } satisfies StickerInfo,
  };
}

export function processSticker(source: ImageData, options: ProcessOptions) {
  const layers = options.layers.filter((l) => l.thickness > 0);
  const margins: Margins = options.marginLinked
    ? normalizeMargins(options.marginPx, [source.width, source.height])
    : options.margins;

  if (options.mode === "layers_only") {
    return layerSticker(source, {
      addBorder: options.addBorder,
      borderRadius: options.borderRadius,
      layers,
      crop: options.crop,
      cropPad: options.cropPad,
    });
  }

  const bg: RGB | null = options.autoBackground ? null : options.background;
  const { image: padded, info: marginInfo } = renderMargin(source, margins, bg);
  const { image, info } = cutSticker(padded, {
    margins: marginInfo.margins,
    threshold: options.threshold,
    addBorder: options.addBorder,
    borderRadius: options.borderRadius,
    layers,
    crop: options.crop,
    cropPad: options.cropPad,
  });

  return {
    image,
    info: {
      ...info,
      sourceSize: marginInfo.sourceSize,
      margins: marginInfo.margins,
      background: marginInfo.background,
      detected: marginInfo.detected,
      backgroundFromAlpha: marginInfo.backgroundFromAlpha,
    } satisfies StickerInfo,
    marginPreview: padded,
  };
}
