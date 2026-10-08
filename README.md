# Nongki Online

Aplikasi nongkrong/video meeting berbasis web.

- Video & audio peer-to-peer lewat **WebRTC** (topologi mesh, default maks. 8 peserta, bisa diatur sampai 12)
- **Kualitas video dinamis**: resolusi/bitrate turun otomatis makin ramai room, plus mode *Hemat data* / *Kualitas tinggi*
- Lobby dengan preview kamera, isi nama, atur mic/kamera/efek sebelum masuk
- **Virtual background** (blur, preset, foto sendiri), **filter warna**, **stiker wajah** — diproses lokal dengan MediaPipe
- Mute/unmute, kamera on/off, **share screen** (tampil besar + tombol layar penuh), salin link undangan
- **Chat** real-time dan daftar peserta
- Tanpa login, tanpa database

```
meetlite/
├── server/   → signaling server (Node + Express + Socket.IO), port 4000
└── web/      → frontend (Next.js 16 + React 19 + Tailwind 4), port 3000
```

## Menjalankan di lokal

Butuh Node.js **20.9** atau lebih baru.

```bash
# Terminal 1 — signaling server
cd server
npm install
npm run dev          # http://localhost:4000  (cek: /health)

# Terminal 2 — frontend
cd web
cp .env.example .env.local
npm install          # otomatis menyalin wasm MediaPipe ke public/mediapipe/wasm
npm run dev          # http://localhost:3000
```

**Uji coba:** buka `http://localhost:3000`, klik **Buat ruang baru**, isi nama, lalu **Gabung sekarang**. Buka link-nya di jendela incognito / browser lain.

> Kamera/mikrofon hanya bisa diakses di `localhost` atau lewat **HTTPS**. Untuk uji dari HP, pakai tunnel HTTPS (`ngrok`/`cloudflared`) untuk port 3000 dan 4000, lalu isi `NEXT_PUBLIC_SIGNALING_URL` dengan URL tunnel server **sebelum build** (nilainya juga masuk ke CSP).

## Konfigurasi

**web/.env.local**

| Variabel | Default | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SIGNALING_URL` | `http://localhost:4000` | Alamat signaling server. Dipakai juga di header CSP `connect-src`, jadi rebuild kalau berubah. |

**server (environment variable)** — contoh di `server/.env.example`

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `4000` | Port server |
| `CLIENT_ORIGIN` | `*` | Origin frontend yang diizinkan (koma). **Wajib di production** — juga dipakai untuk menolak koneksi WebSocket dari situs lain. |
| `MAX_PARTICIPANTS` | `8` | Maks. peserta per room (2–12) |
| `MAX_CONN_PER_IP` | `20` | Maks. koneksi socket bersamaan per IP |
| `TRUST_PROXY` | `0` | `1` kalau di belakang nginx/Cloudflare |
| `TURN_URLS` / `TURN_SECRET` | – | TURN coturn (`use-auth-secret`). Server membuat kredensial sementara (6 jam) per koneksi. |

## Cara kerjanya

1. Peserta membuka `/room/<kode>` → socket tersambung → server mengirim `config` (ICE server + batas peserta).
2. Peserta kirim `join-room`; server membalas `existing-users` dan mengabari yang lain lewat `user-joined`.
3. **Peserta baru membuat offer** ke setiap peserta lama; ICE candidate ditukar lewat server.
4. Video/audio mengalir langsung antar-browser. Server hanya meneruskan signaling dan chat.
5. Share screen / efek video mengganti track dengan `RTCRtpSender.replaceTrack()` tanpa negosiasi ulang.
6. Kualitas diatur per koneksi lewat `RTCRtpSender.setParameters()` (bitrate, skala resolusi, fps).

Detail lengkap untuk developer ada di [CLAUDE.md](CLAUDE.md).

## Deploy

- Node.js ≥ 20.9 di server.
- **Frontend**: `npm run build && npm start` (PM2 / Vercel). Set `NEXT_PUBLIC_SIGNALING_URL` saat build.
- **Server**: Railway, Render, Fly.io, atau VPS (butuh WebSocket persisten). `npm run build && npm start`, set `CLIENT_ORIGIN`.
- Wajib HTTPS untuk frontend dan server (`wss://`).
- Untuk jaringan kantor/seluler yang ketat, pasang TURN (coturn), kalau tidak sebagian koneksi bisa gagal.

## Batasan versi ini

- Mesh: tiap peserta meng-encode & mengirim video ke semua peserta lain. Di atas ±8 orang berat di HP; untuk 10–50+ orang pindah ke SFU (LiveKit / mediasoup).
- Data room dan chat disimpan di memori server dan hilang saat server restart.
- Belum ada host control (mute/kick), rekaman, atau login.
