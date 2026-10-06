"use client";

import { useEffect, useRef } from "react";
import { MicOff, MonitorUp, Loader2 } from "lucide-react";
import { initials } from "@/lib/room";

type Props = {
  stream: MediaStream | null;
  name: string;
  audioOn: boolean;
  videoOn: boolean;
  isLocal?: boolean;
  isScreen?: boolean;
  connecting?: boolean;
  className?: string;
};

export function VideoTile({ stream, name, audioOn, videoOn, isLocal, isScreen, connecting, className = "" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);

  const showVideo = videoOn && !!stream;
  const mirror = isLocal && !isScreen;

  return (
    <div className={`relative min-h-0 overflow-hidden rounded-2xl bg-ink-800 ring-1 ring-white/5 ${className}`}>
      {/* Elemen video selalu dirender supaya audio peserta tetap terdengar walau kamera mati. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`h-full w-full ${isScreen ? "object-contain bg-black" : "object-cover"} ${
          mirror ? "-scale-x-100" : ""
        } ${showVideo ? "opacity-100" : "opacity-0"}`}
      />

      {!showVideo && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-accent/15 text-2xl font-semibold text-accent sm:h-24 sm:w-24 sm:text-3xl">
            {initials(name)}
          </div>
        </div>
      )}

      {connecting && (
        <div className="absolute inset-0 grid place-items-center bg-ink-950/50">
          <div className="flex items-center gap-2 rounded-full bg-ink-900/90 px-3 py-1.5 text-xs text-white/80">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Menyambungkan…
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-lg bg-ink-950/70 px-2 py-1 text-xs font-medium text-white backdrop-blur">
        {!audioOn && <MicOff className="h-3.5 w-3.5 shrink-0 text-danger" aria-label="Mikrofon mati" />}
        {isScreen && <MonitorUp className="h-3.5 w-3.5 shrink-0 text-accent" aria-label="Berbagi layar" />}
        <span className="truncate">
          {name}
          {isLocal ? " (Kamu)" : ""}
        </span>
      </div>
    </div>
  );
}
