"use client";

import type { ReactNode } from "react";

function gridClass(count: number): string {
  if (count <= 1) return "grid-cols-1 grid-rows-1";
  if (count === 2) return "grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1";
  if (count <= 4) return "grid-cols-2 grid-rows-2";
  return "grid-cols-2 grid-rows-3 md:grid-cols-3 md:grid-rows-2";
}

/** Grid yang menyesuaikan jumlah peserta: 1 penuh, 2 berdampingan, 3–4 = 2×2, 5–6 = 3×2. */
export function VideoGrid({ children, count }: { children: ReactNode; count: number }) {
  return <div className={`grid h-full w-full gap-3 ${gridClass(count)}`}>{children}</div>;
}
