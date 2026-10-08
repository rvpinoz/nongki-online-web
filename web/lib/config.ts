export const SIGNALING_URL = process.env.NEXT_PUBLIC_SIGNALING_URL ?? "http://localhost:4000";

// Dipakai sampai server mengirim event "config" (yang berisi STUN + TURN dengan kredensial sementara).
export const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

// Hanya untuk tampilan sebelum server mengirim batas sebenarnya (env MAX_PARTICIPANTS di server).
export const DEFAULT_MAX_PARTICIPANTS = 8;

export const MAX_CHAT_MESSAGES = 300;

// Model & wasm MediaPipe di-host sendiri di public/mediapipe.
export const MEDIAPIPE_WASM_PATH = "/mediapipe/wasm";
export const MEDIAPIPE_MODELS = {
  segmenter: "/mediapipe/models/selfie_segmenter.tflite",
  faceDetector: "/mediapipe/models/face_detector.tflite",
};
