# Nongki Online — Catatan Codebase

> Peta project untuk pengembangan lanjutan. Baca ini dulu sebelum menambah fitur, tidak perlu scan ulang semua file.
> Terakhir di-scan: 2026-10-08 (commit `b43ce73 first commit`).

**Nongki Online** adalah aplikasi video meeting/nongkrong berbasis web (mirip versi mini Google Meet). Fiturnya: video/audio P2P lewat WebRTC (mesh, maks. 6 orang), lobby dengan preview kamera, mute/kamera, share screen, chat, daftar peserta, dan salin link. Tidak ada login dan tidak ada database.

> ⚠️ **Branding di kode masih "MeetLite"**, belum diganti ke "Nongki Online". Lokasinya:
> - `web/components/Logo.tsx`: teks logo `MeetLite`
> - `web/app/layout.tsx`: `metadata.title` dan `description`
> - `web/app/room/[id]/page.tsx`: key localStorage `NAME_KEY = "meetlite:name"` (kalau diganti, nama tersimpan user hilang sekali)
> - `server/src/index.ts`: log `MeetLite signaling server ...` dan komentar contoh origin
> - `server/package.json` (`meetlite-server`), `web/package.json` (`meetlite-web`), root `package-lock.json` (`meetlite`)
> - `README.md`, `docs-rencana.md` (file read-only, `r--r--r--`)
> - Nama folder root: `meetlite/`

---

## 1. Struktur & Stack

```
meetlite/
├── CLAUDE.md            ← file ini
├── README.md            ← cara run, config, deploy, batasan
├── docs-rencana.md      ← dokumen rencana awal V1 + roadmap (read-only)
├── server/              ← signaling server: Node + Express 4 + Socket.IO 4 (TypeScript, tsx), port 4000
│   └── src/index.ts     ← SATU-SATUNYA file server (room, relay signaling, chat)
└── web/                 ← frontend: Next.js 14 App Router + React 18 + Tailwind 3 + lucide-react, port 3000
    ├── app/
    │   ├── layout.tsx           ← font Plus Jakarta Sans (--font-sans), metadata, lang="id"
    │   ├── globals.css          ← dark theme dasar (#0d0f12)
    │   ├── page.tsx             ← Beranda: buat meeting / gabung dengan kode atau link
    │   └── room/[id]/page.tsx   ← Lobby → Meeting → Keluar + layar error/penuh (state machine `stage`)
    ├── components/
    │   ├── Logo.tsx             ← logo + link ke "/"
    │   ├── VideoGrid.tsx        ← CSS grid sesuai jumlah tile (1 / 2 / 2×2 / 3×2)
    │   ├── VideoTile.tsx        ← <video> + avatar inisial + label nama + ikon mic/screen + overlay "Menyambungkan…"
    │   ├── ControlBar.tsx       ← tombol mic, kamera, share, salin link, peserta, chat, keluar (komponen RoundButton)
    │   ├── ChatPanel.tsx        ← list pesan + input (max 1000 char)
    │   └── ParticipantList.tsx  ← daftar peserta + status mic/kamera/screen
    ├── hooks/
    │   ├── useLocalMedia.ts     ← getUserMedia (dengan fallback), toggle mic/cam, share screen, stopAll
    │   └── useWebRTC.ts         ← socket + RTCPeerConnection per peserta, chat, media-state
    └── lib/
        ├── config.ts            ← SIGNALING_URL, ICE_SERVERS (STUN Google + TURN opsional), MAX_PARTICIPANTS
        ├── socket.ts            ← createSocket() (transport websocket→polling)
        ├── room.ts              ← generateRoomId() "abc-defg-hij", parseRoomInput(), initials()
        └── types.ts             ← ParticipantInfo, RemoteParticipant, ChatMessage, ConnectionStatus
```

- Path alias `@/` = root folder `web/`.
- Semua halaman dan komponen interaktif memakai `"use client"`. Tidak ada API route atau server action di Next.
- `next.config.mjs` sengaja memakai `reactStrictMode: false` supaya efek WebRTC tidak jalan dua kali di dev. **Jangan diaktifkan** kecuali efeknya sudah dibuat idempotent.
- Belum ada test, belum ada config ESLint/Prettier. UI teks berbahasa Indonesia dengan sapaan "kamu".

## 2. Menjalankan

```bash
cd server && npm install && npm run dev     # http://localhost:4000  (cek: GET /health → {ok, rooms})
cd web && cp .env.example .env.local && npm install && npm run dev   # http://localhost:3000
```
Build: `server`: `npm run build && npm start` (output `dist/`). `web`: `npm run build && npm start`.

**Env web** (`NEXT_PUBLIC_*`, dibaca di `lib/config.ts`): `SIGNALING_URL` (default `http://localhost:4000`), `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`.
**Env server**: `PORT` (4000) dan `CLIENT_ORIGIN` (default `*`, beberapa origin dipisah koma; dipakai untuk CORS Express dan Socket.IO).

Kamera/mic hanya bisa diakses di `localhost` atau HTTPS. Untuk test dari HP, pakai tunnel (ngrok/cloudflared) untuk port 3000 dan 4000.

## 3. Arsitektur & Alur

- **Mesh P2P**: media langsung antar-browser. Server hanya relay signaling dan chat.
- **State server** (in-memory, hilang saat restart): `rooms: Map<roomId, Map<socketId, Participant>>`, dengan `Participant = { socketId, name, audio, video, screen }`. Room dihapus saat kosong.
- Validasi server: `ROOM_ID_PATTERN = /^[a-z0-9-]{3,40}$/`, nama di-trim maks. 40 char (default "Tamu"), chat maks. 1000 char, relay signaling hanya ke socket di room yang sama (`inSameRoom`).
- **Aturan offer**: peserta **baru** membuat offer ke setiap peserta lama (dari `existing-users`). Peserta lama hanya menjawab. Ini mencegah glare.
- ICE candidate yang datang sebelum `remoteDescription` diantrikan di `pendingIce` lalu di-flush.
- **Share screen**: `replaceTrack()` pada sender video, tanpa renegosiasi (efek di `useWebRTC.ts`). Kalau user join tanpa kamera, tidak ada sender video, jadi share screen tidak terkirim (batasan yang sudah diketahui).
- **Mute/kamera off**: `track.enabled = false` lalu broadcast `media-state`. Track tidak dihentikan.
- **Reconnect**: saat socket `disconnect`, semua peer ditutup dan status menjadi `reconnecting`. Saat `connect` lagi, `join-room` dikirim ulang dan koneksi peer dibangun ulang. Riwayat chat lokal tetap ada.
- Peserta yang baru masuk **tidak** melihat chat sebelumnya karena server tidak menyimpan riwayat.

### Alur halaman `room/[id]/page.tsx`
`stage`: `"lobby"` → (submit nama) → `"meeting"` → (Keluar) → `"left"`.
- `useLocalMedia()` jalan sejak lobby (preview kamera).
- `useWebRTC({ active: stage === "meeting" && validRoom, ... })`: socket baru dibuat saat `active` menjadi true dan ditutup di cleanup.
- Saat meeting, `rtc.status === "full"` atau `"error"` menampilkan `CenteredMessage`.
- `panel: "chat" | "people" | null` untuk panel samping (fullscreen di mobile, `md:w-80` di desktop).
- Unread chat dihitung dari `readCount` dan hanya menghitung pesan orang lain.
- Nama disimpan di `localStorage["meetlite:name"]`.
- Tombol "Gabung lagi" memanggil `window.location.reload()`.

## 4. Kontrak Event Socket.IO (sumber kebenaran: `server/src/index.ts`)

| Event | Arah | Payload |
|---|---|---|
| `join-room` | C→S | `{ roomId, name, audio, video }` |
| `existing-users` | S→C (yang join) | `Participant[]` (peserta lama) |
| `user-joined` | S→room lain | `Participant` |
| `join-error` | S→C | `{ message }` (roomId tidak valid) |
| `room-full` | S→C | `{ max }` → client set status `full` lalu disconnect |
| `offer` / `answer` | C→S→C | kirim `{ to, sdp }` → terima `{ from, sdp }` |
| `ice-candidate` | C→S→C | kirim `{ to, candidate }` → terima `{ from, candidate }` |
| `media-state` | C→S→room lain | kirim `{ audio, video, screen }` → terima `{ socketId, audio, video, screen }` |
| `chat-message` | C→S→**semua** di room (termasuk pengirim) | kirim `{ text }` → terima `{ id, socketId, name, text, time }` |
| `leave-room` | C→S | – (juga otomatis saat `disconnect`) |
| `user-left` | S→room lain | `{ socketId }` |

Catatan: `video` di `media-state` dan `join-room` bernilai true juga saat sedang share screen (`videoOn || !!screenTrack`).

## 5. Konstanta yang Terduplikasi (ubah bersamaan!)

- **Maks. peserta 6**: `server/src/index.ts` (`MAX_PARTICIPANTS`) **dan** `web/lib/config.ts` (`MAX_PARTICIPANTS`). Layout `VideoGrid` juga hanya didesain sampai 6 tile.
- **Regex room ID `/^[a-z0-9-]{3,40}$/`**: `server/src/index.ts`, `web/lib/room.ts` (`parseRoomInput`), `web/app/room/[id]/page.tsx` (`validRoom`).
- **Batas nama 40 char**: server `cleanName` dan input lobby `maxLength={40}`.
- **Batas chat 1000 char**: server dan `ChatPanel` `maxLength={1000}`.
- **Tipe peserta**: server `Participant` dan web `ParticipantInfo` di `lib/types.ts` (tidak ada shared package).

## 6. Desain / UI

- Tailwind custom colors (`web/tailwind.config.ts`):
  - `ink-950/900/800/700/600`: latar gelap bertingkat
  - `accent` (#2dd4a7, hijau mint) dan `accent-dark`
  - `danger` (#ef4444) dan `danger-dark`
- Pola umum: `rounded-xl`/`rounded-2xl`, `ring-1 ring-white/5|10`, teks sekunder `text-white/40–60`, tombol primer `bg-accent text-ink-950`.
- Ikon: `lucide-react`. Unit tinggi layar: `min-h-dvh` / `h-dvh`.

## 7. Resep Menambah Fitur

**Fitur real-time baru** (mis. raise hand, reaksi emoji):
1. Server (`server/src/index.ts`): tambah `socket.on("nama-event", ...)` di dalam `io.on("connection")`. Wajib cek `currentRoom`, validasi payload (anggap `unknown`), lalu `socket.to(currentRoom).emit(...)` atau `io.to(currentRoom).emit(...)`. Kalau statusnya perlu diketahui peserta yang join belakangan, simpan di `Participant` supaya ikut terkirim di `existing-users`/`user-joined`.
2. Tipe (`web/lib/types.ts`): tambah field di `ParticipantInfo` atau buat tipe baru.
3. Hook (`web/hooks/useWebRTC.ts`): tambah `socket.on(...)` di efek utama (pakai `patchRemote`/`setState`), buat fungsi `useCallback` untuk emit, lalu return dari hook. Untuk nilai terbaru yang dibaca handler socket, pakai ref `latest`.
4. UI: tombol di `ControlBar.tsx` (pakai `RoundButton`), indikator di `VideoTile.tsx` atau `ParticipantList.tsx`, lalu sambungkan props di `room/[id]/page.tsx`.

**Kontrol media lokal baru** (mis. ganti device, blur): tambahkan di `useLocalMedia.ts`. Kalau track video berganti, efek `replaceTrack` di `useWebRTC.ts` sudah menangani perubahan `localStream`/`screenTrack`.

**Panel samping baru**: perluas tipe `panel` (`"chat" | "people"`) di `page.tsx` **dan** `ControlBar.tsx`.

**Halaman baru**: buat folder di `web/app/`, pakai `Logo` dan layout `mx-auto max-w-6xl px-4 sm:px-6` seperti beranda.

**Butuh persistensi** (riwayat chat, akun, jadwal): saat ini belum ada DB. Perlu menambah DB di server (atau API route Next).

## 8. Batasan & Hal yang Perlu Diwaspadai

- Mesh terasa berat di atas 4–6 orang. Untuk skala lebih besar perlu SFU (LiveKit/mediasoup).
- Tanpa TURN, sebagian jaringan ketat (kantor/seluler) bisa gagal terhubung.
- Belum ada host control, rekaman, login, atau riwayat chat.
- `startScreenShare` memakai `alert()` dan `copyLink` fallback memakai `prompt()`.
- Peserta tanpa kamera tidak bisa mengirim share screen (tidak ada sender video untuk `replaceTrack`).
- Deploy: web ke Vercel, server ke Railway/Render/Fly/VPS (butuh WebSocket persisten; Vercel serverless tidak cocok).

## 9. Roadmap (dari `docs-rencana.md`)
SFU · login (NextAuth) · host controls (waiting room, mute, kick) · raise hand & reaksi emoji · background blur · rekaman · jadwal + riwayat chat (DB) · TURN sendiri.
