"use client";

import { isValidElement, type ReactNode } from "react";

function gridClass(count: number): string {
  if (count <= 1) return "grid-cols-1 grid-rows-1";
  if (count === 2) return "grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1";
  if (count <= 4) return "grid-cols-2 grid-rows-2";
  if (count <= 6) return "grid-cols-2 grid-rows-3 md:grid-cols-3 md:grid-rows-2";
  if (count <= 9) return "grid-cols-3 grid-rows-3";
  return "grid-cols-3 grid-rows-4 md:grid-cols-4 md:grid-rows-3";
}

/** Grid yang menyesuaikan jumlah peserta (sampai 12 tile). */
export function VideoGrid({ children, count }: { children: ReactNode; count: number }) {
  return <div className={`grid h-full w-full gap-2 sm:gap-3 ${gridClass(count)}`}>{children}</div>;
}

/**
 * Layout saat ada yang berbagi layar: layar dibuat besar, peserta lain jadi strip kecil
 * (bawah di HP, kanan di desktop).
 */
export function SpotlightLayout({ spotlight, others }: { spotlight: ReactNode; others: ReactNode[] }) {
  return (
    <div className="flex h-full w-full flex-col gap-2 md:flex-row md:gap-3">
      <div className="min-h-0 flex-1">{spotlight}</div>
      {others.length > 0 && (
        <div className="flex h-24 shrink-0 gap-2 overflow-x-auto sm:h-28 md:h-auto md:w-52 md:flex-col md:overflow-y-auto md:overflow-x-hidden lg:w-60">
          {others.map((tile, i) => (
            <div key={isValidElement(tile) && tile.key != null ? tile.key : i} className="aspect-video h-full shrink-0 md:h-auto md:w-full">
              {tile}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
