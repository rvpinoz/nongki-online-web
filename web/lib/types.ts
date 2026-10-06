export type ParticipantInfo = {
  socketId: string;
  name: string;
  audio: boolean;
  video: boolean;
  screen?: boolean;
};

export type RemoteParticipant = ParticipantInfo & {
  stream: MediaStream | null;
  connection: RTCPeerConnectionState;
};

export type ChatMessage = {
  id: string;
  socketId: string;
  name: string;
  text: string;
  time: number;
};

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "full" | "error";
