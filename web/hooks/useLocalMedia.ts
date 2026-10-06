"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function describeMediaError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError") return "Izin kamera & mikrofon ditolak. Aktifkan lewat ikon gembok di address bar, lalu muat ulang halaman.";
  if (name === "NotFoundError") return "Kamera atau mikrofon tidak ditemukan di perangkat ini.";
  if (name === "NotReadableError") return "Kamera/mikrofon sedang dipakai aplikasi lain.";
  return "Tidak bisa mengakses kamera & mikrofon.";
}

/**
 * Mengelola kamera, mikrofon, dan share screen milik sendiri.
 * Mencoba video+audio dulu, lalu jatuh ke audio saja / video saja kalau salah satunya gagal.
 */
export function useLocalMedia() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [screenTrack, setScreenTrack] = useState<MediaStreamTrack | null>(null);
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Browser ini tidak mendukung kamera/mikrofon, atau halaman tidak dibuka lewat HTTPS / localhost.");
        setAudioOn(false);
        setVideoOn(false);
        setLoading(false);
        return;
      }

      const attempts: { constraints: MediaStreamConstraints; warning: string | null }[] = [
        {
          constraints: {
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: { echoCancellation: true, noiseSuppression: true },
          },
          warning: null,
        },
        { constraints: { audio: true, video: false }, warning: "Kamera tidak bisa diakses — kamu bergabung dengan audio saja." },
        { constraints: { audio: false, video: true }, warning: "Mikrofon tidak bisa diakses — kamu bergabung dengan video saja." },
      ];

      let lastError: unknown = null;
      for (const { constraints, warning } of attempts) {
        try {
          const media = await navigator.mediaDevices.getUserMedia(constraints);
          if (cancelled) {
            media.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = media;
          setStream(media);
          setAudioOn(media.getAudioTracks().length > 0);
          setVideoOn(media.getVideoTracks().length > 0);
          setError(warning);
          setLoading(false);
          return;
        } catch (err) {
          lastError = err;
          // Izin ditolak tidak akan berubah dengan constraint lain.
          if (err instanceof DOMException && err.name === "NotAllowedError") break;
        }
      }

      if (cancelled) return;
      setError(describeMediaError(lastError));
      setAudioOn(false);
      setVideoOn(false);
      setLoading(false);
    }

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      screenRef.current?.stop();
    };
  }, []);

  const hasAudio = (stream?.getAudioTracks().length ?? 0) > 0;
  const hasVideo = (stream?.getVideoTracks().length ?? 0) > 0;

  const toggleAudio = useCallback(() => {
    const tracks = streamRef.current?.getAudioTracks() ?? [];
    if (tracks.length === 0) return;
    setAudioOn((prev) => {
      tracks.forEach((t) => (t.enabled = !prev));
      return !prev;
    });
  }, []);

  const toggleVideo = useCallback(() => {
    const tracks = streamRef.current?.getVideoTracks() ?? [];
    if (tracks.length === 0) return;
    setVideoOn((prev) => {
      tracks.forEach((t) => (t.enabled = !prev));
      return !prev;
    });
  }, []);

  const stopScreenShare = useCallback(() => {
    screenRef.current?.stop();
    screenRef.current = null;
    setScreenTrack(null);
  }, []);

  const startScreenShare = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert("Browser ini tidak mendukung berbagi layar.");
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = display.getVideoTracks()[0];
      if (!track) return;
      // Dipanggil saat user klik "Stop sharing" dari bar bawaan browser.
      track.onended = () => {
        if (screenRef.current === track) stopScreenShare();
      };
      screenRef.current = track;
      setScreenTrack(track);
    } catch {
      // user membatalkan dialog pilih layar — tidak perlu apa-apa
    }
  }, [stopScreenShare]);

  /** Mematikan semua perangkat (dipanggil saat keluar meeting). */
  const stopAll = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    stopScreenShare();
  }, [stopScreenShare]);

  return {
    stream,
    screenTrack,
    audioOn,
    videoOn,
    hasAudio,
    hasVideo,
    loading,
    error,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    stopAll,
  };
}
