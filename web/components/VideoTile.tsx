"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Expand, Loader2, MicOff, MonitorUp, Shrink } from "lucide-react";
import { initials } from "@/lib/room";

type Props = {
  stream: MediaStream | null;
  name: string;
  audioOn: boolean;
  videoOn: boolean;
  isLocal?: boolean;
  isScreen?: boolean;
  connecting?: boolean;
  /** Tampilkan tombol layar penuh (dipakai untuk tile share screen). */
  allowFullscreen?: boolean;
  compact?: boolean;
  className?: string;
};

type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

function VideoTileBase({
  stream,
  name,
  audioOn,
  videoOn,
  isLocal,
  isScreen,
  connecting,
  allowFullscreen,
  compact,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    if (!allowFullscreen) return;
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [allowFullscreen]);

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    const video = videoRef.current as WebkitVideo | null;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        screen.orientation?.unlock?.();
      } else if (container?.requestFullscreen) {
        await container.requestFullscreen();
        // Di HP, putar ke landscape supaya layar yang dibagikan terlihat besar.
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })
          .lock?.("landscape")
          .catch(() => undefined);
      } else {
        // iOS Safari: hanya elemen <video> yang bisa fullscreen.
        video?.webkitEnterFullscreen?.();
      }
    } catch (err) {
      console.warn("Fullscreen gagal", err);
    }
  };

  const showVideo = videoOn && !!stream;
  const mirror = isLocal && !isScreen;

  return (
    <div
      ref={containerRef}
      onDoubleClick={allowFullscreen ? toggleFullscreen : undefined}
      className={`group relative min-h-0 overflow-hidden rounded-2xl bg-ink-800 ring-1 ring-white/5 ${
        fullscreen ? "rounded-none" : ""
      } ${className}`}
    >
      {/* Elemen video selalu dirender supaya audio peserta tetap terdengar walau kamera mati. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`h-full w-full ${isScreen ? "bg-black object-contain" : "object-cover"} ${
          mirror ? "-scale-x-100" : ""
        } ${showVideo ? "opacity-100" : "opacity-0"}`}
      />

      {!showVideo && (
        <div className="absolute inset-0 grid place-items-center">
          <div
            className={`grid place-items-center rounded-full bg-accent font-bold text-ink-950 ${
              compact ? "h-10 w-10 text-sm" : "h-16 w-16 text-xl sm:h-24 sm:w-24 sm:text-3xl"
            }`}
          >
            {initials(name)}
          </div>
        </div>
      )}

      {connecting && (
        <div className="absolute inset-0 grid place-items-center bg-ink-950/50">
          <div className="flex items-center gap-2 rounded-full bg-ink-900/90 px-3 py-1.5 text-xs text-white/80">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {!compact && "Menyambungkan…"}
          </div>
        </div>
      )}

      {allowFullscreen && (
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={fullscreen ? "Keluar layar penuh" : "Layar penuh"}
          title={fullscreen ? "Keluar layar penuh" : "Layar penuh"}
          className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full bg-ink-950/70 text-white backdrop-blur transition hover:bg-accent hover:text-ink-950"
        >
          {fullscreen ? <Shrink className="h-5 w-5" /> : <Expand className="h-5 w-5" />}
        </button>
      )}

      <div
        className={`absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-lg bg-ink-950/75 px-2 py-1 font-medium text-white backdrop-blur ${
          compact ? "text-[10px]" : "text-xs"
        }`}
      >
        {!audioOn && <MicOff className="h-3.5 w-3.5 shrink-0 text-danger" aria-label="Mikrofon mati" />}
        {isScreen && <MonitorUp className="h-3.5 w-3.5 shrink-0 text-accent" aria-label="Berbagi layar" />}
        <span className="truncate">
          {name}
          {isLocal ? " (Kamu)" : ""}
          {isScreen && !compact ? " · layar" : ""}
        </span>
      </div>
    </div>
  );
}

export const VideoTile = memo(VideoTileBase);
