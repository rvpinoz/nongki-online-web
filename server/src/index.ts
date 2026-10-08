import express from "express";
import http from "http";
import { createHmac, randomUUID } from "crypto";
import { Server, Socket } from "socket.io";

const PORT = Number(process.env.PORT ?? 4000);
const IS_PROD = process.env.NODE_ENV === "production";
// Pisahkan beberapa origin dengan koma, contoh: "https://nongki.online,http://localhost:3000"
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean) ?? "*";
// Mesh: tiap peserta mengirim video ke semua peserta lain, jadi dibatasi keras di 12.
const MAX_PARTICIPANTS = Math.min(Math.max(Number(process.env.MAX_PARTICIPANTS ?? 8) || 8, 2), 12);
const MAX_CONN_PER_IP = Number(process.env.MAX_CONN_PER_IP ?? 20);
// Set "1" kalau server di belakang reverse proxy (nginx, Cloudflare) supaya IP asli terbaca.
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
// TURN dengan kredensial sementara (coturn: use-auth-secret + static-auth-secret).
const TURN_URLS = process.env.TURN_URLS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
const TURN_SECRET = process.env.TURN_SECRET ?? "";
const TURN_TTL_SECONDS = 6 * 60 * 60;

const ROOM_ID_PATTERN = /^[a-z0-9-]{3,40}$/;
const MAX_SDP_LENGTH = 30_000;
const MAX_CANDIDATE_LENGTH = 1_000;

if (IS_PROD && CLIENT_ORIGIN === "*") {
  console.warn("[security] CLIENT_ORIGIN belum di-set. Semua origin diizinkan — set ke domain frontend di production.");
}

type Participant = {
  socketId: string;
  name: string;
  audio: boolean;
  video: boolean;
  screen: boolean;
};

// roomId -> (socketId -> peserta). Disimpan di memori, hilang saat server restart.
const rooms = new Map<string, Map<string, Participant>>();
const connectionsPerIp = new Map<string, number>();

function isOriginAllowed(origin: string | undefined): boolean {
  if (CLIENT_ORIGIN === "*") return true;
  return !!origin && CLIENT_ORIGIN.includes(origin);
}

const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (CLIENT_ORIGIN === "*") res.setHeader("Access-Control-Allow-Origin", "*");
  else if (origin && isOriginAllowed(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN },
  // SDP terbesar ±10 KB; tolak payload besar supaya memori server aman.
  maxHttpBufferSize: 64 * 1024,
  pingInterval: 20_000,
  pingTimeout: 20_000,
  // CORS tidak berlaku untuk WebSocket, jadi origin dicek manual di sini.
  allowRequest: (req, callback) => callback(null, isOriginAllowed(req.headers.origin)),
});

function clientIp(socket: Socket): string {
  if (TRUST_PROXY) {
    const forwarded = socket.handshake.headers["x-forwarded-for"];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
    if (first) return first;
  }
  return socket.handshake.address;
}

// Buang karakter kontrol (kecuali baris baru bila diizinkan) dan zero-width char.
function cleanText(value: unknown, maxLength: number, allowNewline = false): string {
  if (typeof value !== "string") return "";
  const pattern = allowNewline ? /[\u0000-\u0009\u000B-\u001F\u007F​-\u200F\u202A-\u202E\u2066-\u2069]/g : /[\u0000-\u001F\u007F​-\u200F\u202A-\u202E\u2066-\u2069]/g;
  return value.replace(pattern, "").trim().slice(0, maxLength);
}

function cleanName(value: unknown): string {
  return cleanText(value, 40) || "Tamu";
}

function cleanSdp(value: unknown): { type: "offer" | "answer"; sdp: string } | null {
  if (!value || typeof value !== "object") return null;
  const { type, sdp } = value as { type?: unknown; sdp?: unknown };
  if ((type !== "offer" && type !== "answer") || typeof sdp !== "string" || sdp.length > MAX_SDP_LENGTH) return null;
  return { type, sdp };
}

function cleanCandidate(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const { candidate, sdpMid, sdpMLineIndex, usernameFragment } = value as Record<string, unknown>;
  if (typeof candidate !== "string" || candidate.length > MAX_CANDIDATE_LENGTH) return null;
  return {
    candidate,
    sdpMid: typeof sdpMid === "string" ? sdpMid.slice(0, 32) : null,
    sdpMLineIndex: typeof sdpMLineIndex === "number" ? sdpMLineIndex : null,
    usernameFragment: typeof usernameFragment === "string" ? usernameFragment.slice(0, 64) : null,
  };
}

function iceServers(): RTCIceServerConfig[] {
  const list: RTCIceServerConfig[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  if (TURN_URLS.length > 0 && TURN_SECRET) {
    const username = `${Math.floor(Date.now() / 1000) + TURN_TTL_SECONDS}:${randomUUID().slice(0, 8)}`;
    const credential = createHmac("sha1", TURN_SECRET).update(username).digest("base64");
    list.push({ urls: TURN_URLS, username, credential });
  }
  return list;
}

type RTCIceServerConfig = { urls: string[]; username?: string; credential?: string };

/** Token bucket sederhana: `capacity` aksi sekaligus, terisi `perSecond` per detik. */
function rateLimiter(capacity: number, perSecond: number) {
  let tokens = capacity;
  let last = Date.now();
  return () => {
    const now = Date.now();
    tokens = Math.min(capacity, tokens + ((now - last) / 1000) * perSecond);
    last = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}

io.on("connection", (socket: Socket) => {
  const ip = clientIp(socket);
  const ipCount = (connectionsPerIp.get(ip) ?? 0) + 1;
  if (ipCount > MAX_CONN_PER_IP) {
    socket.emit("join-error", { message: "Terlalu banyak koneksi dari jaringan ini." });
    socket.disconnect(true);
    return;
  }
  connectionsPerIp.set(ip, ipCount);

  let currentRoom: string | null = null;
  const limits = {
    join: rateLimiter(5, 0.2),
    // ICE candidate bisa datang beruntun saat banyak peserta bergabung.
    signal: rateLimiter(400, 40),
    media: rateLimiter(20, 4),
    chat: rateLimiter(8, 1),
  };

  socket.emit("config", { iceServers: iceServers(), maxParticipants: MAX_PARTICIPANTS });

  const inSameRoom = (otherId: unknown): otherId is string =>
    typeof otherId === "string" &&
    otherId !== socket.id &&
    currentRoom !== null &&
    rooms.get(currentRoom)?.has(otherId) === true;

  socket.on("join-room", (payload: { roomId?: unknown; name?: unknown; audio?: unknown; video?: unknown }) => {
    if (currentRoom || !limits.join()) return; // sudah bergabung / spam
    const roomId = typeof payload?.roomId === "string" ? payload.roomId.toLowerCase() : "";
    if (!ROOM_ID_PATTERN.test(roomId)) {
      socket.emit("join-error", { message: "Kode meeting tidak valid." });
      return;
    }

    const room = rooms.get(roomId) ?? new Map<string, Participant>();
    if (room.size >= MAX_PARTICIPANTS) {
      socket.emit("room-full", { max: MAX_PARTICIPANTS });
      return;
    }

    const me: Participant = {
      socketId: socket.id,
      name: cleanName(payload?.name),
      audio: payload?.audio === true,
      video: payload?.video === true,
      screen: false,
    };

    const existing = [...room.values()];
    room.set(socket.id, me);
    rooms.set(roomId, room);
    currentRoom = roomId;
    socket.join(roomId);

    // Peserta baru menerima daftar peserta lama, lalu dia yang membuat offer ke mereka.
    socket.emit("existing-users", existing);
    socket.to(roomId).emit("user-joined", me);
    if (!IS_PROD) console.log(`[join] ${me.name} -> ${roomId} (${room.size} peserta)`);
  });

  // Relay signaling WebRTC: hanya field yang valid yang diteruskan, dan hanya ke peserta di room yang sama.
  socket.on("offer", (payload: { to?: unknown; sdp?: unknown }) => {
    const sdp = cleanSdp(payload?.sdp);
    if (!limits.signal() || !sdp || sdp.type !== "offer" || !inSameRoom(payload?.to)) return;
    io.to(payload.to).emit("offer", { from: socket.id, sdp });
  });

  socket.on("answer", (payload: { to?: unknown; sdp?: unknown }) => {
    const sdp = cleanSdp(payload?.sdp);
    if (!limits.signal() || !sdp || sdp.type !== "answer" || !inSameRoom(payload?.to)) return;
    io.to(payload.to).emit("answer", { from: socket.id, sdp });
  });

  socket.on("ice-candidate", (payload: { to?: unknown; candidate?: unknown }) => {
    const candidate = cleanCandidate(payload?.candidate);
    if (!limits.signal() || !candidate || !inSameRoom(payload?.to)) return;
    io.to(payload.to).emit("ice-candidate", { from: socket.id, candidate });
  });

  socket.on("media-state", (payload: { audio?: unknown; video?: unknown; screen?: unknown }) => {
    if (!currentRoom || !limits.media()) return;
    const me = rooms.get(currentRoom)?.get(socket.id);
    if (!me) return;
    me.audio = payload?.audio === true;
    me.video = payload?.video === true;
    me.screen = payload?.screen === true;
    socket.to(currentRoom).emit("media-state", {
      socketId: socket.id,
      audio: me.audio,
      video: me.video,
      screen: me.screen,
    });
  });

  socket.on("chat-message", (payload: { text?: unknown }) => {
    if (!currentRoom || !limits.chat()) return;
    const me = rooms.get(currentRoom)?.get(socket.id);
    const text = cleanText(payload?.text, 1000, true);
    if (!me || !text) return;
    io.to(currentRoom).emit("chat-message", {
      id: randomUUID(),
      socketId: socket.id,
      name: me.name,
      text,
      time: Date.now(),
    });
  });

  const leave = () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    const me = room?.get(socket.id);
    room?.delete(socket.id);
    if (room && room.size === 0) rooms.delete(currentRoom);
    socket.to(currentRoom).emit("user-left", { socketId: socket.id });
    socket.leave(currentRoom);
    if (!IS_PROD) console.log(`[leave] ${me?.name ?? socket.id} <- ${currentRoom}`);
    currentRoom = null;
  };

  socket.on("leave-room", leave);
  socket.on("disconnect", () => {
    leave();
    const left = (connectionsPerIp.get(ip) ?? 1) - 1;
    if (left <= 0) connectionsPerIp.delete(ip);
    else connectionsPerIp.set(ip, left);
  });
});

server.listen(PORT, () => {
  console.log(`Nongki Online signaling server jalan di http://localhost:${PORT} (maks. ${MAX_PARTICIPANTS} peserta/room)`);
});
