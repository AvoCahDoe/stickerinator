export type RGB = [number, number, number];
export type RGBA = [number, number, number, number];
export type Margins = [number, number, number, number]; // top, right, bottom, left

export type LayerSpec = {
  thickness: number;
  color: RGB;
};

export type ProcessMode = "full" | "layers_only";

export type StickerInfo = {
  mode: ProcessMode;
  sourceSize?: [number, number];
  margins?: Margins;
  background?: RGB;
  detected?: RGB;
  backgroundFromAlpha?: boolean;
  seed?: [number, number];
  subjectPixels: number;
  borderPixels: number;
  layers: LayerSpec[];
  outputSize: [number, number];
  warning?: string;
};

export type ProcessOptions = {
  mode: ProcessMode;
  marginLinked: boolean;
  marginPx: number;
  margins: Margins;
  autoBackground: boolean;
  background: RGB;
  threshold: number;
  addBorder: boolean;
  borderRadius: number;
  layers: LayerSpec[];
  crop: boolean;
  cropPad: number;
};
