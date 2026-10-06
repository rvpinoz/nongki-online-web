"use client";

import { useState, type ReactNode } from "react";
import { Check, Link2, MessageSquare, Mic, MicOff, MonitorUp, PhoneOff, Users, Video, VideoOff } from "lucide-react";

type Props = {
  audioOn: boolean;
  videoOn: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  sharing: boolean;
  panel: "chat" | "people" | null;
  unread: number;
  participantCount: number;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleShare: () => void;
  onTogglePanel: (panel: "chat" | "people") => void;
  onLeave: () => void;
};

function RoundButton({
  label,
  onClick,
  active = true,
  danger = false,
  highlight = false,
  disabled = false,
  badge,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  highlight?: boolean;
  disabled?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const color = danger
    ? "bg-danger hover:bg-danger-dark text-white"
    : highlight
      ? "bg-accent text-ink-950 hover:bg-accent-dark"
      : active
        ? "bg-ink-700 hover:bg-ink-600 text-white"
        : "bg-danger/90 hover:bg-danger text-white";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`relative grid h-11 w-11 place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 sm:h-12 sm:w-12 ${color}`}
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
      prompt("Salin link ini:", window.location.href);
    }
  };

  const iconCls = "h-5 w-5";

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
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
        label={props.sharing ? "Berhenti berbagi layar" : "Bagikan layar"}
        onClick={props.onToggleShare}
        highlight={props.sharing}
      >
        <MonitorUp className={iconCls} />
      </RoundButton>

      <RoundButton label={copied ? "Link tersalin" : "Salin link undangan"} onClick={copyLink} highlight={copied}>
        {copied ? <Check className={iconCls} /> : <Link2 className={iconCls} />}
      </RoundButton>

      <div className="mx-1 hidden h-8 w-px bg-white/10 sm:block" />

      <RoundButton
        label="Peserta"
        onClick={() => props.onTogglePanel("people")}
        highlight={props.panel === "people"}
        badge={
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-ink-950 px-1 text-[10px] font-semibold text-white ring-1 ring-white/15">
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
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
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
        className="ml-1 flex h-11 items-center gap-2 rounded-full bg-danger px-4 font-medium text-white transition hover:bg-danger-dark sm:h-12 sm:px-5"
      >
        <PhoneOff className={iconCls} />
        <span className="hidden sm:inline">Keluar</span>
      </button>
    </div>
  );
}
