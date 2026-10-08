/**
 * Kualitas video dinamis. Di topologi mesh, tiap peserta meng-encode video sekali per peserta lain,
 * jadi makin ramai room → resolusi, bitrate, dan fps per koneksi diturunkan.
 * Di dalam batas ini, congestion control bawaan WebRTC tetap menyesuaikan dengan kondisi jaringan.
 */
export type QualityMode = "auto" | "hemat" | "hd";

export const QUALITY_OPTIONS: { id: QualityMode; label: string; hint: string }[] = [
  { id: "auto", label: "Otomatis", hint: "Menyesuaikan jumlah peserta" },
  { id: "hemat", label: "Hemat data", hint: "Ringan untuk sinyal lemah" },
  { id: "hd", label: "Kualitas tinggi", hint: "Butuh internet kencang" },
];

type Tier = { height: number; maxBitrate: number; maxFramerate: number };

// Index = tingkat; dipilih berdasarkan jumlah peserta lain (koneksi keluar).
const CAMERA_TIERS: Tier[] = [
  { height: 720, maxBitrate: 1_500_000, maxFramerate: 30 },
  { height: 540, maxBitrate: 900_000, maxFramerate: 30 },
  { height: 360, maxBitrate: 500_000, maxFramerate: 24 },
  { height: 270, maxBitrate: 320_000, maxFramerate: 20 },
  { height: 180, maxBitrate: 180_000, maxFramerate: 15 },
];

function cameraTierIndex(peerCount: number): number {
  if (peerCount <= 1) return 0;
  if (peerCount <= 2) return 1;
  if (peerCount <= 4) return 2;
  if (peerCount <= 7) return 3;
  return 4;
}

export type EncodingTarget = { maxBitrate: number; maxFramerate: number; scaleResolutionDownBy: number };

export function encodingFor(
  track: MediaStreamTrack,
  { peerCount, mode, isScreen }: { peerCount: number; mode: QualityMode; isScreen: boolean },
): EncodingTarget {
  const sourceHeight = track.getSettings().height ?? 720;

  if (isScreen) {
    // Layar: resolusi dijaga (teks tetap tajam), fps rendah.
    const maxBitrate = mode === "hemat" ? 500_000 : peerCount <= 2 ? 2_500_000 : peerCount <= 5 ? 1_500_000 : 900_000;
    const maxHeight = mode === "hemat" ? 720 : 1080;
    return {
      maxBitrate: mode === "hd" ? maxBitrate * 1.5 : maxBitrate,
      maxFramerate: mode === "hemat" ? 5 : 15,
      scaleResolutionDownBy: Math.max(1, sourceHeight / maxHeight),
    };
  }

  let index = cameraTierIndex(peerCount);
  if (mode === "hemat") index = CAMERA_TIERS.length - 1;
  if (mode === "hd") index = Math.max(0, index - 1);
  const tier = CAMERA_TIERS[index];
  return {
    maxBitrate: tier.maxBitrate,
    maxFramerate: tier.maxFramerate,
    scaleResolutionDownBy: Math.max(1, sourceHeight / tier.height),
  };
}

/** Terapkan target encoding ke sender. Aman dipanggil berulang; diabaikan sebelum negosiasi selesai. */
export async function applyEncoding(sender: RTCRtpSender, target: EncodingTarget): Promise<void> {
  const params = sender.getParameters();
  const encoding = params.encodings?.[0];
  if (!encoding) return;
  if (
    encoding.maxBitrate === target.maxBitrate &&
    encoding.maxFramerate === target.maxFramerate &&
    encoding.scaleResolutionDownBy === target.scaleResolutionDownBy
  ) {
    return;
  }
  encoding.maxBitrate = target.maxBitrate;
  encoding.maxFramerate = target.maxFramerate;
  encoding.scaleResolutionDownBy = target.scaleResolutionDownBy;
  try {
    await sender.setParameters(params);
  } catch (err) {
    console.warn("Gagal mengatur kualitas video", err);
  }
}
