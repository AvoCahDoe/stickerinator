import { hexToRgb, rgbToHex } from "@/lib/sticker/imageData";
import type { LayerSpec } from "@/lib/sticker/types";

export type LayerPreset = {
  count: number;
  layers: { color: string; thickness: number }[];
};

export const DEFAULT_PRESETS: Record<string, LayerPreset> = {
  "White only": { count: 0, layers: [] },
  "Black outline": {
    count: 1,
    layers: [{ color: "#111111", thickness: 10 }],
  },
  "Black + white": {
    count: 2,
    layers: [
      { color: "#111111", thickness: 10 },
      { color: "#ffffff", thickness: 6 },
    ],
  },
  "Pop red": {
    count: 2,
    layers: [
      { color: "#111111", thickness: 8 },
      { color: "#e11d48", thickness: 6 },
    ],
  },
};

const STORAGE_KEY = "stickerinator-layer-presets";

export function loadPresets(): Record<string, LayerPreset> {
  const base = { ...DEFAULT_PRESETS };
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Record<string, LayerPreset>;
    return { ...base, ...parsed };
  } catch {
    return base;
  }
}

export function savePresets(presets: Record<string, LayerPreset>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function presetToLayers(preset: LayerPreset): LayerSpec[] {
  return (preset.layers || []).slice(0, preset.count ?? preset.layers.length).map((l) => ({
    thickness: Math.max(1, Math.round(l.thickness)),
    color: hexToRgb(l.color),
  }));
}

export function layersToPreset(layers: LayerSpec[]): LayerPreset {
  return {
    count: layers.length,
    layers: layers.map((l) => ({
      color: rgbToHex(l.color),
      thickness: l.thickness,
    })),
  };
}

export const LAYER_SLOT_DEFAULTS: { color: string; thickness: number }[] = [
  { color: "#111111", thickness: 8 },
  { color: "#ffffff", thickness: 6 },
  { color: "#e11d48", thickness: 6 },
  { color: "#2563eb", thickness: 6 },
  { color: "#f59e0b", thickness: 6 },
  { color: "#16a34a", thickness: 6 },
];

export const MAX_LAYERS = 6;
