"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hasEffects, NO_EFFECTS, type VideoEffects } from "@/lib/effects/types";
import type { VideoEffectsProcessor } from "@/lib/effects/processor";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Menyalakan pipeline efek hanya kalau ada efek yang dipilih. Tanpa efek, track kamera asli
 * dipakai langsung (tanpa biaya CPU tambahan). Modul MediaPipe di-import secara lazy.
 */
export function useVideoEffects(cameraTrack: MediaStreamTrack | null, { paused }: { paused: boolean }) {
  const [effects, setEffectsState] = useState<VideoEffects>(NO_EFFECTS);
  const [outputTrack, setOutputTrack] = useState<MediaStreamTrack | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supportsFilter, setSupportsFilter] = useState(true);
  const processorRef = useRef<VideoEffectsProcessor | null>(null);
  const imageUrlRef = useRef<string | null>(null);

  const active = hasEffects(effects) && !!cameraTrack;

  useEffect(() => {
    import("@/lib/effects/processor").then((m) => setSupportsFilter(m.supportsCanvasFilter()));
  }, []);

  // Buat / hancurkan processor saat efek dinyalakan / dimatikan semua.
  useEffect(() => {
    if (!active || !cameraTrack) return;
    let cancelled = false;
    let processor: VideoEffectsProcessor | null = null;
    setLoading(true);

    import("@/lib/effects/processor")
      .then(({ VideoEffectsProcessor }) => VideoEffectsProcessor.create(cameraTrack))
      .then((created) => {
        if (cancelled) return created.destroy();
        processor = created;
        processorRef.current = created;
        setOutputTrack(created.track);
      })
      .catch((err) => {
        console.error("Gagal menyiapkan efek video", err);
        if (!cancelled) {
          setError("Efek video tidak didukung di perangkat ini.");
          setEffectsState(NO_EFFECTS);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      processor?.destroy();
      processorRef.current = null;
      setOutputTrack(null);
    };
  }, [active, cameraTrack]);

  // Terapkan efek terbaru ke processor (memuat model bila perlu).
  useEffect(() => {
    const processor = processorRef.current;
    if (!processor || !outputTrack) return;
    let cancelled = false;
    setLoading(true);
    processor
      .setEffects(effects)
      .then(() => !cancelled && setError(null))
      .catch((err) => {
        console.error("Gagal memuat efek", err);
        if (!cancelled) {
          setError("Gagal memuat efek. Periksa koneksi internet lalu coba lagi.");
          setEffectsState(NO_EFFECTS);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [effects, outputTrack]);

  useEffect(() => {
    processorRef.current?.setPaused(paused);
    if (outputTrack) outputTrack.enabled = !paused;
  }, [paused, outputTrack]);

  // Lepas object URL gambar saat komponen dilepas.
  useEffect(
    () => () => {
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    },
    [],
  );

  const setEffects = useCallback((next: VideoEffects) => {
    setError(null);
    setEffectsState(next);
  }, []);

  /** Pakai foto dari perangkat sebagai background. File hanya diproses lokal, tidak diunggah. */
  const setBackgroundImage = useCallback(async (file: File) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Format gambar harus JPG, PNG, atau WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Ukuran gambar maksimal 10 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
    } catch {
      URL.revokeObjectURL(url);
      setError("Gambar tidak bisa dibuka.");
      return;
    }
    const previous = imageUrlRef.current;
    imageUrlRef.current = url;
    setError(null);
    setEffectsState((cur) => ({ ...cur, background: { type: "image", url } }));
    // Gambar lama dilepas setelah processor sempat pindah ke gambar baru.
    if (previous) setTimeout(() => URL.revokeObjectURL(previous), 2000);
  }, []);

  return {
    effects,
    setEffects,
    setBackgroundImage,
    /** Track video hasil efek; null kalau tidak ada efek (pakai kamera asli). */
    outputTrack: active ? outputTrack : null,
    loading: active && (loading || !outputTrack),
    error,
    supportsFilter,
  };
}
