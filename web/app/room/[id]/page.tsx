"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, Loader2, Mic, MicOff, Users, Video, VideoOff, WifiOff, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { VideoTile } from "@/components/VideoTile";
import { VideoGrid } from "@/components/VideoGrid";
import { ControlBar } from "@/components/ControlBar";
import { ChatPanel } from "@/components/ChatPanel";
import { ParticipantList } from "@/components/ParticipantList";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import { useWebRTC } from "@/hooks/useWebRTC";
import { MAX_PARTICIPANTS } from "@/lib/config";

type Stage = "lobby" | "meeting" | "left";
const NAME_KEY = "meetlite:name";

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = (params?.id ?? "").toLowerCase();
  const validRoom = /^[a-z0-9-]{3,40}$/.test(roomId);

  const media = useLocalMedia();
  const [stage, setStage] = useState<Stage>("lobby");
  const [name, setName] = useState("");
  const [panel, setPanel] = useState<"chat" | "people" | null>(null);
  const [readCount, setReadCount] = useState(0);

  useEffect(() => {
    try {
      setName(localStorage.getItem(NAME_KEY) ?? "");
    } catch {
      // localStorage tidak tersedia (mode privat, dll.)
    }
  }, []);

  const rtc = useWebRTC({
    roomId,
    name,
    active: stage === "meeting" && validRoom,
    localStream: media.stream,
    screenTrack: media.screenTrack,
    audioOn: media.audioOn,
    videoOn: media.videoOn,
  });

  // Hitung pesan belum dibaca dari peserta lain saat panel chat tertutup.
  useEffect(() => {
    if (panel === "chat") setReadCount(rtc.messages.length);
  }, [panel, rtc.messages.length]);
  const unread = panel === "chat" ? 0 : rtc.messages.slice(readCount).filter((m) => m.socketId !== rtc.myId).length;

  const localDisplayStream = useMemo(
    () => (media.screenTrack ? new MediaStream([media.screenTrack]) : media.stream),
    [media.screenTrack, media.stream],
  );

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
    setStage("meeting");
  };

  const leave = () => {
    media.stopAll();
    setPanel(null);
    setStage("left");
  };

  const togglePanel = (next: "chat" | "people") => setPanel((cur) => (cur === next ? null : next));

  if (!validRoom) {
    return (
      <CenteredMessage
        icon={<AlertTriangle className="h-6 w-6 text-danger" />}
        title="Kode meeting tidak valid"
        text="Periksa kembali link yang kamu terima, atau buat meeting baru."
      />
    );
  }

  if (stage === "left") {
    return (
      <CenteredMessage
        title="Kamu sudah keluar dari meeting"
        text={`Kode meeting: ${roomId}`}
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
              stream={media.stream}
              name={name || "Kamu"}
              audioOn={media.audioOn}
              videoOn={media.videoOn}
              isLocal
              className="aspect-video w-full"
            />
            <div className="mt-4 flex justify-center gap-3">
              <button
                type="button"
                onClick={media.toggleAudio}
                disabled={!media.hasAudio}
                aria-label={media.audioOn ? "Matikan mikrofon" : "Nyalakan mikrofon"}
                className={`grid h-12 w-12 place-items-center rounded-full transition disabled:opacity-40 ${
                  media.audioOn ? "bg-ink-700 hover:bg-ink-600" : "bg-danger hover:bg-danger-dark"
                }`}
              >
                {media.audioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={media.toggleVideo}
                disabled={!media.hasVideo}
                aria-label={media.videoOn ? "Matikan kamera" : "Nyalakan kamera"}
                className={`grid h-12 w-12 place-items-center rounded-full transition disabled:opacity-40 ${
                  media.videoOn ? "bg-ink-700 hover:bg-ink-600" : "bg-danger hover:bg-danger-dark"
                }`}
              >
                {media.videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <form onSubmit={join} className="flex flex-col gap-4">
            <div>
              <p className="text-sm text-white/50">Kode meeting</p>
              <p className="font-mono text-lg tracking-wide text-white">{roomId}</p>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Siap bergabung?</h1>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-white/60">Nama kamu</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                autoFocus
                placeholder="Contoh: Rupi"
                className="h-12 rounded-xl bg-ink-800 px-4 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-accent"
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
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-ink-950 transition hover:bg-accent-dark disabled:opacity-40"
            >
              {media.loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Menyiapkan kamera…
                </>
              ) : (
                "Gabung sekarang"
              )}
            </button>
            <p className="text-xs text-white/40">Maksimal {MAX_PARTICIPANTS} peserta per ruang.</p>
          </form>
        </main>
      </div>
    );
  }

  // stage === "meeting"
  if (rtc.status === "full") {
    return (
      <CenteredMessage
        icon={<Users className="h-6 w-6 text-accent" />}
        title="Ruang meeting sudah penuh"
        text={`Ruang ini sudah berisi ${MAX_PARTICIPANTS} peserta. Coba lagi nanti atau buat meeting baru.`}
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
        text="Pastikan signaling server sudah berjalan dan NEXT_PUBLIC_SIGNALING_URL sudah benar."
        actions={
          <button
            onClick={() => window.location.reload()}
            className="h-11 rounded-xl bg-accent px-5 font-semibold text-ink-950"
          >
            Coba lagi
          </button>
        }
      />
    );
  }

  const tileCount = 1 + rtc.participants.length;
  const peopleRows = [
    {
      id: "me",
      name,
      audio: media.audioOn,
      video: media.videoOn || !!media.screenTrack,
      screen: !!media.screenTrack,
      isLocal: true,
    },
    ...rtc.participants.map((p) => ({ id: p.socketId, name: p.name, audio: p.audio, video: p.video, screen: p.screen })),
  ];

  return (
    <div className="flex h-dvh flex-col bg-ink-950">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <Logo />
        <div className="flex items-center gap-2 text-sm">
          {rtc.status !== "connected" && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {rtc.status === "reconnecting" ? "Menyambung ulang…" : "Menghubungkan…"}
            </span>
          )}
          <span className="hidden font-mono text-white/55 sm:inline">{roomId}</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 px-3">
        <main className="min-h-0 flex-1">
          <VideoGrid count={tileCount}>
            <VideoTile
              stream={localDisplayStream}
              name={name}
              audioOn={media.audioOn}
              videoOn={media.videoOn || !!media.screenTrack}
              isLocal
              isScreen={!!media.screenTrack}
            />
            {rtc.participants.map((p) => (
              <VideoTile
                key={p.socketId}
                stream={p.stream}
                name={p.name}
                audioOn={p.audio}
                videoOn={p.video}
                isScreen={p.screen}
                connecting={p.connection === "new" || p.connection === "connecting"}
              />
            ))}
          </VideoGrid>
        </main>

        {panel && (
          <aside className="fixed inset-0 z-30 flex flex-col bg-ink-900 md:static md:z-auto md:w-80 md:shrink-0 md:rounded-2xl md:ring-1 md:ring-white/5">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <h2 className="font-semibold">{panel === "chat" ? "Chat" : "Peserta"}</h2>
              <button
                onClick={() => setPanel(null)}
                aria-label="Tutup panel"
                className="grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              {panel === "chat" ? (
                <ChatPanel messages={rtc.messages} myId={rtc.myId} onSend={rtc.sendMessage} />
              ) : (
                <ParticipantList rows={peopleRows} />
              )}
            </div>
          </aside>
        )}
      </div>

      <footer className="px-3 py-3 sm:py-4">
        <ControlBar
          audioOn={media.audioOn}
          videoOn={media.videoOn}
          hasAudio={media.hasAudio}
          hasVideo={media.hasVideo}
          sharing={!!media.screenTrack}
          panel={panel}
          unread={unread}
          participantCount={tileCount}
          onToggleAudio={media.toggleAudio}
          onToggleVideo={media.toggleVideo}
          onToggleShare={media.screenTrack ? media.stopScreenShare : media.startScreenShare}
          onTogglePanel={togglePanel}
          onLeave={leave}
        />
      </footer>
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
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
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
