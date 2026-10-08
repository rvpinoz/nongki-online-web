import type { FaceDetector, ImageSegmenter } from "@mediapipe/tasks-vision";
import { MEDIAPIPE_MODELS, MEDIAPIPE_WASM_PATH } from "@/lib/config";
import { drawPreset } from "./backgrounds";
import { drawSticker, type FacePoints } from "./stickers";
import { colorFilterCss, type VideoEffects, NO_EFFECTS } from "./types";

const OUTPUT_MAX_WIDTH = 854; // ±480p: cukup tajam untuk video call, ringan untuk HP
const FPS = 24;
const FACE_EVERY_N_FRAMES = 2; // deteksi wajah tiap 2 frame, posisi di-smoothing
const FACE_SMOOTHING = 0.55;
const FACE_LOST_FRAMES = 8;

// --- Model dimuat sekali (lazy), dipakai ulang antar-sesi --------------------------------------

type Vision = typeof import("@mediapipe/tasks-vision");
let visionPromise: Promise<{ vision: Vision; fileset: Awaited<ReturnType<Vision["FilesetResolver"]["forVisionTasks"]>> }> | null = null;
let segmenterPromise: Promise<ImageSegmenter> | null = null;
let faceDetectorPromise: Promise<FaceDetector> | null = null;

function loadVision() {
  visionPromise ??= import("@mediapipe/tasks-vision").then(async (vision) => ({
    vision,
    fileset: await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH),
  }));
  visionPromise.catch(() => (visionPromise = null));
  return visionPromise;
}

/** Coba GPU dulu (jauh lebih cepat), jatuh ke CPU kalau WebGL tidak tersedia. */
async function withDelegate<T>(create: (delegate: "GPU" | "CPU") => Promise<T>): Promise<T> {
  try {
    return await create("GPU");
  } catch (err) {
    console.warn("Delegate GPU gagal, pakai CPU", err);
    return create("CPU");
  }
}

function loadSegmenter() {
  segmenterPromise ??= loadVision().then(({ vision, fileset }) =>
    withDelegate((delegate) =>
      vision.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MEDIAPIPE_MODELS.segmenter, delegate },
        runningMode: "VIDEO",
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      }),
    ),
  );
  segmenterPromise.catch(() => (segmenterPromise = null));
  return segmenterPromise;
}

function loadFaceDetector() {
  faceDetectorPromise ??= loadVision().then(({ vision, fileset }) =>
    withDelegate((delegate) =>
      vision.FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MEDIAPIPE_MODELS.faceDetector, delegate },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.5,
      }),
    ),
  );
  faceDetectorPromise.catch(() => (faceDetectorPromise = null));
  return faceDetectorPromise;
}

/** Cek apakah browser mendukung `ctx.filter` (dipakai untuk filter warna). Safari lama tidak. */
export function supportsCanvasFilter(): boolean {
  if (typeof document === "undefined") return false;
  const ctx = document.createElement("canvas").getContext("2d");
  return !!ctx && typeof ctx.filter === "string";
}

// Timer di Worker tidak di-throttle seketat requestAnimationFrame saat tab di belakang,
// jadi video tetap terkirim ke peserta lain walau user pindah tab.
function createTicker(intervalMs: number, onTick: () => void) {
  const source = "let t;onmessage=e=>{clearInterval(t);if(e.data>0)t=setInterval(()=>postMessage(0),e.data)}";
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  const worker = new Worker(url);
  URL.revokeObjectURL(url);
  worker.onmessage = onTick;
  worker.postMessage(intervalMs);
  return () => worker.terminate();
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("Canvas 2D tidak tersedia");
  return ctx;
}

/**
 * Mengambil track kamera, menerapkan background virtual / filter / stiker wajah,
 * dan menghasilkan track video baru (`track`) yang dikirim ke peserta lain.
 */
export class VideoEffectsProcessor {
  readonly track: MediaStreamTrack;

  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private maskCanvas = document.createElement("canvas");
  private maskCtx = context2d(this.maskCanvas);
  private maskData: ImageData | null = null;
  private smallCanvas = document.createElement("canvas"); // untuk blur murah (downscale → upscale)
  private smallCtx = context2d(this.smallCanvas);
  private bgCanvas = document.createElement("canvas"); // background preset/gambar yang sudah di-cache
  private bgCtx = context2d(this.bgCanvas);
  private bgKey = "";

  private effects: VideoEffects = NO_EFFECTS;
  private segmenter: ImageSegmenter | null = null;
  private faceDetector: FaceDetector | null = null;
  private face: FacePoints | null = null;
  private faceMissing = 0;
  private frame = 0;
  private lastTimestamp = 0;
  private paused = false;
  private destroyed = false;
  private stopTicker: () => void;
  private canFilter = supportsCanvasFilter();

  private constructor(video: HTMLVideoElement, width: number, height: number) {
    this.video = video;
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = context2d(this.canvas);
    this.bgCanvas.width = width;
    this.bgCanvas.height = height;

    const stream = this.canvas.captureStream(FPS);
    this.track = stream.getVideoTracks()[0];
    this.track.contentHint = "motion";
    this.stopTicker = createTicker(1000 / FPS, this.render);
  }

  static async create(input: MediaStreamTrack): Promise<VideoEffectsProcessor> {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    // iOS Safari hanya memutar video yang ada di DOM.
    video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;top:-10px";
    document.body.appendChild(video);
    video.srcObject = new MediaStream([input]);
    await video.play().catch(() => undefined);
    if (video.readyState < 2) {
      await new Promise<void>((resolve) => video.addEventListener("loadeddata", () => resolve(), { once: true }));
    }

    const sourceW = video.videoWidth || input.getSettings().width || 640;
    const sourceH = video.videoHeight || input.getSettings().height || 360;
    const scale = Math.min(1, OUTPUT_MAX_WIDTH / sourceW);
    return new VideoEffectsProcessor(video, Math.round(sourceW * scale), Math.round(sourceH * scale));
  }

  get supportsFilter(): boolean {
    return this.canFilter;
  }

  /** Ganti efek. Model yang dibutuhkan diunduh saat pertama kali dipakai. */
  async setEffects(effects: VideoEffects): Promise<void> {
    const needSegmenter = effects.background.type !== "none";
    const needFace = effects.sticker !== "none";
    const [segmenter, faceDetector] = await Promise.all([
      needSegmenter ? loadSegmenter() : null,
      needFace ? loadFaceDetector() : null,
    ]);
    if (this.destroyed) return;
    this.segmenter = segmenter;
    this.faceDetector = faceDetector;
    if (!needFace) this.face = null;
    this.effects = effects;
    await this.prepareBackground();
  }

  /** Hentikan pemrosesan (kamera mati / sedang share screen) supaya CPU & baterai hemat. */
  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  destroy(): void {
    this.destroyed = true;
    this.stopTicker();
    this.track.stop();
    this.video.srcObject = null;
    this.video.remove();
  }

  private async prepareBackground(): Promise<void> {
    const bg = this.effects.background;
    const key = bg.type === "preset" ? `preset:${bg.id}` : bg.type === "image" ? `image:${bg.url}` : "";
    if (!key || key === this.bgKey) return;
    const { width: w, height: h } = this.bgCanvas;

    if (bg.type === "preset") {
      drawPreset(bg.id, this.bgCtx, w, h);
    } else if (bg.type === "image") {
      const image = new Image();
      image.src = bg.url;
      await image.decode();
      // object-fit: cover
      const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
      const dw = image.naturalWidth * scale;
      const dh = image.naturalHeight * scale;
      this.bgCtx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }
    this.bgKey = key;
  }

  private render = () => {
    if (this.paused || this.destroyed || this.video.readyState < 2) return;
    const { ctx, video, effects } = this;
    const { width: w, height: h } = this.canvas;
    // MediaPipe mewajibkan timestamp yang selalu naik.
    const timestamp = Math.max(performance.now(), this.lastTimestamp + 1);
    this.lastTimestamp = timestamp;
    this.frame++;

    const filter = this.canFilter ? colorFilterCss(effects.filter) : "none";

    try {
      if (effects.background.type !== "none" && this.segmenter) {
        this.updateMask(timestamp);
        ctx.globalCompositeOperation = "copy";
        // Tepi mask sedikit di-blur supaya rambut/bahu tidak bergerigi.
        if (this.canFilter) ctx.filter = "blur(2px)";
        ctx.drawImage(this.maskCanvas, 0, 0, w, h);
        // Orang = frame kamera yang dipotong mask.
        ctx.globalCompositeOperation = "source-in";
        ctx.filter = filter;
        ctx.drawImage(video, 0, 0, w, h);
        // Background digambar di belakang orang.
        ctx.globalCompositeOperation = "destination-over";
        this.drawBackground(w, h, filter);
      } else {
        ctx.globalCompositeOperation = "copy";
        ctx.filter = filter;
        ctx.drawImage(video, 0, 0, w, h);
      }
    } finally {
      ctx.globalCompositeOperation = "source-over";
      ctx.filter = "none";
    }

    if (effects.sticker !== "none" && this.faceDetector) {
      if (this.frame % FACE_EVERY_N_FRAMES === 0) this.updateFace(timestamp, w, h);
      if (this.face) drawSticker(ctx, effects.sticker, this.face);
    }
  };

  private drawBackground(w: number, h: number, filter: string) {
    const bg = this.effects.background;
    if (bg.type === "blur") {
      // Blur murah: kecilkan frame lalu besarkan lagi (jauh lebih ringan dari ctx.filter blur).
      const factor = bg.strength === "strong" ? 28 : 12;
      const sw = Math.max(8, Math.round(w / factor));
      const sh = Math.max(8, Math.round(h / factor));
      if (this.smallCanvas.width !== sw || this.smallCanvas.height !== sh) {
        this.smallCanvas.width = sw;
        this.smallCanvas.height = sh;
      }
      this.smallCtx.filter = filter;
      this.smallCtx.drawImage(this.video, 0, 0, sw, sh);
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = "high";
      this.ctx.filter = "none";
      this.ctx.drawImage(this.smallCanvas, 0, 0, w, h);
    } else if (this.bgKey) {
      this.ctx.filter = "none";
      this.ctx.drawImage(this.bgCanvas, 0, 0, w, h);
    }
  }

  private updateMask(timestamp: number) {
    const result = this.segmenter!.segmentForVideo(this.video, timestamp);
    try {
      const mask = result.confidenceMasks?.[0];
      if (!mask) return;
      const { width: mw, height: mh } = mask;
      if (!this.maskData || this.maskData.width !== mw || this.maskData.height !== mh) {
        this.maskCanvas.width = mw;
        this.maskCanvas.height = mh;
        this.maskData = new ImageData(mw, mh);
        this.maskData.data.fill(255);
      }
      const values = mask.getAsFloat32Array();
      const data = this.maskData.data;
      for (let i = 0; i < values.length; i++) data[i * 4 + 3] = values[i] * 255;
      this.maskCtx.putImageData(this.maskData, 0, 0);
    } finally {
      result.close();
    }
  }

  private updateFace(timestamp: number, w: number, h: number) {
    const detection = this.faceDetector!.detectForVideo(this.video, timestamp).detections[0];
    const k = detection?.keypoints;
    if (!k || k.length < 4) {
      if (++this.faceMissing > FACE_LOST_FRAMES) this.face = null;
      return;
    }
    this.faceMissing = 0;
    const next: FacePoints = {
      rightEye: { x: k[0].x * w, y: k[0].y * h },
      leftEye: { x: k[1].x * w, y: k[1].y * h },
      nose: { x: k[2].x * w, y: k[2].y * h },
      mouth: { x: k[3].x * w, y: k[3].y * h },
    };
    const prev = this.face;
    if (!prev) {
      this.face = next;
      return;
    }
    const smooth = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
      x: a.x * FACE_SMOOTHING + b.x * (1 - FACE_SMOOTHING),
      y: a.y * FACE_SMOOTHING + b.y * (1 - FACE_SMOOTHING),
    });
    this.face = {
      rightEye: smooth(prev.rightEye, next.rightEye),
      leftEye: smooth(prev.leftEye, next.leftEye),
      nose: smooth(prev.nose, next.nose),
      mouth: smooth(prev.mouth, next.mouth),
    };
  }
}
