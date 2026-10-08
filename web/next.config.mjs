const isDev = process.env.NODE_ENV !== "production";

// CSP hanya mengizinkan koneksi ke signaling server sendiri (http + websocket).
const signaling = new URL(process.env.NEXT_PUBLIC_SIGNALING_URL ?? "http://localhost:4000");
const signalingWs = `${signaling.protocol === "https:" ? "wss:" : "ws:"}//${signaling.host}`;

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' dibutuhkan script bootstrap Next.js; 'wasm-unsafe-eval' untuk MediaPipe (efek video).
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${signaling.origin} ${signalingWs}`,
  "media-src 'self' blob: mediastream:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), display-capture=(self), fullscreen=(self), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dimatikan supaya efek koneksi WebRTC tidak dijalankan dua kali saat development.
  reactStrictMode: false,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // File model & wasm besar dan tidak berubah antar-versi → cache lama di browser.
        source: "/mediapipe/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
