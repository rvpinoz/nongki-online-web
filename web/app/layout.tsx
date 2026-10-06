import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const font = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "MeetLite — Video meeting sederhana",
  description: "Buat ruang meeting, bagikan link, dan ngobrol tatap muka langsung dari browser.",
};

export const viewport: Viewport = {
  themeColor: "#0d0f12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={font.variable}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
