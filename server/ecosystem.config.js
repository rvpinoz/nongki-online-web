// PM2 untuk signaling server. Jalankan `npm install && npm run build` dulu (output ke dist/).
module.exports = {
  apps: [
    {
      name: "nongki-server",
      script: "dist/index.js",
      cwd: __dirname,
      // Room disimpan di memori, jadi wajib 1 instance (jangan mode cluster).
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
        // GANTI dengan domain frontend (boleh beberapa, pisahkan koma).
        CLIENT_ORIGIN: "https://GANTI-DENGAN-DOMAIN-FRONTEND",
        MAX_PARTICIPANTS: 8,
        MAX_CONN_PER_IP: 20,
        // Set "1" kalau server di belakang nginx / Cloudflare.
        TRUST_PROXY: "0",
        // Opsional TURN (coturn use-auth-secret):
        // TURN_URLS: "turn:turn.domain.com:3478",
        // TURN_SECRET: "rahasia-panjang-acak",
      },
    },
  ],
};
