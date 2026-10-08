export type BackgroundEffect =
  | { type: "none" }
  | { type: "blur"; strength: "light" | "strong" }
  | { type: "preset"; id: string }
  // url = object URL dari file yang dipilih user; file tidak pernah diunggah ke server.
  | { type: "image"; url: string };

export type ColorFilter = "none" | "bw" | "warm" | "cool" | "vivid" | "vintage";

export type FaceSticker = "none" | "shades" | "clown" | "mustache" | "crown" | "cat";

export type VideoEffects = {
  background: BackgroundEffect;
  filter: ColorFilter;
  sticker: FaceSticker;
};

export const NO_EFFECTS: VideoEffects = {
  background: { type: "none" },
  filter: "none",
  sticker: "none",
};

export function hasEffects(effects: VideoEffects): boolean {
  return effects.background.type !== "none" || effects.filter !== "none" || effects.sticker !== "none";
}

export const COLOR_FILTERS: { id: ColorFilter; label: string; css: string }[] = [
  { id: "none", label: "Normal", css: "none" },
  { id: "bw", label: "Hitam putih", css: "grayscale(1) contrast(1.1)" },
  { id: "warm", label: "Hangat", css: "sepia(0.25) saturate(1.3) hue-rotate(-8deg)" },
  { id: "cool", label: "Sejuk", css: "saturate(1.1) hue-rotate(12deg) brightness(1.03)" },
  { id: "vivid", label: "Cerah", css: "saturate(1.6) contrast(1.08)" },
  { id: "vintage", label: "Jadul", css: "sepia(0.55) contrast(0.95) brightness(1.05)" },
];

export const FACE_STICKERS: { id: FaceSticker; label: string; emoji: string }[] = [
  { id: "none", label: "Tanpa stiker", emoji: "🚫" },
  { id: "shades", label: "Kacamata", emoji: "😎" },
  { id: "clown", label: "Hidung badut", emoji: "🔴" },
  { id: "mustache", label: "Kumis", emoji: "🥸" },
  { id: "crown", label: "Mahkota", emoji: "👑" },
  { id: "cat", label: "Telinga kucing", emoji: "🐱" },
];

export function colorFilterCss(filter: ColorFilter): string {
  return COLOR_FILTERS.find((f) => f.id === filter)?.css ?? "none";
}
