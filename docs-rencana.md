# MeetLite — Aplikasi Video Meeting Sederhana (Web)

Dokumen rencana untuk membuat versi simple dari Google Meet / Zoom yang berjalan di browser.

---

## 1. Tujuan

Membuat aplikasi web di mana pengguna bisa:
- Membuat ruang meeting dan mendapat link untuk dibagikan
- Bergabung ke ruang lewat link/kode
- Melakukan video & audio call dengan beberapa orang (2–6 peserta)
- Mengobrol lewat chat teks di dalam ruang

Fokus: **jalan dulu, sederhana, mudah dipahami**. Fitur lanjutan ditaruh di roadmap.

---

## 2. Fitur MVP (Versi 1)

| # | Fitur | Keterangan |
|---|-------|------------|
| 1 | Halaman beranda | Tombol "Buat Meeting Baru" dan input "Gabung dengan kode" |
| 2 | Pre-join (lobby) | Preview kamera, isi nama, pilih nyala/mati mic & kamera sebelum masuk |
| 3 | Ruang meeting | Grid video semua peserta, nama di tiap tile |
| 4 | Kontrol | Mute/unmute mic, on/off kamera, share screen, keluar |
| 5 | Chat | Chat teks real-time di panel samping |
| 6 | Daftar peserta | Siapa saja yang ada di ruang |
| 7 | Salin link | Tombol untuk menyalin link undangan |

**Tidak termasuk di V1:** login/akun, rekaman, waiting room/host control, background blur, jadwal meeting.

---

## 3. Tech Stack

| Bagian | Pilihan | Alasan |
|--------|---------|--------|
| Frontend | **Next.js (App Router) + TypeScript + Tailwind CSS** | Cepat dibuat, routing mudah (`/room/[id]`) |
| Video/Audio | **WebRTC** (bawaan browser) | Gratis, peer-to-peer, tanpa layanan pihak ketiga |
| Signaling server | **Node.js + Express + Socket.IO** | Untuk "mempertemukan" peserta (tukar offer/answer/ICE) dan chat |
| STUN | `stun:stun.l.google.com:19302` | Gratis, cukup untuk sebagian besar jaringan |
| TURN (opsional) | coturn / layanan TURN berbayar | Dibutuhkan kalau peserta di balik NAT/firewall ketat |
| Penyimpanan | **In-memory** (Map di server) | V1 tidak perlu database |

---

## 4. Arsitektur

Pakai topologi **Mesh**: setiap peserta terhubung langsung ke semua peserta lain.

```
        ┌──────────────────────────┐
        │  Signaling Server        │
        │  (Node + Socket.IO)      │
        │  - daftar room & peserta │
        │  - relay offer/answer/ICE│
        │  - relay chat            │
        └─────▲─────────▲──────────┘
              │ websocket│
      ┌───────┴──┐   ┌───┴──────┐
      │ Browser A│◄─►│ Browser B│   ← media (video/audio) langsung P2P via WebRTC
      └────▲─────┘   └────▲─────┘
           └──────►◄──────┘
              Browser C
```

- **Server hanya untuk signaling & chat**, video tidak lewat server → server ringan.
- **Kekurangan mesh:** tiap peserta mengirim video ke N-1 orang. Nyaman sampai ±4–6 peserta. Lebih dari itu perlu SFU (lihat roadmap).

---

## 5. Alur Kerja

### 5.1 Membuat & bergabung ke meeting
1. User klik "Buat Meeting Baru" → frontend membuat ID acak (contoh: `abc-defg-hij`) → diarahkan ke `/room/abc-defg-hij`.
2. Halaman lobby: minta izin kamera/mic (`getUserMedia`), user isi nama.
3. Klik "Gabung" → socket kirim `join-room { roomId, name }`.

### 5.2 Koneksi WebRTC (signaling)
```
Peserta baru (B)            Server                 Peserta lama (A)
      │── join-room ───────►│                            │
      │◄── existing-users ──│ (daftar: [A])              │
      │                     │── user-joined (B) ────────►│
      │── offer (ke A) ────►│── offer ──────────────────►│
      │                     │◄── answer ─────────────────│
      │◄── answer ──────────│                            │
      │◄═══ ICE candidates saling ditukar lewat server ═══►│
      │◄════════════ video/audio P2P tersambung ═════════►│
```
Aturan sederhana: **peserta yang baru masuk yang membuat offer** ke setiap peserta lama (menghindari tabrakan offer).

### 5.3 Keluar
- Socket `disconnect` → server kirim `user-left` ke peserta lain → mereka menutup `RTCPeerConnection` dan menghapus tile video.

---

## 6. Event Socket.IO

| Event | Arah | Payload |
|-------|------|---------|
| `join-room` | client → server | `{ roomId, name }` |
| `existing-users` | server → client | `[{ socketId, name }]` |
| `user-joined` | server → room | `{ socketId, name }` |
| `offer` | client ↔ server ↔ client | `{ to, from, sdp }` |
| `answer` | client ↔ server ↔ client | `{ to, from, sdp }` |
| `ice-candidate` | client ↔ server ↔ client | `{ to, from, candidate }` |
| `media-state` | client → room | `{ socketId, audio, video }` (untuk ikon mute) |
| `chat-message` | client → room | `{ name, text, time }` |
| `user-left` | server → room | `{ socketId }` |

---

## 7. Struktur Folder

```
meetlite/
├── server/
│   ├── package.json
│   └── index.ts            # Express + Socket.IO, logika room
└── web/
    ├── package.json
    ├── app/
    │   ├── page.tsx         # Beranda: buat / gabung meeting
    │   └── room/[id]/
    │       └── page.tsx     # Lobby + ruang meeting
    ├── components/
    │   ├── VideoGrid.tsx
    │   ├── VideoTile.tsx
    │   ├── ControlBar.tsx   # mic, kamera, share screen, keluar
    │   ├── ChatPanel.tsx
    │   └── ParticipantList.tsx
    ├── hooks/
    │   ├── useLocalMedia.ts # getUserMedia, toggle mic/cam, screen share
    │   └── useWebRTC.ts     # kelola peer connections + signaling
    └── lib/
        └── socket.ts        # instance Socket.IO client
```

---

## 8. Detail Teknis Penting

- **HTTPS wajib** untuk akses kamera/mic (kecuali di `localhost`). Saat deploy, pastikan pakai HTTPS.
- **Share screen:** `navigator.mediaDevices.getDisplayMedia()` lalu ganti track video di setiap koneksi dengan `RTCRtpSender.replaceTrack()` — tidak perlu negosiasi ulang.
- **Mute/kamera off:** cukup `track.enabled = false`, lalu broadcast `media-state` agar peserta lain menampilkan ikon.
- **Video sendiri** di-`muted` supaya tidak terjadi echo.
- **Grid layout:** CSS grid yang menyesuaikan jumlah peserta (1 = penuh, 2 = berdampingan, 3–4 = 2×2, 5–6 = 3×2).
- **Batas peserta:** server menolak join jika room sudah berisi 6 orang (event `room-full`).

---

## 9. Tahapan Pengerjaan

| Tahap | Pekerjaan | Hasil |
|-------|-----------|-------|
| 1 | Setup project `server` & `web` | Keduanya jalan di lokal |
| 2 | Signaling server (room, join/leave, relay) | Event socket berfungsi |
| 3 | Beranda + lobby + preview kamera | Bisa buat & buka link room |
| 4 | WebRTC 1-on-1 | 2 tab browser bisa video call |
| 5 | Mesh multi-peserta + grid | 3–6 peserta |
| 6 | Kontrol mic/kamera/keluar + indikator | Kontrol berfungsi |
| 7 | Share screen | Layar bisa dibagikan |
| 8 | Chat + daftar peserta | Panel samping berfungsi |
| 9 | Rapikan UI, handle error (izin ditolak, room penuh) | Siap demo |
| 10 | Deploy | Bisa dipakai dari internet |

---

## 10. Cara Menjalankan (rencana)

```bash
# terminal 1
cd server && npm install && npm run dev   # http://localhost:4000

# terminal 2
cd web && npm install && npm run dev      # http://localhost:3000
```
Uji: buka `localhost:3000` di dua tab/browser, buat meeting di satu tab, gabung lewat link di tab lain.

**Deploy:** frontend ke Vercel; signaling server ke layanan yang mendukung WebSocket jangka panjang (Railway, Render, Fly.io, atau VPS). Vercel serverless tidak cocok untuk Socket.IO.

---

## 11. Roadmap (setelah V1)

- **SFU** (LiveKit / mediasoup) agar bisa 10–50+ peserta
- Login & akun (NextAuth)
- Host controls: waiting room, mute peserta, kick
- Raise hand & reaksi emoji
- Background blur
- Rekaman meeting
- Jadwal meeting + simpan riwayat chat (database)
- TURN server sendiri untuk koneksi yang lebih andal

---

## 12. Keputusan yang Perlu Dikonfirmasi

1. Stack Next.js + Node/Socket.IO oke? (Alternatif: backend signaling pakai **Go**)
2. Batas 6 peserta (mesh) cukup untuk V1?
3. Perlu login di V1, atau cukup isi nama saja?
4. Bahasa UI: Indonesia atau Inggris?
