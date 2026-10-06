export const SIGNALING_URL = process.env.NEXT_PUBLIC_SIGNALING_URL ?? "http://localhost:4000";

const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ...(turnUrl
    ? [
        {
          urls: turnUrl,
          username: process.env.NEXT_PUBLIC_TURN_USERNAME,
          credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
        },
      ]
    : []),
];

export const MAX_PARTICIPANTS = 6;
