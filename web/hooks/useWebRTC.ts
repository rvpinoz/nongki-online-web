"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { DEFAULT_MAX_PARTICIPANTS, FALLBACK_ICE_SERVERS, MAX_CHAT_MESSAGES } from "@/lib/config";
import { applyEncoding, encodingFor, type QualityMode } from "@/lib/quality";
import { createSocket } from "@/lib/socket";
import type { ChatMessage, ConnectionStatus, ParticipantInfo, RemoteParticipant, ServerConfig } from "@/lib/types";

type PeerEntry = {
  pc: RTCPeerConnection;
  remoteTracks: MediaStreamTrack[];
  pendingIce: RTCIceCandidateInit[];
};

type Options = {
  roomId: string;
  name: string;
  active: boolean; // true setelah user klik "Gabung"
  localStream: MediaStream | null; // sumber audio
  outgoingVideo: MediaStreamTrack | null; // layar > kamera dengan efek > kamera asli
  isScreen: boolean;
  quality: QualityMode;
  audioOn: boolean;
  videoOn: boolean;
};

/** Transceiver video milik koneksi ini (selalu satu, dibuat oleh offer pertama). */
function videoTransceiver(pc: RTCPeerConnection): RTCRtpTransceiver | undefined {
  return pc.getTransceivers().find((t) => t.receiver.track?.kind === "video");
}

/**
 * Inti video call: koneksi ke signaling server + satu RTCPeerConnection per peserta (mesh).
 * Peserta yang baru masuk selalu membuat offer ke peserta lama.
 */
export function useWebRTC({ roomId, name, active, localStream, outgoingVideo, isScreen, quality, audioOn, videoOn }: Options) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [maxParticipants, setMaxParticipants] = useState(DEFAULT_MAX_PARTICIPANTS);

  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const iceServersRef = useRef<RTCIceServer[]>(FALLBACK_ICE_SERVERS);

  // Nilai terbaru disimpan di ref supaya handler socket tidak memakai nilai basi.
  const latest = useRef({ name, localStream, outgoingVideo, isScreen, quality, audioOn, videoOn });
  latest.current = { name, localStream, outgoingVideo, isScreen, quality, audioOn, videoOn };

  /** Atur bitrate/resolusi semua koneksi sesuai jumlah peserta & mode kualitas. */
  const applyQuality = useCallback(() => {
    const peers = peersRef.current;
    const { isScreen: screen, quality: mode } = latest.current;
    peers.forEach(({ pc }) => {
      const sender = videoTransceiver(pc)?.sender;
      if (!sender?.track) return;
      applyEncoding(sender, encodingFor(sender.track, { peerCount: peers.size, mode, isScreen: screen }));
    });
  }, []);

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
      applyQuality();
    };

    const closeAll = () => {
      peers.forEach((entry) => entry.pc.close());
      peers.clear();
      setParticipants([]);
    };

    const createPeer = (remoteId: string, initiator: boolean): PeerEntry => {
      const existing = peers.get(remoteId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
      const entry: PeerEntry = { pc, remoteTracks: [], pendingIce: [] };
      peers.set(remoteId, entry);

      const { localStream: local, outgoingVideo: video } = latest.current;
      const msid = local ?? new MediaStream();
      const audioTrack = local?.getAudioTracks()[0];

      if (audioTrack) pc.addTrack(audioTrack, msid);
      else if (initiator) pc.addTransceiver("audio", { direction: "recvonly" });
      // Jalur video selalu dua arah, walau belum ada kamera, supaya share screen bisa
      // dikirim belakangan lewat replaceTrack tanpa negosiasi ulang.
      if (video) pc.addTrack(video, msid);
      else if (initiator) pc.addTransceiver("video", { direction: "sendrecv" });

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
        if (pc.connectionState === "connected") applyQuality();
        // Coba pulihkan jalur ICE yang putus (mis. pindah Wi-Fi → data seluler).
        if (pc.connectionState === "failed" && initiator) {
          pc.restartIce();
          pc.createOffer({ iceRestart: true })
            .then((offer) => pc.setLocalDescription(offer))
            .then(() => socket.emit("offer", { to: remoteId, sdp: pc.localDescription }))
            .catch((err) => console.warn("ICE restart gagal", err));
        }
      };

      applyQuality();
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

    socket.on("config", (config: ServerConfig) => {
      if (Array.isArray(config?.iceServers) && config.iceServers.length > 0) iceServersRef.current = config.iceServers;
      if (typeof config?.maxParticipants === "number") setMaxParticipants(config.maxParticipants);
    });

    socket.on("connect", () => {
      setMyId(socket.id ?? null);
      const { name: myName, audioOn: a, videoOn: v, isScreen: s } = latest.current;
      socket.emit("join-room", { roomId, name: myName, audio: a, video: v || s });
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
        // Kalau kita tidak punya kamera, tetap buka arah kirim video untuk share screen nanti.
        const video = videoTransceiver(entry.pc);
        if (video && !video.sender.track && video.direction === "recvonly") video.direction = "sendrecv";
        await entry.pc.setLocalDescription(await entry.pc.createAnswer());
        socket.emit("answer", { to: from, sdp: entry.pc.localDescription });
      } catch (err) {
        console.error("Gagal memproses offer", err);
      }
    });

    socket.on("answer", async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const entry = peers.get(from);
      if (!entry || entry.pc.signalingState !== "have-local-offer") return;
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
      setMessages((prev) => {
        const next = [...prev, message];
        return next.length > MAX_CHAT_MESSAGES ? next.slice(-MAX_CHAT_MESSAGES) : next;
      });
    });

    socket.on("room-full", ({ max }: { max?: number }) => {
      if (typeof max === "number") setMaxParticipants(max);
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
  }, [active, roomId, applyQuality]);

  // Ganti track video yang dikirim (kamera ↔ efek ↔ layar) tanpa negosiasi ulang.
  useEffect(() => {
    const pending: Promise<void>[] = [];
    peersRef.current.forEach(({ pc }) => {
      const transceiver = videoTransceiver(pc);
      if (transceiver && transceiver.sender.track !== outgoingVideo) {
        pending.push(transceiver.sender.replaceTrack(outgoingVideo).catch((err) => console.warn("replaceTrack gagal", err)));
      }
    });
    Promise.all(pending).then(applyQuality);
  }, [outgoingVideo, applyQuality]);

  useEffect(() => {
    applyQuality();
  }, [participants.length, isScreen, quality, applyQuality]);

  // Beri tahu peserta lain saat mic/kamera/share screen berubah.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected || status !== "connected") return;
    socket.emit("media-state", { audio: audioOn, video: videoOn || isScreen, screen: isScreen });
  }, [audioOn, videoOn, isScreen, status]);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    socketRef.current?.emit("chat-message", { text: trimmed });
  }, []);

  return { status, participants, messages, myId, maxParticipants, sendMessage };
}
