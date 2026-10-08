/**
 * Background virtual bawaan, digambar langsung di canvas (tanpa file gambar, tanpa request jaringan).
 * Warna mengikuti tema Nongki Online: kuning, merah, hitam, putih.
 */
type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export const BACKGROUND_PRESETS: { id: string; label: string; draw: Draw }[] = [
  {
    id: "senja",
    label: "Senja",
    draw: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#ffcc00");
      g.addColorStop(0.55, "#ff7a1a");
      g.addColorStop(1, "#c1272d");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(w * 0.75, h * 0.42, h * 0.18, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: "malam",
    label: "Lampu malam",
    draw: (ctx, w, h) => {
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, w, h);
      const colors = ["rgba(255,204,0,0.45)", "rgba(229,56,59,0.4)", "rgba(255,255,255,0.25)"];
      // Pola bokeh tetap (deterministik) supaya tidak berubah tiap kali digambar ulang.
      for (let i = 0; i < 26; i++) {
        const x = ((i * 137) % 100) / 100;
        const y = ((i * 61) % 100) / 100;
        const r = (0.03 + ((i * 29) % 7) / 100) * h;
        const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r);
        g.addColorStop(0, colors[i % colors.length]);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x * w, y * h, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    id: "garis",
    label: "Garis",
    draw: (ctx, w, h) => {
      ctx.fillStyle = "#141414";
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-Math.PI / 6);
      const stripe = h / 9;
      for (let i = -12; i < 12; i++) {
        ctx.fillStyle = i % 3 === 0 ? "#ffcc00" : i % 3 === 1 ? "#e5383b" : "#1e1e1e";
        ctx.fillRect(-w, i * stripe, w * 2, stripe * 0.5);
      }
      ctx.restore();
      ctx.fillStyle = "rgba(10,10,10,0.35)";
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: "polkadot",
    label: "Polkadot",
    draw: (ctx, w, h) => {
      ctx.fillStyle = "#e5383b";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      const gap = h / 7;
      for (let row = 0; row * gap < h + gap; row++) {
        for (let col = 0; col * gap < w + gap; col++) {
          const x = col * gap + (row % 2 ? gap / 2 : 0);
          ctx.beginPath();
          ctx.arc(x, row * gap, gap * 0.14, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
  {
    id: "studio",
    label: "Studio",
    draw: (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, Math.max(w, h) * 0.75);
      g.addColorStop(0, "#f5f5f5");
      g.addColorStop(1, "#9a9a9a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  },
];

export function drawPreset(id: string, ctx: CanvasRenderingContext2D, w: number, h: number): void {
  (BACKGROUND_PRESETS.find((p) => p.id === id) ?? BACKGROUND_PRESETS[0]).draw(ctx, w, h);
}
