"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { removeBackgroundAi, type BgRemoveProgress } from "@/lib/ai/removeBackground";
import { ingestFile, ingestUrl, isSupportedFile } from "@/lib/ingest";
import {
  DEFAULT_PRESETS,
  LAYER_SLOT_DEFAULTS,
  MAX_LAYERS,
  layersToPreset,
  loadPresets,
  presetToLayers,
  savePresets,
  type LayerPreset,
} from "@/lib/presets";
import { detectBackground } from "@/lib/sticker/detectBackground";
import {
  canvasToBlob,
  downloadBlob,
  hexToRgb,
  imageDataToCanvas,
  imageDataToObjectUrl,
  rgbToHex,
} from "@/lib/sticker/imageData";
import { renderMargin } from "@/lib/sticker/margin";
import { processSticker } from "@/lib/sticker/process";
import type { LayerSpec, Margins, ProcessMode, StickerInfo } from "@/lib/sticker/types";

const SAMPLES = [
  { name: "openai.png", label: "OpenAI" },
  { name: "github.png", label: "GitHub" },
  { name: "gemini-color.png", label: "Gemini" },
];

type PreviewUrls = {
  source?: string;
  margin?: string;
  sticker?: string;
};

function PreviewFrame({
  title,
  url,
  empty,
}: {
  title: string;
  url?: string;
  empty: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3 className="font-[family-name:var(--font-display)] text-sm tracking-wide text-fog">
          {title}
        </h3>
      </div>
      <div className="checker relative aspect-square overflow-hidden rounded-xl border border-line transition-[border-color] duration-300 hover:border-citrus/40">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={title}
            className="absolute inset-0 h-full w-full object-contain p-3 transition-opacity duration-300"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center px-4 text-center text-sm text-mist">
            {empty}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StickerWorkspace() {
  const [mode, setMode] = useState<ProcessMode>("full");
  const [stem, setStem] = useState("sticker");
  const [source, setSource] = useState<ImageData | null>(null);
  const [working, setWorking] = useState<ImageData | null>(null);
  const [marginPreview, setMarginPreview] = useState<ImageData | null>(null);
  const [sticker, setSticker] = useState<ImageData | null>(null);
  const [info, setInfo] = useState<StickerInfo | null>(null);
  const [urls, setUrls] = useState<PreviewUrls>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiProgress, setAiProgress] = useState<BgRemoveProgress | null>(null);

  const [marginLinked, setMarginLinked] = useState(true);
  const [marginPx, setMarginPx] = useState(64);
  const [margins, setMargins] = useState<Margins>([64, 64, 64, 64]);
  const [autoBg, setAutoBg] = useState(true);
  const [bgColor, setBgColor] = useState("#4c6971");
  const [threshold, setThreshold] = useState(150);
  const [addBorder, setAddBorder] = useState(true);
  const [borderRadius, setBorderRadius] = useState(8);
  const [layerCount, setLayerCount] = useState(0);
  const [layerSlots, setLayerSlots] = useState(
    LAYER_SLOT_DEFAULTS.map((s) => ({ ...s })),
  );
  const [crop, setCrop] = useState(true);
  const [cropPad, setCropPad] = useState(16);
  const [useAi, setUseAi] = useState(false);

  const [presets, setPresets] = useState<Record<string, LayerPreset>>(DEFAULT_PRESETS);
  const [presetName, setPresetName] = useState("");
  const [presetPick, setPresetPick] = useState("Black + white");

  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  const activeLayers: LayerSpec[] = useMemo(() => {
    return layerSlots.slice(0, layerCount).map((s) => ({
      thickness: s.thickness,
      color: hexToRgb(s.color),
    }));
  }, [layerCount, layerSlots]);

  useEffect(() => {
    setUrls({
      source: working ? imageDataToObjectUrl(working) : source ? imageDataToObjectUrl(source) : undefined,
      margin: marginPreview ? imageDataToObjectUrl(marginPreview) : undefined,
      sticker: sticker ? imageDataToObjectUrl(sticker) : undefined,
    });
  }, [source, working, marginPreview, sticker]);

  const loadImageData = useCallback(async (image: ImageData, nameStem: string) => {
    setStem(nameStem);
    setSource(image);
    setWorking(image);
    setUseAi(false);
    setAiProgress(null);
    setSticker(null);
    setInfo(null);
    setError(null);
    const { color } = detectBackground(image);
    const hex = rgbToHex(color);
    setBgColor(hex);
    setAutoBg(true);
    const suggested = Math.round(Math.max(image.width, image.height) * 0.1);
    setMarginPx(suggested);
    setMargins([suggested, suggested, suggested, suggested]);
  }, []);

  const onFile = async (file: File | null) => {
    if (!file) return;
    if (!isSupportedFile(file)) {
      setError("Use PNG, JPG, WebP, GIF, BMP, SVG, or PDF.");
      return;
    }
    setBusy("Reading file…");
    setError(null);
    try {
      const result = await ingestFile(file);
      await loadImageData(result.image, result.stem);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load file");
    } finally {
      setBusy(null);
    }
  };

  const onSample = async (name: string) => {
    setBusy("Loading sample…");
    setError(null);
    try {
      const result = await ingestUrl(`/samples/${name}`, name);
      await loadImageData(result.image, result.stem);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sample");
    } finally {
      setBusy(null);
    }
  };

  // Live margin preview in full mode
  useEffect(() => {
    if (!working || mode !== "full") {
      if (mode === "layers_only") setMarginPreview(null);
      return;
    }
    const bg = autoBg ? null : hexToRgb(bgColor);
    const { image: padded } = renderMargin(
      working,
      marginLinked ? marginPx : margins,
      bg,
    );
    setMarginPreview(padded);
  }, [working, mode, marginLinked, marginPx, margins, autoBg, bgColor]);

  const runAi = async () => {
    if (!source) {
      setError("Upload an image first.");
      return;
    }
    setBusy("AI background removal…");
    setError(null);
    try {
      const cleaned = await removeBackgroundAi(source, setAiProgress);
      setWorking(cleaned);
      setUseAi(true);
      setSticker(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI removal failed");
      setAiProgress({ phase: "error", message: "AI removal failed" });
    } finally {
      setBusy(null);
    }
  };

  const resetAi = () => {
    if (!source) return;
    setWorking(source);
    setUseAi(false);
    setAiProgress(null);
    setSticker(null);
  };

  const makeSticker = () => {
    if (!working) {
      setError("Upload an image first.");
      return;
    }
    setBusy("Making sticker…");
    setError(null);
    try {
      const result = processSticker(working, {
        mode,
        marginLinked,
        marginPx,
        margins,
        autoBackground: autoBg,
        background: hexToRgb(bgColor),
        threshold,
        addBorder,
        borderRadius,
        layers: activeLayers,
        crop,
        cropPad,
      });
      setSticker(result.image);
      setInfo(result.info);
      if ("marginPreview" in result && result.marginPreview) {
        setMarginPreview(result.marginPreview);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Processing failed");
    } finally {
      setBusy(null);
    }
  };

  const download = async (kind: "margin" | "sticker") => {
    const data = kind === "margin" ? marginPreview : sticker;
    if (!data) return;
    const canvas = imageDataToCanvas(data);
    const blob = await canvasToBlob(canvas);
    const name = kind === "margin" ? `${stem}-margin.png` : `${stem}.png`;
    downloadBlob(blob, name);
  };

  const loadPreset = () => {
    const preset = presets[presetPick];
    if (!preset) return;
    const layers = presetToLayers(preset);
    setLayerCount(layers.length);
    setLayerSlots((slots) =>
      slots.map((slot, i) =>
        i < layers.length
          ? { color: rgbToHex(layers[i].color), thickness: layers[i].thickness }
          : slot,
      ),
    );
  };

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) {
      setError("Give the preset a name.");
      return;
    }
    const next = {
      ...presets,
      [name]: layersToPreset(activeLayers),
    };
    setPresets(next);
    savePresets(next);
    setPresetPick(name);
    setPresetName("");
    setError(null);
  };

  const deletePreset = () => {
    if (!presetPick) return;
    if (DEFAULT_PRESETS[presetPick]) {
      setError("Built-in presets cannot be deleted.");
      return;
    }
    const next = { ...presets };
    delete next[presetPick];
    const custom: Record<string, LayerPreset> = {};
    for (const [key, value] of Object.entries(next)) {
      if (!DEFAULT_PRESETS[key]) custom[key] = value;
    }
    savePresets(custom);
    setPresets({ ...DEFAULT_PRESETS, ...custom });
    setPresetPick("White only");
    setError(null);
  };

  const statusLine = useMemo(() => {
    if (busy) return busy;
    if (aiProgress && aiProgress.phase !== "done") return aiProgress.message;
    if (error) return error;
    if (info) {
      const bits = [
        info.mode === "layers_only" ? "layers only" : "full process",
        `${info.outputSize[0]}×${info.outputSize[1]}`,
      ];
      if (info.layers.length) {
        bits.push(
          `layers ${info.layers.map((l) => `${l.thickness}px ${rgbToHex(l.color)}`).join(", ")}`,
        );
      }
      if (info.warning) bits.push(info.warning);
      return bits.join(" · ");
    }
    return "Upload a PNG, SVG, or PDF — then make a sticker.";
  }, [aiProgress, busy, error, info]);

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 pb-16 pt-10 sm:px-8">
      <header className="animate-rise space-y-4">
        <p className="text-xs uppercase tracking-[0.28em] text-mist">Die-cut studio</p>
        <h1 className="font-[family-name:var(--font-display)] text-5xl leading-[0.95] tracking-tight text-fog sm:text-6xl">
          Stickerinator
        </h1>
        <p className="max-w-xl text-base text-mist">
          Margin, flood-fill cutout, and stacked outline layers — with optional on-device AI
          background removal. SVG and PDF welcome.
        </p>
        <div className="inline-flex rounded-full border border-line bg-panel p-1">
          {(
            [
              ["full", "Full process"],
              ["layers_only", "Layers only"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                mode === value
                  ? "bg-citrus text-ink"
                  : "text-mist hover:text-fog"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <section className="animate-rise grid gap-6 lg:grid-cols-[0.9fr_1.3fr]" style={{ animationDelay: "60ms" }}>
        <div className="flex flex-col gap-4">
          <label
            className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-panel px-6 py-10 transition hover:border-citrus/50 hover:bg-ink-soft"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) void onFile(file);
            }}
          >
            <span className="font-[family-name:var(--font-display)] text-lg text-fog">
              Drop a logo
            </span>
            <span className="text-sm text-mist">PNG · JPG · WebP · SVG · PDF</span>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,.svg,.pdf,image/*,application/pdf"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0] || null)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => void onSample(s.name)}
                className="rounded-full border border-line px-3 py-1.5 text-xs text-mist transition hover:border-citrus/40 hover:text-fog"
              >
                {s.label}
              </button>
            ))}
          </div>
          <PreviewFrame title="Source" url={urls.source} empty="Nothing loaded yet" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <PreviewFrame
            title="Margin"
            url={mode === "full" ? urls.margin : undefined}
            empty={mode === "full" ? "Margin preview" : "Hidden in Layers only"}
          />
          <PreviewFrame title="Sticker" url={urls.sticker} empty="Hit Make sticker" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="button"
              disabled={!marginPreview || mode !== "full"}
              onClick={() => void download("margin")}
              className="rounded-full border border-line px-4 py-2 text-sm text-fog disabled:opacity-40"
            >
              Download margin
            </button>
            <button
              type="button"
              disabled={!sticker}
              onClick={() => void download("sticker")}
              className="rounded-full border border-line px-4 py-2 text-sm text-fog disabled:opacity-40"
            >
              Download sticker
            </button>
            <button
              type="button"
              onClick={makeSticker}
              className="btn-pulse ml-auto rounded-full bg-citrus px-5 py-2 text-sm font-medium text-ink transition hover:brightness-110"
            >
              Make sticker
            </button>
          </div>
        </div>
      </section>

      <section className="animate-rise grid gap-8 lg:grid-cols-2" style={{ animationDelay: "120ms" }}>
        {mode === "full" && (
          <div className="space-y-4 rounded-2xl border border-line bg-panel p-5">
            <h2 className="font-[family-name:var(--font-display)] text-xl text-fog">Margin</h2>
            <label className="flex items-center gap-2 text-sm text-mist">
              <input
                type="checkbox"
                checked={marginLinked}
                onChange={(e) => setMarginLinked(e.target.checked)}
              />
              Same margin on every side
            </label>
            {marginLinked ? (
              <label className="block text-sm text-mist">
                Margin (px): {marginPx}
                <input
                  type="range"
                  min={0}
                  max={240}
                  value={marginPx}
                  onChange={(e) => setMarginPx(Number(e.target.value))}
                  className="mt-2 w-full"
                />
              </label>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {(["Top", "Right", "Bottom", "Left"] as const).map((label, i) => (
                  <label key={label} className="block text-sm text-mist">
                    {label}: {margins[i]}
                    <input
                      type="range"
                      min={0}
                      max={240}
                      value={margins[i]}
                      onChange={(e) => {
                        const next = [...margins] as Margins;
                        next[i] = Number(e.target.value);
                        setMargins(next);
                      }}
                      className="mt-2 w-full"
                    />
                  </label>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-mist">
              <input
                type="checkbox"
                checked={autoBg}
                onChange={(e) => {
                  setAutoBg(e.target.checked);
                  if (e.target.checked && working) {
                    const { color } = detectBackground(working);
                    setBgColor(rgbToHex(color));
                  }
                }}
              />
              Detect background from corners
            </label>
            <label className="flex items-center gap-3 text-sm text-mist">
              Background
              <input
                type="color"
                value={bgColor}
                onChange={(e) => {
                  setBgColor(e.target.value);
                  setAutoBg(false);
                }}
              />
              <span className="font-mono text-xs">{bgColor}</span>
            </label>
            <label className="block text-sm text-mist">
              Flood-fill threshold: {threshold}
              <input
                type="range"
                min={0}
                max={400}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </label>
          </div>
        )}

        <div className="space-y-4 rounded-2xl border border-line bg-panel p-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-fog">Layers</h2>
          <label className="flex items-center gap-2 text-sm text-mist">
            <input
              type="checkbox"
              checked={addBorder}
              onChange={(e) => setAddBorder(e.target.checked)}
            />
            White sticker border
          </label>
          <label className="block text-sm text-mist">
            Border thickness: {borderRadius}px
            <input
              type="range"
              min={0}
              max={40}
              value={borderRadius}
              onChange={(e) => setBorderRadius(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>
          <label className="block text-sm text-mist">
            External layers: {layerCount}
            <input
              type="range"
              min={0}
              max={MAX_LAYERS}
              value={layerCount}
              onChange={(e) => setLayerCount(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>
          <div className="space-y-3">
            {layerSlots.slice(0, layerCount).map((slot, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-16 text-xs text-mist">Layer {i + 1}</span>
                <input
                  type="color"
                  value={slot.color}
                  onChange={(e) => {
                    const next = [...layerSlots];
                    next[i] = { ...next[i], color: e.target.value };
                    setLayerSlots(next);
                  }}
                />
                <input
                  type="range"
                  min={1}
                  max={48}
                  value={slot.thickness}
                  onChange={(e) => {
                    const next = [...layerSlots];
                    next[i] = { ...next[i], thickness: Number(e.target.value) };
                    setLayerSlots(next);
                  }}
                  className="flex-1"
                />
                <span className="w-10 text-right text-xs text-mist">{slot.thickness}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t border-line pt-4">
            <h3 className="text-sm text-fog">Presets</h3>
            <div className="flex flex-wrap gap-2">
              <select
                value={presetPick}
                onChange={(e) => setPresetPick(e.target.value)}
                className="rounded-lg border border-line bg-ink-soft px-3 py-2 text-sm text-fog"
              >
                {Object.keys(presets)
                  .sort((a, b) => a.localeCompare(b))
                  .map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={loadPreset}
                className="rounded-full border border-line px-3 py-1.5 text-xs text-fog"
              >
                Load
              </button>
              <button
                type="button"
                onClick={deletePreset}
                className="rounded-full border border-line px-3 py-1.5 text-xs text-fog"
              >
                Delete
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Save as…"
                className="flex-1 rounded-lg border border-line bg-ink-soft px-3 py-2 text-sm text-fog outline-none focus:border-citrus/50"
              />
              <button
                type="button"
                onClick={savePreset}
                className="rounded-full border border-line px-3 py-1.5 text-xs text-fog"
              >
                Save
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-mist">
            <input type="checkbox" checked={crop} onChange={(e) => setCrop(e.target.checked)} />
            Crop to the subject
          </label>
          <label className="block text-sm text-mist">
            Crop padding: {cropPad}px
            <input
              type="range"
              min={0}
              max={80}
              value={cropPad}
              onChange={(e) => setCropPad(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>
        </div>

        <div className="space-y-4 rounded-2xl border border-line bg-panel p-5 lg:col-span-2">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-fog">
            Smart background remover
          </h2>
          <p className="text-sm text-mist">
            Runs on-device with IMG.LY — no API key. Best before Layers only, or to clean a photo
            before Full process.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runAi()}
              disabled={!source || Boolean(busy)}
              className="rounded-full bg-coral/90 px-4 py-2 text-sm text-ink disabled:opacity-40"
            >
              {useAi ? "Re-run AI remove" : "Remove background (AI)"}
            </button>
            <button
              type="button"
              onClick={resetAi}
              disabled={!useAi}
              className="rounded-full border border-line px-4 py-2 text-sm text-fog disabled:opacity-40"
            >
              Reset to original
            </button>
          </div>
        </div>
      </section>

      <p
        className={`text-sm ${error ? "text-coral" : "text-mist"}`}
        role="status"
      >
        {statusLine}
      </p>
    </div>
  );
}
