"use client";

import { useState, type ReactNode } from "react";
import { Check, Link2, MessageSquare, Mic, MicOff, MonitorUp, PhoneOff, Sparkles, Users, Video, VideoOff } from "lucide-react";
import type { Panel } from "@/lib/types";

type Props = {
  audioOn: boolean;
  videoOn: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  sharing: boolean;
  canShareScreen: boolean;
  effectsActive: boolean;
  panel: Panel | null;
  unread: number;
  participantCount: number;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleShare: () => void;
  onTogglePanel: (panel: Panel) => void;
  onLeave: () => void;
};

export function RoundButton({
  label,
  onClick,
  active = true,
  highlight = false,
  disabled = false,
  badge,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  highlight?: boolean;
  disabled?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const color = highlight
    ? "bg-accent text-ink-950 hover:bg-accent-dark"
    : active
      ? "bg-ink-700 hover:bg-ink-600 text-white"
      : "bg-danger hover:bg-danger-dark text-white";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={highlight || undefined}
      className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 sm:h-12 sm:w-12 ${color}`}
    >
      {children}
      {badge}
    </button>
  );
}

export function ControlBar(props: Props) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard diblokir (mis. bukan HTTPS): pakai share sheet bawaan HP kalau ada.
      navigator.share?.({ url: window.location.href }).catch(() => undefined);
    }
  };

  const iconCls = "h-5 w-5";

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-3">
      <RoundButton
        label={props.audioOn ? "Matikan mikrofon" : "Nyalakan mikrofon"}
        onClick={props.onToggleAudio}
        active={props.audioOn}
        disabled={!props.hasAudio}
      >
        {props.audioOn ? <Mic className={iconCls} /> : <MicOff className={iconCls} />}
      </RoundButton>

      <RoundButton
        label={props.videoOn ? "Matikan kamera" : "Nyalakan kamera"}
        onClick={props.onToggleVideo}
        active={props.videoOn}
        disabled={!props.hasVideo}
      >
        {props.videoOn ? <Video className={iconCls} /> : <VideoOff className={iconCls} />}
      </RoundButton>

      <RoundButton
        label="Efek & kualitas video"
        onClick={() => props.onTogglePanel("effects")}
        highlight={props.panel === "effects"}
        badge={
          props.effectsActive && props.panel !== "effects" ? (
            <span className="absolute right-0 top-0 h-3 w-3 rounded-full bg-accent ring-2 ring-ink-950" />
          ) : null
        }
      >
        <Sparkles className={iconCls} />
      </RoundButton>

      {props.canShareScreen && (
        <RoundButton
          label={props.sharing ? "Berhenti berbagi layar" : "Bagikan layar"}
          onClick={props.onToggleShare}
          highlight={props.sharing}
        >
          <MonitorUp className={iconCls} />
        </RoundButton>
      )}

      <RoundButton label={copied ? "Link tersalin" : "Salin link undangan"} onClick={copyLink} highlight={copied}>
        {copied ? <Check className={iconCls} /> : <Link2 className={iconCls} />}
      </RoundButton>

      <div className="mx-1 hidden h-8 w-px bg-white/10 sm:block" />

      <RoundButton
        label="Peserta"
        onClick={() => props.onTogglePanel("people")}
        highlight={props.panel === "people"}
        badge={
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-ink-950">
            {props.participantCount}
          </span>
        }
      >
        <Users className={iconCls} />
      </RoundButton>

      <RoundButton
        label="Chat"
        onClick={() => props.onTogglePanel("chat")}
        highlight={props.panel === "chat"}
        badge={
          props.unread > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {props.unread > 9 ? "9+" : props.unread}
            </span>
          ) : null
        }
      >
        <MessageSquare className={iconCls} />
      </RoundButton>

      <button
        type="button"
        onClick={props.onLeave}
        title="Keluar dari meeting"
        aria-label="Keluar dari meeting"
        className="flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-danger font-semibold text-white transition hover:bg-danger-dark sm:ml-1 sm:h-12 sm:w-auto sm:px-5"
      >
        <PhoneOff className={iconCls} />
        <span className="hidden sm:inline">Keluar</span>
      </button>
    </div>
  );
}
