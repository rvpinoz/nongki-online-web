"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, Loader2, Mic, MicOff, Sparkles, Users, Video, VideoOff, WifiOff, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { VideoTile } from "@/components/VideoTile";
import { SpotlightLayout, VideoGrid } from "@/components/VideoGrid";
import { ControlBar, RoundButton } from "@/components/ControlBar";
import { ChatPanel } from "@/components/ChatPanel";
import { ParticipantList } from "@/components/ParticipantList";
import { EffectsPanel } from "@/components/EffectsPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import { useVideoEffects } from "@/hooks/useVideoEffects";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useBackGuard } from "@/hooks/useBackGuard";
import { hasEffects } from "@/lib/effects/types";
import type { QualityMode } from "@/lib/quality";
import type { Panel } from "@/lib/types";

type Stage = "lobby" | "meeting" | "left";
const NAME_KEY = "nongki:name";
const LEGACY_NAME_KEY = "meetlite:name";
const QUALITY_KEY = "nongki:quality";
const PANEL_TITLES: Record<Panel, string> = { chat: "Chat", people: "Peserta", effects: "Efek & kualitas" };

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = (params?.id ?? "").toLowerCase();
  const validRoom = /^[a-z0-9-]{3,40}$/.test(roomId);

  const media = useLocalMedia();
  const [stage, setStage] = useState<Stage>("lobby");
  const [name, setName] = useState("");
  const [panel, setPanel] = useState<Panel | null>(null);
  const [quality, setQuality] = useState<QualityMode>("auto");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [lastReadId, setLastReadId] = useState<string | null>(null);

  useEffect(() => {
    try {
      setName(localStorage.getItem(NAME_KEY) ?? localStorage.getItem(LEGACY_NAME_KEY) ?? "");
      const savedQuality = localStorage.getItem(QUALITY_KEY);
      if (savedQuality === "auto" || savedQuality === "hemat" || savedQuality === "hd") setQuality(savedQuality);
    } catch {
      // localStorage tidak tersedia (mode privat, dll.)
    }
  }, []);

  const sharing = !!media.screenTrack;
  const fx = useVideoEffects(media.cameraTrack, { paused: !media.videoOn || sharing });
  const cameraOut = fx.outputTrack ?? media.cameraTrack;
  const outgoingVideo = media.screenTrack ?? cameraOut;

  const rtc = useWebRTC({
    roomId,
    name,
    active: stage === "meeting" && validRoom,
    localStream: media.stream,
    outgoingVideo,
    isScreen: sharing,
    quality,
    audioOn: media.audioOn,
    videoOn: media.videoOn,
  });

  // Tombol Back di HP menutup panel / dialog dulu, bukan langsung keluar meeting.
  useBackGuard(stage === "meeting" || (stage === "lobby" && panel !== null), () => {
    if (confirmLeave) setConfirmLeave(false);
    else if (panel) setPanel(null);
    else if (stage === "meeting") setConfirmLeave(true);
  });

  // Hitung pesan belum dibaca dari peserta lain saat panel chat tertutup.
  useEffect(() => {
    if (panel === "chat") setLastReadId(rtc.messages.at(-1)?.id ?? null);
  }, [panel, rtc.messages]);
  const unread = useMemo(() => {
    if (panel === "chat") return 0;
    const readIndex = lastReadId ? rtc.messages.findIndex((m) => m.id === lastReadId) : -1;
    return rtc.messages.slice(readIndex + 1).filter((m) => m.socketId !== rtc.myId).length;
  }, [panel, lastReadId, rtc.messages, rtc.myId]);

  const localVideoTrack = media.screenTrack ?? cameraOut;
  const localDisplayStream = useMemo(() => (localVideoTrack ? new MediaStream([localVideoTrack]) : null), [localVideoTrack]);

  const changeQuality = (mode: QualityMode) => {
    setQuality(mode);
    try {
      localStorage.setItem(QUALITY_KEY, mode);
    } catch {
      // abaikan
    }
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    setName(clean);
    try {
      localStorage.setItem(NAME_KEY, clean);
    } catch {
      // abaikan
    }
    setPanel(null);
    setStage("meeting");
  };

  const leave = useCallback(() => {
    media.stopAll();
    setPanel(null);
    setConfirmLeave(false);
    setStage("left");
  }, [media]);

  const togglePanel = (next: Panel) => setPanel((cur) => (cur === next ? null : next));

  const effectsPanel = (
    <EffectsPanel
      effects={fx.effects}
      onChange={fx.setEffects}
      onPickImage={fx.setBackgroundImage}
      loading={fx.loading}
      error={fx.error}
      supportsFilter={fx.supportsFilter}
      hasVideo={media.hasVideo}
      quality={quality}
      onQualityChange={changeQuality}
    />
  );

  if (!validRoom) {
    return (
      <CenteredMessage
        icon={<AlertTriangle className="h-6 w-6 text-danger" />}
        title="Kode meeting tidak valid"
        text="Periksa kembali link yang kamu terima, atau buat ruang baru."
      />
    );
  }

  if (stage === "left") {
    return (
      <CenteredMessage
        title="Kamu sudah keluar dari tongkrongan"
        text={`Kode ruang: ${roomId}`}
        actions={
          <>
            <button
              onClick={() => window.location.reload()}
              className="h-11 rounded-xl bg-accent px-5 font-semibold text-ink-950 hover:bg-accent-dark"
            >
              Gabung lagi
            </button>
            <Link href="/" className="grid h-11 place-items-center rounded-xl px-5 font-semibold text-white ring-1 ring-white/15 hover:bg-white/5">
              Ke beranda
            </Link>
          </>
        }
      />
    );
  }

  if (stage === "lobby") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-6">
        <header className="py-5">
          <Logo />
        </header>
        <main className="grid flex-1 items-center gap-8 pb-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <VideoTile
              stream={localDisplayStream}
              name={name || "Kamu"}
              audioOn={media.audioOn}
              videoOn={media.videoOn}
              isLocal
              className="aspect-video w-full"
            />
            <div className="mt-4 flex justify-center gap-3">
              <RoundButton
                label={media.audioOn ? "Matikan mikrofon" : "Nyalakan mikrofon"}
                onClick={media.toggleAudio}
                active={media.audioOn}
                disabled={!media.hasAudio}
              >
                {media.audioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </RoundButton>
              <RoundButton
                label={media.videoOn ? "Matikan kamera" : "Nyalakan kamera"}
                onClick={media.toggleVideo}
                active={media.videoOn}
                disabled={!media.hasVideo}
              >
                {media.videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </RoundButton>
              <RoundButton
                label="Efek & kualitas video"
                onClick={() => togglePanel("effects")}
                highlight={panel === "effects" || hasEffects(fx.effects)}
              >
                <Sparkles className="h-5 w-5" />
              </RoundButton>
            </div>
          </div>

          <form onSubmit={join} className="flex flex-col gap-4">
            <div>
              <p className="text-sm text-white/50">Kode ruang</p>
              <p className="font-mono text-lg tracking-wide text-accent">{roomId}</p>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Siap nongki?</h1>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-white/60">Nama kamu</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                autoFocus
                autoComplete="nickname"
                placeholder="Contoh: Rupi"
                className="h-12 rounded-xl bg-ink-800 px-4 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-2 focus:ring-accent"
              />
            </label>

            {media.error && (
              <div className="flex gap-2 rounded-xl bg-danger/10 p-3 text-sm text-red-200 ring-1 ring-danger/30">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                <span>{media.error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!name.trim() || media.loading}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-accent font-bold text-ink-950 transition hover:bg-accent-dark disabled:opacity-40"
            >
              {media.loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Menyiapkan kamera…
                </>
              ) : (
                "Gabung sekarang"
              )}
            </button>
          </form>
        </main>

        {panel === "effects" && (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink-950/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setPanel(null)}>
            <div
              className="flex max-h-[85dvh] w-full flex-col rounded-t-2xl bg-ink-900 ring-1 ring-white/10 sm:max-w-md sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <PanelHeader title={PANEL_TITLES.effects} onClose={() => setPanel(null)} />
              <div className="min-h-0 flex-1">{effectsPanel}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // stage === "meeting"
  if (rtc.status === "full") {
    return (
      <CenteredMessage
        icon={<Users className="h-6 w-6 text-accent" />}
        title="Ruangan sudah penuh"
        text={`Ruang ini sudah berisi ${rtc.maxParticipants} orang. Coba lagi nanti atau buat ruang baru.`}
        actions={
          <Link href="/" className="grid h-11 place-items-center rounded-xl bg-accent px-5 font-semibold text-ink-950">
            Ke beranda
          </Link>
        }
      />
    );
  }

  if (rtc.status === "error") {
    return (
      <CenteredMessage
        icon={<WifiOff className="h-6 w-6 text-danger" />}
        title="Tidak bisa terhubung ke server"
        text="Periksa koneksi internet kamu, lalu coba lagi."
        actions={
          <button onClick={() => window.location.reload()} className="h-11 rounded-xl bg-accent px-5 font-semibold text-ink-950">
            Coba lagi
          </button>
        }
      />
    );
  }

  const tileCount = 1 + rtc.participants.length;
  const presenter = rtc.participants.find((p) => p.screen && p.stream);
  const peopleRows = [
    { id: "me", name, audio: media.audioOn, video: media.videoOn || sharing, screen: sharing, isLocal: true },
    ...rtc.participants.map((p) => ({ id: p.socketId, name: p.name, audio: p.audio, video: p.video, screen: p.screen })),
  ];

  const localTile = (
    <VideoTile
      key="me"
      stream={localDisplayStream}
      name={name}
      audioOn={media.audioOn}
      videoOn={media.videoOn || sharing}
      isLocal
      isScreen={sharing}
      compact={!!presenter}
      className={presenter ? "h-full w-full" : ""}
    />
  );
  const remoteTile = (p: (typeof rtc.participants)[number], compact = false) => (
    <VideoTile
      key={p.socketId}
      stream={p.stream}
      name={p.name}
      audioOn={p.audio}
      videoOn={p.video}
      isScreen={p.screen}
      allowFullscreen={p.screen}
      compact={compact}
      connecting={p.connection === "new" || p.connection === "connecting"}
      className={compact || p === presenter ? "h-full w-full" : ""}
    />
  );

  return (
    <div className="flex h-dvh flex-col bg-ink-950">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <Logo />
        <div className="flex items-center gap-2 text-sm">
          {rtc.status !== "connected" && (
            <span className="flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs text-accent">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {rtc.status === "reconnecting" ? "Menyambung ulang…" : "Menghubungkan…"}
            </span>
          )}
          <span className="hidden font-mono text-white/55 sm:inline">{roomId}</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 px-2 sm:px-3">
        <main className="min-h-0 flex-1">
          {presenter ? (
            <SpotlightLayout
              spotlight={remoteTile(presenter)}
              others={[localTile, ...rtc.participants.filter((p) => p !== presenter).map((p) => remoteTile(p, true))]}
            />
          ) : (
            <VideoGrid count={tileCount}>
              {localTile}
              {rtc.participants.map((p) => remoteTile(p))}
            </VideoGrid>
          )}
        </main>

        {panel && (
          <aside className="fixed inset-0 z-30 flex flex-col bg-ink-900 md:static md:z-auto md:w-80 md:shrink-0 md:rounded-2xl md:ring-1 md:ring-white/5">
            <PanelHeader title={PANEL_TITLES[panel]} onClose={() => setPanel(null)} />
            <div className="min-h-0 flex-1">
              {panel === "chat" && <ChatPanel messages={rtc.messages} myId={rtc.myId} onSend={rtc.sendMessage} />}
              {panel === "people" && <ParticipantList rows={peopleRows} max={rtc.maxParticipants} />}
              {panel === "effects" && effectsPanel}
            </div>
          </aside>
        )}
      </div>

      <footer className="px-2 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-3 sm:py-4">
        <ControlBar
          audioOn={media.audioOn}
          videoOn={media.videoOn}
          hasAudio={media.hasAudio}
          hasVideo={media.hasVideo}
          sharing={sharing}
          canShareScreen={media.canShareScreen}
          effectsActive={hasEffects(fx.effects)}
          panel={panel}
          unread={unread}
          participantCount={tileCount}
          onToggleAudio={media.toggleAudio}
          onToggleVideo={media.toggleVideo}
          onToggleShare={sharing ? media.stopScreenShare : media.startScreenShare}
          onTogglePanel={togglePanel}
          onLeave={() => setConfirmLeave(true)}
        />
      </footer>

      {confirmLeave && (
        <ConfirmDialog
          title="Keluar dari tongkrongan?"
          text="Kamu bisa gabung lagi lewat link yang sama."
          confirmLabel="Keluar"
          onConfirm={leave}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </div>
  );
}

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
      <h2 className="font-bold">{title}</h2>
      <button
        onClick={onClose}
        aria-label="Tutup panel"
        className="grid h-9 w-9 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

function CenteredMessage({
  icon,
  title,
  text,
  actions,
}: {
  icon?: React.ReactNode;
  title: string;
  text: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        {icon && <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-white/5">{icon}</div>}
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 text-white/55">{text}</p>
        <div className="mt-6 flex justify-center gap-3">
          {actions ?? (
            <Link href="/" className="grid h-11 place-items-center rounded-xl bg-accent px-5 font-semibold text-ink-950">
              Ke beranda
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
