import { io, type Socket } from "socket.io-client";
import { SIGNALING_URL } from "./config";

/** Membuat koneksi Socket.IO baru ke signaling server (satu per sesi meeting). */
export function createSocket(): Socket {
  return io(SIGNALING_URL, {
    transports: ["websocket", "polling"],
    reconnectionDelayMax: 5000,
  });
}
