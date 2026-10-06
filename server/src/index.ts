import express from "express";
import http from "http";
import { randomUUID } from "crypto";
import { Server, Socket } from "socket.io";

const PORT = Number(process.env.PORT ?? 4000);
// Pisahkan beberapa origin dengan koma, contoh: "https://meetlite.vercel.app,http://localhost:3000"
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN?.split(",").map((s) => s.trim()) ?? "*";
const MAX_PARTICIPANTS = 6;
const ROOM_ID_PATTERN = /^[a-z0-9-]{3,40}$/;

type Participant = {
  socketId: string;
  name: string;
  audio: boolean;
  video: boolean;
  screen: boolean;
};

// roomId -> (socketId -> peserta). Disimpan di memori, hilang saat server restart.
const rooms = new Map<string, Map<string, Participant>>();

const app = express();
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (CLIENT_ORIGIN === "*") res.setHeader("Access-Control-Allow-Origin", "*");
  else if (origin && CLIENT_ORIGIN.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  next();
});
app.get("/health", (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_ORIGIN } });

function cleanName(value: unknown): string {
  const name = typeof value === "string" ? value.trim().slice(0, 40) : "";
  return name || "Tamu";
}

io.on("connection", (socket: Socket) => {
  let currentRoom: string | null = null;

  const inSameRoom = (otherId: unknown): otherId is string =>
    typeof otherId === "string" &&
    currentRoom !== null &&
    rooms.get(currentRoom)?.has(otherId) === true;

  socket.on("join-room", (payload: { roomId?: unknown; name?: unknown; audio?: unknown; video?: unknown }) => {
    if (currentRoom) return; // sudah bergabung
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
      audio: payload?.audio !== false,
      video: payload?.video !== false,
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
    console.log(`[join] ${me.name} -> ${roomId} (${room.size} peserta)`);
  });

  // Relay signaling WebRTC: hanya diteruskan ke peserta di room yang sama.
  for (const event of ["offer", "answer", "ice-candidate"] as const) {
    socket.on(event, (payload: { to?: unknown; [key: string]: unknown }) => {
      if (!inSameRoom(payload?.to)) return;
      io.to(payload.to).emit(event, { ...payload, from: socket.id });
    });
  }

  socket.on("media-state", (payload: { audio?: unknown; video?: unknown; screen?: unknown }) => {
    if (!currentRoom) return;
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
    if (!currentRoom) return;
    const me = rooms.get(currentRoom)?.get(socket.id);
    const text = typeof payload?.text === "string" ? payload.text.trim().slice(0, 1000) : "";
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
    console.log(`[leave] ${me?.name ?? socket.id} <- ${currentRoom}`);
    currentRoom = null;
  };

  socket.on("leave-room", leave);
  socket.on("disconnect", leave);
});

server.listen(PORT, () => {
  console.log(`MeetLite signaling server jalan di http://localhost:${PORT}`);
});
