import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const font = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: "Nongki Online — Nongkrong bareng lewat video",
  description: "Buat ruang, bagikan link, dan nongkrong tatap muka langsung dari browser.",
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={font.variable}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
