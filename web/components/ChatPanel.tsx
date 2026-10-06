"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { SendHorizontal } from "lucide-react";
import type { ChatMessage } from "@/lib/types";

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function ChatPanel({
  messages,
  myId,
  onSend,
}: {
  messages: ChatMessage[];
  myId: string | null;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText("");
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-sm text-white/40">
            Belum ada pesan. Pesan hanya terlihat oleh peserta yang sedang di ruang ini.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.socketId === myId;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div className="mb-0.5 flex items-baseline gap-2 text-[11px] text-white/45">
                <span className="font-medium text-white/70">{mine ? "Kamu" : m.name}</span>
                <span>{formatTime(m.time)}</span>
              </div>
              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                  mine ? "rounded-br-md bg-accent text-ink-950" : "rounded-bl-md bg-ink-700 text-white"
                }`}
              >
                {m.text}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-white/5 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder="Kirim pesan…"
          className="min-w-0 flex-1 rounded-full bg-ink-800 px-4 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Kirim"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-ink-950 transition hover:bg-accent-dark disabled:opacity-40"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
