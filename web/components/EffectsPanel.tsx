"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, Ban, ImagePlus, Loader2 } from "lucide-react";
import { BACKGROUND_PRESETS, drawPreset } from "@/lib/effects/backgrounds";
import { COLOR_FILTERS, FACE_STICKERS, type BackgroundEffect, type VideoEffects } from "@/lib/effects/types";
import { QUALITY_OPTIONS, type QualityMode } from "@/lib/quality";

type Props = {
  effects: VideoEffects;
  onChange: (effects: VideoEffects) => void;
  onPickImage: (file: File) => void;
  loading: boolean;
  error: string | null;
  supportsFilter: boolean;
  hasVideo: boolean;
  quality: QualityMode;
  onQualityChange: (mode: QualityMode) => void;
};

function sameBackground(a: BackgroundEffect, b: BackgroundEffect): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "blur" && b.type === "blur") return a.strength === b.strength;
  if (a.type === "preset" && b.type === "preset") return a.id === b.id;
  return true;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">{title}</h3>
      {children}
    </section>
  );
}

function Tile({ selected, label, onClick, children }: { selected: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={label}
      className={`relative aspect-video overflow-hidden rounded-xl bg-ink-800 text-xs font-medium text-white ring-2 transition ${
        selected ? "ring-accent" : "ring-transparent hover:ring-white/20"
      }`}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function PresetThumb({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) drawPreset(id, ctx, 160, 90);
  }, [id]);
  return <canvas ref={ref} width={160} height={90} className="h-full w-full" />;
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full px-3 py-1.5 text-sm transition ${
        selected ? "bg-accent font-semibold text-ink-950" : "bg-ink-800 text-white/80 hover:bg-ink-700"
      }`}
    >
      {children}
    </button>
  );
}

export function EffectsPanel(props: Props) {
  const { effects, onChange } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const setBackground = (background: BackgroundEffect) => onChange({ ...effects, background });

  return (
    <div className="h-full space-y-5 overflow-y-auto px-4 py-4">
      <Section title="Kualitas video">
        <div className="grid gap-1.5">
          {QUALITY_OPTIONS.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ring-1 transition ${
                props.quality === option.id ? "bg-accent/10 ring-accent" : "ring-white/10 hover:bg-white/5"
              }`}
            >
              <input
                type="radio"
                name="quality"
                checked={props.quality === option.id}
                onChange={() => props.onQualityChange(option.id)}
                className="accent-[#ffcc00]"
              />
              <span className="flex-1">
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-xs text-white/50">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </Section>

      {!props.hasVideo ? (
        <p className="rounded-xl bg-ink-800 p-3 text-sm text-white/60">Kamera tidak tersedia, jadi efek video tidak bisa dipakai.</p>
      ) : (
        <>
          {(props.loading || props.error) && (
            <div
              className={`flex items-start gap-2 rounded-xl p-3 text-sm ${
                props.error ? "bg-danger/10 text-red-200 ring-1 ring-danger/30" : "bg-accent/10 text-accent"
              }`}
              role="status"
            >
              {props.error ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
              )}
              <span>{props.error ?? "Menyiapkan efek… (pertama kali butuh unduh ±13 MB)"}</span>
            </div>
          )}

          <Section title="Background">
            <div className="grid grid-cols-3 gap-2">
              <Tile selected={effects.background.type === "none"} label="Tanpa background" onClick={() => setBackground({ type: "none" })}>
                <span className="grid h-full place-items-center">
                  <Ban className="h-5 w-5 text-white/60" />
                </span>
              </Tile>
              <Tile
                selected={sameBackground(effects.background, { type: "blur", strength: "light" })}
                label="Blur ringan"
                onClick={() => setBackground({ type: "blur", strength: "light" })}
              >
                <span className="grid h-full place-items-center bg-linear-to-br from-ink-600 to-ink-800 backdrop-blur-sm">Blur</span>
              </Tile>
              <Tile
                selected={sameBackground(effects.background, { type: "blur", strength: "strong" })}
                label="Blur kuat"
                onClick={() => setBackground({ type: "blur", strength: "strong" })}
              >
                <span className="grid h-full place-items-center bg-linear-to-br from-ink-600 to-ink-800 font-bold">Blur+</span>
              </Tile>
              {BACKGROUND_PRESETS.map((preset) => (
                <Tile
                  key={preset.id}
                  selected={sameBackground(effects.background, { type: "preset", id: preset.id })}
                  label={preset.label}
                  onClick={() => setBackground({ type: "preset", id: preset.id })}
                >
                  <PresetThumb id={preset.id} />
                </Tile>
              ))}
              <Tile selected={effects.background.type === "image"} label="Pakai foto sendiri" onClick={() => fileRef.current?.click()}>
                <span className="flex h-full flex-col items-center justify-center gap-1 text-white/70">
                  <ImagePlus className="h-5 w-5" />
                  Foto
                </span>
              </Tile>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) props.onPickImage(file);
                e.target.value = "";
              }}
            />
            <p className="text-xs text-white/40">Foto diproses di perangkatmu dan tidak diunggah ke server.</p>
          </Section>

          {props.supportsFilter && (
            <Section title="Filter warna">
              <div className="flex flex-wrap gap-2">
                {COLOR_FILTERS.map((f) => (
                  <Chip key={f.id} selected={effects.filter === f.id} onClick={() => onChange({ ...effects, filter: f.id })}>
                    {f.label}
                  </Chip>
                ))}
              </div>
            </Section>
          )}

          <Section title="Stiker wajah">
            <div className="grid grid-cols-3 gap-2">
              {FACE_STICKERS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChange({ ...effects, sticker: s.id })}
                  aria-pressed={effects.sticker === s.id}
                  className={`flex flex-col items-center gap-1 rounded-xl py-2.5 text-xs transition ${
                    effects.sticker === s.id ? "bg-accent font-semibold text-ink-950" : "bg-ink-800 text-white/80 hover:bg-ink-700"
                  }`}
                >
                  <span className="text-2xl leading-none">{s.emoji}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
