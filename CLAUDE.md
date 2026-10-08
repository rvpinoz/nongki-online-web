# Nongki Online — Catatan Codebase

> Peta project untuk pengembangan lanjutan. Baca ini dulu sebelum menambah fitur, tidak perlu scan ulang semua file.
> Terakhir diperbarui: 2026-10-08.

**Nongki Online** adalah aplikasi nongkrong/video meeting berbasis web. Fiturnya:
- Video/audio P2P lewat WebRTC (mesh)
- Kualitas video dinamis
- Virtual background, filter warna, dan stiker wajah (MediaPipe, diproses lokal)
- Share screen dengan tampilan spotlight + fullscreen
- Chat, daftar peserta, dan salin link

Tidak ada login dan tidak ada database.

## 0. Prinsip & Preferensi Owner (WAJIB diikuti)

- **Utamakan performa dan security** di setiap fitur baru.
  - Validasi semua payload di server.
  - Jangan taruh secret di `NEXT_PUBLIC_*`.
  - Fitur berat di-lazy-load.
  - Jangan menambah request ke pihak ketiga tanpa alasan, dan update CSP kalau memang perlu.
- **Tema**: kuning (`accent`), hitam (`ink-*`), putih (teks), merah (`danger`, dipakai juga sebagai warna brand). Jangan pakai warna di luar palet ini.
- UI berbahasa Indonesia santai, sapaan "kamu", istilah "nongki/tongkrongan/ruang".
- Owner menguji dari HP, jadi selalu cek perilaku mobile: tombol Back, layout sempit, fitur yang tidak didukung (share screen).
- Staging di VPS dengan PM2. Butuh **Node ≥ 20.9**.
  - `web/ecosystem.config.js`: app `nongki-web`, cwd `/home/dev-staging/nongki-online-web/web`
  - `server/ecosystem.config.js`: app `nongki-server`, menjalankan `dist/index.js`. Env (`CLIENT_ORIGIN`, dll.) diisi di file ini. Wajib 1 instance karena state room ada di memori.

## 1. Struktur & Stack

```
meetlite/                      (nama folder lama; nama app = Nongki Online)
├── CLAUDE.md / README.md
├── docs-rencana.md            ← rencana awal V1 (read-only, masih menyebut "MeetLite")
├── server/                    ← Node + Express 4 + Socket.IO 4 (TypeScript, tsx), port 4000
│   ├── src/index.ts           ← SATU-SATUNYA file server
│   └── .env.example
└── web/                       ← Next.js 16 (App Router) + React 19 + Tailwind 4 + lucide-react 1.x + @mediapipe/tasks-vision
    ├── next.config.mjs        ← security headers + CSP (connect-src dari NEXT_PUBLIC_SIGNALING_URL saat build)
    ├── postcss.config.mjs     ← @tailwindcss/postcss
    ├── scripts/copy-mediapipe.mjs  ← salin wasm MediaPipe ke public/ (postinstall & prebuild)
    ├── public/mediapipe/
    │   ├── models/            ← selfie_segmenter.tflite, face_detector.tflite (±240 KB, di-commit)
    │   └── wasm/              ← hasil copy otomatis (gitignored, ±13 MB, hanya diunduh saat efek dipakai)
    ├── app/
    │   ├── globals.css        ← @theme Tailwind 4 = palet warna (TIDAK ada tailwind.config lagi)
    │   ├── layout.tsx         ← font Plus Jakarta Sans (var --font-jakarta), metadata, viewport
    │   ├── icon.svg           ← favicon
    │   ├── page.tsx           ← Beranda: buat ruang / gabung pakai kode atau link
    │   └── room/[id]/page.tsx ← state machine stage: lobby → meeting → left; spotlight; back guard; panel
    ├── components/
    │   ├── Logo.tsx           ← ikon Coffee kuning + "Nongki" putih "Online" merah
    │   ├── VideoGrid.tsx      ← VideoGrid (1–12 tile) + SpotlightLayout (share screen besar + strip)
    │   ├── VideoTile.tsx      ← memo; <video>, avatar, label, tombol fullscreen (allowFullscreen), compact
    │   ├── ControlBar.tsx     ← RoundButton (di-export, dipakai juga di lobby) + bar kontrol
    │   ├── EffectsPanel.tsx   ← kualitas video, background, filter warna, stiker
    │   ├── ConfirmDialog.tsx  ← dialog konfirmasi (keluar meeting)
    │   ├── ChatPanel.tsx, ParticipantList.tsx
    ├── hooks/
    │   ├── useLocalMedia.ts   ← getUserMedia (fallback audio/video saja), toggle, share screen, canShareScreen
    │   ├── useVideoEffects.ts ← nyalakan VideoEffectsProcessor hanya jika ada efek; outputTrack
    │   ├── useWebRTC.ts       ← socket + RTCPeerConnection per peserta, kualitas, chat, config server
    │   └── useBackGuard.ts    ← tahan tombol Back (history guard entry)
    └── lib/
        ├── config.ts          ← SIGNALING_URL, FALLBACK_ICE_SERVERS, DEFAULT_MAX_PARTICIPANTS, path MediaPipe
        ├── quality.ts         ← tier kualitas & applyEncoding (setParameters)
        ├── socket.ts, room.ts, types.ts (Panel, ServerConfig, ...)
        └── effects/
            ├── types.ts       ← VideoEffects, COLOR_FILTERS, FACE_STICKERS
            ├── backgrounds.ts ← preset background digambar procedural di canvas
            ├── stickers.ts    ← gambar stiker dari keypoint wajah
            └── processor.ts   ← VideoEffectsProcessor (MediaPipe + canvas → captureStream)
```

- Path alias `@/` = `web/`. Semua halaman `"use client"`. Tidak ada API route atau server action.
- `reactStrictMode: false` disengaja (efek WebRTC jangan dobel). Jangan diaktifkan.
- Tidak ada test runner atau ESLint. Verifikasi pakai `npx tsc --noEmit`, `npm run build`, dan E2E manual.
  - Pernah dites dengan puppeteer-core + Chrome lokal: flag `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream --auto-select-desktop-capture-source="Entire screen"`.
  - Teknik: monkeypatch `window.RTCPeerConnection` untuk inspeksi sender/encoding.
- `npm audit` di web dan server: 0 vulnerability (per 2026-10-08).

## 2. Menjalankan

```bash
cd server && npm install && npm run dev        # :4000, GET /health → {ok:true}
cd web && cp .env.example .env.local && npm install && npm run dev   # :3000
```

**Env web**: `NEXT_PUBLIC_SIGNALING_URL` saja. Nilainya masuk ke CSP saat build, jadi **rebuild kalau berubah**.

**Env server** (`server/.env.example`):
- `PORT`
- `CLIENT_ORIGIN`: wajib di production; dipakai untuk CORS dan juga cek origin WebSocket lewat `allowRequest`
- `MAX_PARTICIPANTS`: default 8, di-clamp 2–12
- `MAX_CONN_PER_IP`: default 20
- `TRUST_PROXY=1`: kalau di belakang proxy
- `TURN_URLS` + `TURN_SECRET`: kredensial TURN sementara gaya coturn REST, HMAC-SHA1, TTL 6 jam

## 3. Arsitektur & Alur

- **Mesh P2P**. Server hanya relay signaling dan chat. State in-memory `rooms: Map<roomId, Map<socketId, Participant>>`.
- **Aturan offer**: peserta baru meng-offer ke semua peserta lama (cegah glare). ICE diantrikan di `pendingIce` sampai remoteDescription ada.
- **ICE restart** otomatis oleh pihak initiator saat `connectionState === "failed"`.
- **Jalur video selalu dua arah** (`addTransceiver("video", sendrecv)` / ubah direction saat answer). Efeknya, peserta tanpa kamera tetap bisa share screen lewat `replaceTrack`.
- **Track video keluar** (`outgoingVideo` di page): `screenTrack ?? fx.outputTrack ?? cameraTrack`. Pergantian track memakai `replaceTrack`, tanpa renegosiasi.
- **Kualitas** (`lib/quality.ts`):
  - Tier kamera ditentukan jumlah peer: 1 → 720p/1.5 Mbps; 2 → 540p; 3–4 → 360p; 5–7 → 270p; 8+ → 180p.
  - Mode `hemat` memaksa tier terendah. Mode `hd` naik satu tier.
  - Screen: resolusi dijaga, 15 fps, bitrate turun sesuai jumlah peer.
  - Diterapkan lewat `applyQuality()` saat peer connected, jumlah peserta berubah, track berganti, atau mode berubah.
  - Mode disimpan di `localStorage["nongki:quality"]`.
- **Efek video** (`processor.ts`):
  - Alur: video tersembunyi → canvas (maks. lebar 854 px, 24 fps) → `canvas.captureStream`.
  - Ticker pakai Web Worker supaya tidak di-throttle saat tab di belakang.
  - Background: ImageSegmenter (confidence mask) → komposit `copy` (mask) → `source-in` (orang) → `destination-over` (background).
  - Blur pakai trik downscale lalu upscale (murah, jalan juga di Safari).
  - Filter warna pakai `ctx.filter`, disembunyikan kalau browser tidak mendukung (`supportsCanvasFilter`).
  - Stiker pakai FaceDetector (BlazeFace, keypoint 0..3 = mata kanan, mata kiri, hidung, mulut), deteksi tiap 2 frame + smoothing.
  - Model dan wasm di-lazy-load (dynamic import) dan di-cache global. Delegate GPU dulu, fallback ke CPU.
  - Processor di-pause saat kamera mati atau sedang share screen.
  - Foto background: hanya JPG/PNG/WebP ≤ 10 MB, pakai object URL, tidak diunggah.
- **Spotlight share screen**: kalau ada remote dengan `screen && stream`, `SpotlightLayout` menampilkan layar itu besar dan peserta lain di strip (bawah di HP, kanan di desktop).
  - Tile layar punya tombol fullscreen (Fullscreen API + lock landscape; di iOS pakai `webkitEnterFullscreen`).
  - Share screen milik sendiri tidak di-spotlight (menghindari efek cermin).
  - Setiap peserta dirender **tepat sekali**, supaya audio tidak dobel.
- **Tombol Back** (`useBackGuard`):
  - Aktif selama stage `meeting`, atau di lobby saat panel efek terbuka.
  - Urutan saat Back ditekan: dialog terbuka → ditutup; panel terbuka → ditutup; selain itu → muncul dialog "Keluar dari tongkrongan?".
  - Tombol Keluar juga selalu lewat konfirmasi.
- **Panel** (`Panel = "chat" | "people" | "effects"`): fullscreen overlay di mobile, sidebar `md:w-80` di desktop. Di lobby, panel efek tampil sebagai bottom sheet/modal.
- **Reconnect**: saat socket disconnect, semua peer ditutup. Saat connect lagi, `join-room` dikirim ulang. Chat lokal disimpan maks. 300 pesan (`MAX_CHAT_MESSAGES`).
- Unread chat dihitung berdasarkan `lastReadId`.
- Nama disimpan di `localStorage["nongki:name"]` (fallback baca `meetlite:name`).
- Share screen disembunyikan kalau `getDisplayMedia` tidak ada (umumnya di HP).

## 4. Kontrak Event Socket.IO (sumber kebenaran: `server/src/index.ts`)

| Event | Arah | Payload |
|---|---|---|
| `config` | S→C (saat connect) | `{ iceServers, maxParticipants }` |
| `join-room` | C→S | `{ roomId, name, audio, video }` |
| `existing-users` | S→C | `Participant[]` |
| `user-joined` | S→room lain | `Participant` |
| `join-error` | S→C | `{ message }` (room tidak valid / koneksi per IP berlebih) |
| `room-full` | S→C | `{ max }` |
| `offer` / `answer` | C→S→C | kirim `{ to, sdp:{type,sdp} }` → terima `{ from, sdp }` (hanya field tervalidasi yang diteruskan) |
| `ice-candidate` | C→S→C | kirim `{ to, candidate }` → terima `{ from, candidate }` |
| `media-state` | C→S→room lain | `{ audio, video, screen }` → `{ socketId, audio, video, screen }` |
| `chat-message` | C→S→semua di room | `{ text }` → `{ id, socketId, name, text, time }` |
| `leave-room` | C→S | – (juga otomatis saat disconnect) |
| `user-left` | S→room lain | `{ socketId }` |

**Keamanan server:**
- Rate limit token bucket per socket:
  - join: 5 sekaligus, isi ulang 0.2/detik
  - signal: 400 sekaligus, isi ulang 40/detik
  - media: 20 sekaligus, isi ulang 4/detik
  - chat: 8 sekaligus, isi ulang 1/detik
- `maxHttpBufferSize` 64 KB. SDP maks. 30 KB, candidate maks. 1 KB.
- Karakter kontrol dan bidi dibuang dari nama dan chat. Nama maks. 40 char, chat maks. 1000 char.
- Batas koneksi per IP. Relay hanya ke socket di room yang sama (dan bukan diri sendiri).
- Header keamanan aktif dan `x-powered-by` dimatikan. `/health` tidak membocorkan jumlah room.

**Event baru wajib**: validasi payload (anggap `unknown`), cek `currentRoom`, pasang rate limiter, dan hanya teruskan field yang dibutuhkan.

## 5. Konstanta yang Terduplikasi (ubah bersamaan!)

- **Regex room ID `/^[a-z0-9-]{3,40}$/`** ada di 3 tempat: server `ROOM_ID_PATTERN`, `web/lib/room.ts`, dan `web/app/room/[id]/page.tsx`.
- **Nama maks. 40 char**: server `cleanName` dan input lobby.
- **Chat maks. 1000 char**: server dan `ChatPanel`.
- **Tipe peserta**: server `Participant` dan web `ParticipantInfo`.
- **Maks. peserta**: sumber kebenaran di server (env). Web hanya punya `DEFAULT_MAX_PARTICIPANTS` untuk tampilan awal. Layout `VideoGrid` didesain sampai 12 tile.
- **Palet warna**: `globals.css` `@theme`.
  - Beberapa nilai hex ditulis langsung dan harus ikut diubah: `backgrounds.ts`, `stickers.ts`, `app/icon.svg`, `themeColor` di `layout.tsx`, dan `accent-[#ffcc00]` di EffectsPanel.

## 6. Desain / UI

- Tailwind 4, token di `@theme`:
  - `ink-950…600`: hitam bertingkat
  - `accent` (#ffcc00, kuning) dan `accent-dark`
  - `danger` (#e5383b, merah) dan `danger-dark`
  - `font-sans` memakai `--font-jakarta`
- Ciri visual: shadow "offset" merah (`shadow-[4px_4px_0_0_var(--color-danger)]`) di tombol utama dan logo, avatar inisial kuning dengan teks hitam, tombol primer `bg-accent text-ink-950 font-bold`.
- Nama class Tailwind 4: `bg-linear-to-*` (bukan `bg-gradient-to-*`), `outline-hidden`, dan seterusnya.
- Tombol kontrol: `h-10 w-10` di HP, `sm:h-12 sm:w-12`. Target: 8 tombol muat satu baris di lebar 390 px.

## 7. Resep Menambah Fitur

**Fitur real-time baru** (mis. raise hand, reaksi emoji):
1. Server: `socket.on(...)` di dalam `io.on("connection")`, ikuti aturan keamanan di §4. Kalau status perlu diketahui peserta yang join belakangan, simpan di `Participant`.
2. `web/lib/types.ts`: tambah field atau tipe.
3. `web/hooks/useWebRTC.ts`:
   - tambah `socket.on(...)` di efek utama (pakai `patchRemote`)
   - buat fungsi emit dengan `useCallback`, lalu return dari hook
   - nilai terbaru untuk handler socket taruh di ref `latest`
4. UI: `RoundButton` di `ControlBar.tsx`, indikator di `VideoTile` / `ParticipantList`, lalu sambungkan di `room/[id]/page.tsx`.

**Efek video baru**:
- Stiker: tambah ke `FaceSticker` + `FACE_STICKERS` (types.ts), lalu buat fungsi gambar di `stickers.ts` (ukuran relatif terhadap jarak mata `d`).
- Filter: tambah ke `COLOR_FILTERS` (string CSS filter).
- Background preset: tambah ke `BACKGROUND_PRESETS`.
- Model MediaPipe baru: taruh `.tflite` di `public/mediapipe/models/`, daftarkan di `MEDIAPIPE_MODELS`, lalu lazy-load seperti `loadSegmenter`.

**Ganti sumber video** (mis. pilih kamera depan/belakang): cukup ubah track di `useLocalMedia`. `outgoingVideo` dan efek `replaceTrack` sudah otomatis menyesuaikan.

**Panel baru**:
1. Tambah ke tipe `Panel` dan `PANEL_TITLES`.
2. Tambah tombol di ControlBar.
3. Tambah render di `<aside>` di page.

Back guard otomatis menutup panel baru juga.

**Overlay/dialog baru**: tambahkan kondisinya ke callback `useBackGuard` di page, supaya tombol Back di HP menutupnya.

**Butuh request ke domain lain** (CDN, API): tambahkan ke CSP di `next.config.mjs`. Lebih baik self-host.

**Butuh persistensi** (riwayat chat, akun): belum ada DB. Tambahkan di server.

## 8. Batasan & Rekomendasi Skala

- Mesh: tiap peserta meng-encode video **sekali per peer**. Akibatnya, CPU dan upload naik linear: 8 orang = 7 encode dan ±2–3,5 Mbps upload per orang meski tier sudah diturunkan.
  - Server signaling hampir tidak terbebani (hanya teks).
  - Untuk 10–50+ orang: pindah ke **SFU (LiveKit/mediasoup)**. Media lewat server, butuh bandwidth server besar, biaya naik, tapi beban klien tetap 1 upload.
- Tanpa TURN, sebagian jaringan ketat (kantor/seluler) gagal tersambung.
- Efek video memakan CPU/GPU. Di HP low-end bisa panas, jadi efek sengaja dibatasi 854 px / 24 fps.
- Belum ada host control, rekaman, login, atau riwayat chat. Room dan chat hilang saat server restart.
- CSP masih memakai `'unsafe-inline'` untuk script (dibutuhkan bootstrap Next tanpa nonce). Peningkatan berikutnya: nonce-based CSP lewat middleware.

## 9. Roadmap
SFU · login · host controls (waiting room, mute, kick) · raise hand & reaksi emoji · rekaman · jadwal + riwayat chat (DB) · TURN sendiri · nonce CSP.
