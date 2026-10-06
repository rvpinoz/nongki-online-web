"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { ICE_SERVERS } from "@/lib/config";
import { createSocket } from "@/lib/socket";
import type { ChatMessage, ConnectionStatus, ParticipantInfo, RemoteParticipant } from "@/lib/types";

type PeerEntry = {
  pc: RTCPeerConnection;
  remoteTracks: MediaStreamTrack[];
  pendingIce: RTCIceCandidateInit[];
};

type Options = {
  roomId: string;
  name: string;
  active: boolean; // true setelah user klik "Gabung"
  localStream: MediaStream | null;
  screenTrack: MediaStreamTrack | null;
  audioOn: boolean;
  videoOn: boolean;
};

/**
 * Inti video call: koneksi ke signaling server + satu RTCPeerConnection per peserta (mesh).
 * Peserta yang baru masuk selalu membuat offer ke peserta lama.
 */
export function useWebRTC({ roomId, name, active, localStream, screenTrack, audioOn, videoOn }: Options) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [myId, setMyId] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());

  // Nilai terbaru disimpan di ref supaya handler socket tidak memakai nilai basi.
  const latest = useRef({ name, localStream, screenTrack, audioOn, videoOn });
  latest.current = { name, localStream, screenTrack, audioOn, videoOn };

  useEffect(() => {
    if (!active) return;

    const socket = createSocket();
    socketRef.current = socket;
    const peers = peersRef.current;

    const patchRemote = (id: string, patch: Partial<RemoteParticipant>) =>
      setParticipants((prev) => prev.map((p) => (p.socketId === id ? { ...p, ...patch } : p)));

    const addRemote = (info: ParticipantInfo) =>
      setParticipants((prev) =>
        prev.some((p) => p.socketId === info.socketId)
          ? prev
          : [...prev, { ...info, stream: null, connection: "new" }],
      );

    const closePeer = (id: string) => {
      peers.get(id)?.pc.close();
      peers.delete(id);
    };

    const closeAll = () => {
      peers.forEach((entry) => entry.pc.close());
      peers.clear();
      setParticipants([]);
    };

    const createPeer = (remoteId: string, initiator: boolean): PeerEntry => {
      const existing = peers.get(remoteId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const entry: PeerEntry = { pc, remoteTracks: [], pendingIce: [] };
      peers.set(remoteId, entry);

      const { localStream: local, screenTrack: screen } = latest.current;
      const msid = local ?? new MediaStream();
      const audioTrack = local?.getAudioTracks()[0];
      const videoTrack = screen ?? local?.getVideoTracks()[0];

      // Kalau kita tidak punya kamera/mic, tetap minta terima media dari lawan.
      if (audioTrack) pc.addTrack(audioTrack, msid);
      else if (initiator) pc.addTransceiver("audio", { direction: "recvonly" });
      if (videoTrack) pc.addTrack(videoTrack, msid);
      else if (initiator) pc.addTransceiver("video", { direction: "recvonly" });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", { to: remoteId, candidate: event.candidate.toJSON() });
        }
      };

      pc.ontrack = (event) => {
        if (!entry.remoteTracks.includes(event.track)) entry.remoteTracks.push(event.track);
        patchRemote(remoteId, { stream: new MediaStream(entry.remoteTracks) });
      };

      pc.onconnectionstatechange = () => {
        patchRemote(remoteId, { connection: pc.connectionState });
      };

      return entry;
    };

    const flushIce = async (entry: PeerEntry) => {
      const queued = entry.pendingIce.splice(0);
      for (const candidate of queued) {
        try {
          await entry.pc.addIceCandidate(candidate);
        } catch (err) {
          console.warn("Gagal menambah ICE candidate", err);
        }
      }
    };

    socket.on("connect", () => {
      setMyId(socket.id ?? null);
      const { name: myName, audioOn: a, videoOn: v, screenTrack: s } = latest.current;
      socket.emit("join-room", { roomId, name: myName, audio: a, video: v || !!s });
    });

    socket.on("disconnect", () => {
      // Server sudah menganggap kita keluar; koneksi lama tidak bisa dipakai lagi.
      closeAll();
      setStatus((prev) => (prev === "full" || prev === "error" ? prev : "reconnecting"));
    });

    socket.on("connect_error", () => {
      setStatus((prev) => (prev === "connecting" ? "error" : "reconnecting"));
    });

    socket.on("existing-users", async (users: ParticipantInfo[]) => {
      // Status "connected" juga memicu efek di bawah yang mengirim media-state terbaru.
      setStatus("connected");

      for (const user of users) {
        addRemote(user);
        const { pc } = createPeer(user.socketId, true);
        try {
          await pc.setLocalDescription(await pc.createOffer());
          socket.emit("offer", { to: user.socketId, sdp: pc.localDescription });
        } catch (err) {
          console.error("Gagal membuat offer", err);
        }
      }
    });

    socket.on("user-joined", (user: ParticipantInfo) => {
      addRemote(user);
    });

    socket.on("offer", async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const entry = createPeer(from, false);
      try {
        await entry.pc.setRemoteDescription(sdp);
        await flushIce(entry);
        await entry.pc.setLocalDescription(await entry.pc.createAnswer());
        socket.emit("answer", { to: from, sdp: entry.pc.localDescription });
      } catch (err) {
        console.error("Gagal memproses offer", err);
      }
    });

    socket.on("answer", async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const entry = peers.get(from);
      if (!entry) return;
      try {
        await entry.pc.setRemoteDescription(sdp);
        await flushIce(entry);
      } catch (err) {
        console.error("Gagal memproses answer", err);
      }
    });

    socket.on("ice-candidate", async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      const entry = peers.get(from);
      if (!entry) return;
      if (entry.pc.remoteDescription) {
        try {
          await entry.pc.addIceCandidate(candidate);
        } catch (err) {
          console.warn("Gagal menambah ICE candidate", err);
        }
      } else {
        entry.pendingIce.push(candidate);
      }
    });

    socket.on("media-state", ({ socketId, audio, video, screen }: ParticipantInfo) => {
      patchRemote(socketId, { audio, video, screen });
    });

    socket.on("user-left", ({ socketId }: { socketId: string }) => {
      closePeer(socketId);
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
    });

    socket.on("chat-message", (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on("room-full", () => {
      setStatus("full");
      socket.disconnect();
    });

    socket.on("join-error", () => {
      setStatus("error");
      socket.disconnect();
    });

    return () => {
      socket.emit("leave-room");
      socket.removeAllListeners();
      socket.disconnect();
      closeAll();
      socketRef.current = null;
    };
  }, [active, roomId]);

  // Ganti track video yang dikirim saat mulai/berhenti share screen (tanpa negosiasi ulang).
  useEffect(() => {
    const cameraTrack = localStream?.getVideoTracks()[0] ?? null;
    const outgoing = screenTrack ?? cameraTrack;
    peersRef.current.forEach(({ pc }) => {
      const transceiver = pc.getTransceivers().find((t) => t.receiver.track?.kind === "video");
      if (transceiver && transceiver.sender.track !== outgoing) {
        transceiver.sender.replaceTrack(outgoing).catch((err) => console.warn("replaceTrack gagal", err));
      }
    });
  }, [screenTrack, localStream]);

  // Beri tahu peserta lain saat mic/kamera/share screen berubah.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected || status !== "connected") return;
    socket.emit("media-state", { audio: audioOn, video: videoOn || !!screenTrack, screen: !!screenTrack });
  }, [audioOn, videoOn, screenTrack, status]);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    socketRef.current?.emit("chat-message", { text: trimmed });
  }, []);

  return { status, participants, messages, myId, sendMessage };
}
