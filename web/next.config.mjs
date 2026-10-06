/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dimatikan supaya efek koneksi WebRTC tidak dijalankan dua kali saat development.
  reactStrictMode: false,
};

export default nextConfig;
