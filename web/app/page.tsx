"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Keyboard, Link2, MessageSquare, MonitorUp, Plus, Sparkles, Users } from "lucide-react";
import { Logo } from "@/components/Logo";
import { generateRoomId, parseRoomInput } from "@/lib/room";

const FEATURES = [
  { icon: Users, title: "Rame-rame bareng", text: "Video & audio langsung antar-browser, tanpa install aplikasi." },
  { icon: Sparkles, title: "Background & filter", text: "Blur, background virtual, filter warna, dan stiker wajah." },
  { icon: MonitorUp, title: "Bagikan layar", text: "Nobar slide, foto, atau apa pun di layar penuh." },
  { icon: MessageSquare, title: "Chat di ruang", text: "Kirim link atau catatan singkat selama nongkrong." },
  { icon: Link2, title: "Cukup satu link", text: "Tanpa akun. Bagikan link, langsung masuk." },
];

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMeeting = () => router.push(`/room/${generateRoomId()}`);

  const joinMeeting = (e: FormEvent) => {
    e.preventDefault();
    const roomId = parseRoomInput(code);
    if (!roomId) {
      setError("Kode atau link tidak valid. Contoh kode: abc-defg-hij");
      return;
    }
    router.push(`/room/${roomId}`);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-6">
      <header className="py-5">
        <Logo />
      </header>

      <main className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[1.1fr_1fr]">
        <section>
          <p className="mb-4 inline-block -rotate-2 rounded-lg bg-danger px-3 py-1 text-sm font-bold text-white">Gratis · tanpa daftar</p>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Nongkrong online,
            <br />
            <span className="text-accent">tanpa ribet.</span>
          </h1>
          <p className="mt-4 max-w-md text-base text-white/60 sm:text-lg">
            Buat ruang, bagikan link, dan ngobrol tatap muka langsung dari browser.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-start">
            <button
              onClick={createMeeting}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 font-bold text-ink-950 shadow-[4px_4px_0_0_var(--color-danger)] transition hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_var(--color-danger)]"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
              Buat ruang baru
            </button>

            <form onSubmit={joinMeeting} className="flex flex-1 flex-col gap-1.5 sm:max-w-sm">
              <div className="flex h-12 items-center gap-2 rounded-xl bg-ink-800 pl-3 pr-1 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-accent">
                <Keyboard className="h-5 w-5 shrink-0 text-white/40" />
                <input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setError(null);
                  }}
                  placeholder="Masukkan kode atau link"
                  aria-label="Kode atau link ruang"
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                />
                <button
                  type="submit"
                  disabled={!code.trim()}
                  className="h-10 rounded-lg px-4 text-sm font-bold text-accent transition hover:bg-white/5 disabled:text-white/25"
                >
                  Gabung
                </button>
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
            </form>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, text }, i) => (
            <div
              key={title}
              className={`rounded-2xl bg-ink-900 p-5 ring-1 ring-white/5 ${i === 0 ? "sm:col-span-2" : ""}`}
            >
              <span className={`grid h-9 w-9 place-items-center rounded-lg ${i % 2 ? "bg-danger text-white" : "bg-accent text-ink-950"}`}>
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-3 font-bold">{title}</h2>
              <p className="mt-1 text-sm text-white/55">{text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="py-6 text-xs text-white/35">
        Video dikirim langsung antar-peserta (peer-to-peer). Server hanya mempertemukan peserta.
      </footer>
    </div>
  );
}
