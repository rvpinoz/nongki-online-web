# MeetLite

Aplikasi video meeting sederhana berbasis web (versi mini Google Meet / Zoom).

- Video & audio peer-to-peer lewat **WebRTC** (topologi mesh, maks. 6 peserta)
- Lobby dengan preview kamera, isi nama, atur mic/kamera sebelum masuk
- Mute/unmute, kamera on/off, **share screen**, salin link undangan
- **Chat** real-time dan daftar peserta
- Tanpa login, tanpa database

```
meetlite/
├── server/   → signaling server (Node + Express + Socket.IO), port 4000
└── web/      → frontend (Next.js 14 + Tailwind), port 3000
```

## Menjalankan di lokal

Butuh Node.js 18 atau lebih baru.

```bash
# Terminal 1 — signaling server
cd server
npm install
npm run dev          # http://localhost:4000  (cek: /health)

# Terminal 2 — frontend
cd web
cp .env.example .env.local
npm install
npm run dev          # http://localhost:3000
```

**Uji coba:** buka `http://localhost:3000`, klik **Buat meeting baru**, isi nama, lalu klik **Gabung sekarang**. Salin link-nya dan buka di tab/browser lain (pakai jendela incognito atau browser berbeda supaya terasa seperti peserta lain).

> Kamera/mikrofon hanya bisa diakses di `localhost` atau lewat **HTTPS**. Kalau mau uji dari HP di jaringan yang sama, pakai tunnel HTTPS seperti `ngrok` atau `cloudflared` untuk port 3000 dan 4000, lalu isi `NEXT_PUBLIC_SIGNALING_URL` dengan URL tunnel server.

## Konfigurasi

**web/.env.local**

| Variabel | Default | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SIGNALING_URL` | `http://localhost:4000` | Alamat signaling server |
| `NEXT_PUBLIC_TURN_URL` | – | Opsional, TURN server (mis. `turn:turn.domain.com:3478`) |
| `NEXT_PUBLIC_TURN_USERNAME` / `NEXT_PUBLIC_TURN_CREDENTIAL` | – | Kredensial TURN |

**server (environment variable)**

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `4000` | Port server |
| `CLIENT_ORIGIN` | `*` | Origin frontend yang diizinkan, pisahkan dengan koma |

## Cara kerjanya

1. Peserta membuka `/room/<kode>` dan bergabung → socket kirim `join-room`.
2. Server membalas `existing-users` (daftar peserta lama) dan mengabari yang lain lewat `user-joined`.
3. **Peserta baru membuat offer** ke setiap peserta lama; yang lama membalas answer. ICE candidate ditukar lewat server.
4. Setelah tersambung, video/audio mengalir langsung antar-browser. Server hanya meneruskan pesan signaling dan chat.
5. Share screen mengganti track video dengan `RTCRtpSender.replaceTrack()`, jadi tidak perlu negosiasi ulang.

File penting:

- `server/src/index.ts` — logika room, relay signaling, chat
- `web/hooks/useLocalMedia.ts` — kamera, mikrofon, share screen
- `web/hooks/useWebRTC.ts` — koneksi socket + satu `RTCPeerConnection` per peserta
- `web/app/room/[id]/page.tsx` — lobby, ruang meeting, dan layar keluar/penuh/error

## Deploy

- **Frontend** → Vercel (set `NEXT_PUBLIC_SIGNALING_URL` ke URL server).
- **Server** → Railway, Render, Fly.io, atau VPS (butuh koneksi WebSocket jangka panjang; Vercel serverless tidak cocok). Jalankan `npm run build && npm start`, set `CLIENT_ORIGIN` ke domain frontend.
- Untuk pengguna di jaringan kantor/seluler yang ketat, tambahkan TURN server (coturn atau layanan TURN berbayar), kalau tidak sebagian koneksi bisa gagal.

## Batasan versi ini

- Mesh: tiap peserta mengirim video ke semua peserta lain, jadi di atas 4–6 orang akan berat. Untuk lebih banyak peserta, pindah ke SFU (LiveKit / mediasoup).
- Peserta yang masuk **tanpa kamera** bisa melihat dan mendengar orang lain, tapi share screen-nya tidak terkirim (tidak ada jalur video untuk diganti).
- Data room dan chat disimpan di memori server dan hilang saat server restart.
- Belum ada host control (mute/kick peserta), rekaman, atau login.
