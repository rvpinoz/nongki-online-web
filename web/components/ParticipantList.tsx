"use client";

import { Mic, MicOff, MonitorUp, Video, VideoOff } from "lucide-react";
import { initials } from "@/lib/room";
import { MAX_PARTICIPANTS } from "@/lib/config";

type Row = {
  id: string;
  name: string;
  audio: boolean;
  video: boolean;
  screen?: boolean;
  isLocal?: boolean;
};

export function ParticipantList({ rows }: { rows: Row[] }) {
  return (
    <div className="h-full overflow-y-auto px-2 py-3">
      <p className="px-2 pb-2 text-xs text-white/45">
        {rows.length} dari maksimal {MAX_PARTICIPANTS} peserta
      </p>
      <ul className="space-y-1">
        {rows.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
              {initials(p.name)}
            </div>
            <span className="min-w-0 flex-1 truncate text-sm text-white">
              {p.name}
              {p.isLocal && <span className="text-white/45"> (Kamu)</span>}
            </span>
            <div className="flex items-center gap-2 text-white/60">
              {p.screen && <MonitorUp className="h-4 w-4 text-accent" aria-label="Berbagi layar" />}
              {p.video ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4 text-danger" />}
              {p.audio ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-danger" />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
