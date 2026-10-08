import type { FaceSticker } from "./types";

type Point = { x: number; y: number };

/** Titik wajah dalam piksel (dari keypoint BlazeFace). "right" = kanan si pemilik wajah. */
export type FacePoints = {
  rightEye: Point;
  leftEye: Point;
  nose: Point;
  mouth: Point;
};

const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/**
 * Menggambar stiker mengikuti posisi, ukuran, dan kemiringan wajah.
 * Semua ukuran relatif terhadap jarak antar-mata (d) supaya pas di wajah dekat maupun jauh.
 */
export function drawSticker(ctx: CanvasRenderingContext2D, sticker: FaceSticker, face: FacePoints): void {
  if (sticker === "none") return;
  const eyes = lerp(face.rightEye, face.leftEye, 0.5);
  const dx = face.leftEye.x - face.rightEye.x;
  const dy = face.leftEye.y - face.rightEye.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) return;
  const angle = Math.atan2(dy, dx);

  const at = (p: Point, draw: () => void) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    draw();
    ctx.restore();
  };

  switch (sticker) {
    case "shades":
      at(eyes, () => drawShades(ctx, d));
      break;
    case "clown":
      at(face.nose, () => drawClownNose(ctx, d));
      break;
    case "mustache":
      at(lerp(face.nose, face.mouth, 0.5), () => drawMustache(ctx, d));
      break;
    case "crown":
      at(eyes, () => drawCrown(ctx, d));
      break;
    case "cat":
      at(eyes, () => drawCatEars(ctx, d));
      at(face.nose, () => drawCatNose(ctx, d));
      break;
  }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawShades(ctx: CanvasRenderingContext2D, d: number) {
  const lensW = d * 0.95;
  const lensH = d * 0.6;
  ctx.lineWidth = d * 0.07;
  ctx.strokeStyle = "#0a0a0a";
  ctx.beginPath();
  ctx.moveTo(-d * 0.1, -d * 0.08);
  ctx.quadraticCurveTo(0, -d * 0.18, d * 0.1, -d * 0.08);
  ctx.moveTo(-d * 0.5 - lensW / 2, -d * 0.1);
  ctx.lineTo(-d * 1.15, -d * 0.18);
  ctx.moveTo(d * 0.5 + lensW / 2, -d * 0.1);
  ctx.lineTo(d * 1.15, -d * 0.18);
  ctx.stroke();
  for (const side of [-1, 1]) {
    const x = side * d * 0.52 - lensW / 2;
    const y = -lensH * 0.4;
    const g = ctx.createLinearGradient(x, y, x + lensW, y + lensH);
    g.addColorStop(0, "#2b2b2b");
    g.addColorStop(1, "#000");
    ctx.fillStyle = g;
    roundedRect(ctx, x, y, lensW, lensH, lensH * 0.35);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,204,0,0.7)";
    ctx.lineWidth = d * 0.04;
    ctx.beginPath();
    ctx.moveTo(x + lensW * 0.2, y + lensH * 0.3);
    ctx.lineTo(x + lensW * 0.45, y + lensH * 0.15);
    ctx.stroke();
    ctx.strokeStyle = "#0a0a0a";
    ctx.lineWidth = d * 0.07;
  }
}

function drawClownNose(ctx: CanvasRenderingContext2D, d: number) {
  const r = d * 0.3;
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, "#ff7b7b");
  g.addColorStop(1, "#c1272d");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawMustache(ctx: CanvasRenderingContext2D, d: number) {
  ctx.fillStyle = "#1a1208";
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.beginPath();
    ctx.moveTo(0, -d * 0.05);
    ctx.bezierCurveTo(d * 0.25, -d * 0.22, d * 0.55, -d * 0.12, d * 0.62, d * 0.05);
    ctx.bezierCurveTo(d * 0.7, d * 0.18, d * 0.78, d * 0.05, d * 0.8, -d * 0.08);
    ctx.bezierCurveTo(d * 0.8, d * 0.2, d * 0.62, d * 0.28, d * 0.45, d * 0.18);
    ctx.bezierCurveTo(d * 0.3, d * 0.1, d * 0.12, d * 0.12, 0, d * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawCrown(ctx: CanvasRenderingContext2D, d: number) {
  const w = d * 1.9;
  const h = d * 0.95;
  const base = -d * 1.15; // di atas dahi
  ctx.beginPath();
  ctx.moveTo(-w / 2, base);
  ctx.lineTo(-w / 2, base - h * 0.75);
  ctx.lineTo(-w / 4, base - h * 0.35);
  ctx.lineTo(0, base - h);
  ctx.lineTo(w / 4, base - h * 0.35);
  ctx.lineTo(w / 2, base - h * 0.75);
  ctx.lineTo(w / 2, base);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, base - h, 0, base);
  g.addColorStop(0, "#fff1a6");
  g.addColorStop(1, "#ffcc00");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = d * 0.05;
  ctx.strokeStyle = "#b38f00";
  ctx.stroke();
  ctx.fillStyle = "#e5383b";
  for (const x of [-w / 3, 0, w / 3]) {
    ctx.beginPath();
    ctx.arc(x, base - h * 0.18, d * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCatEars(ctx: CanvasRenderingContext2D, d: number) {
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * d * 0.8, -d * 1.2);
    ctx.rotate(side * 0.3);
    ctx.beginPath();
    ctx.moveTo(-d * 0.42, d * 0.25);
    ctx.lineTo(0, -d * 0.75);
    ctx.lineTo(d * 0.42, d * 0.25);
    ctx.closePath();
    ctx.fillStyle = "#1e1e1e";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-d * 0.24, d * 0.15);
    ctx.lineTo(0, -d * 0.45);
    ctx.lineTo(d * 0.24, d * 0.15);
    ctx.closePath();
    ctx.fillStyle = "#ff8a9a";
    ctx.fill();
    ctx.restore();
  }
}

function drawCatNose(ctx: CanvasRenderingContext2D, d: number) {
  ctx.fillStyle = "#ff8a9a";
  ctx.beginPath();
  ctx.moveTo(-d * 0.12, -d * 0.05);
  ctx.lineTo(d * 0.12, -d * 0.05);
  ctx.lineTo(0, d * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = d * 0.025;
  ctx.beginPath();
  for (const side of [-1, 1]) {
    for (const tilt of [-0.12, 0.05, 0.2]) {
      ctx.moveTo(side * d * 0.2, d * 0.08);
      ctx.lineTo(side * d * 0.75, d * (0.08 + tilt));
    }
  }
  ctx.stroke();
}
