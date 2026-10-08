"use client";

import { useEffect, useRef } from "react";

/**
 * Menahan tombol Back (browser / gesture Android) selama `enabled`.
 * Satu entri history "penjaga" ditambahkan; saat user menekan Back, entri itu dipasang lagi
 * dan `onBack` dipanggil, jadi halaman tidak benar-benar meninggalkan meeting.
 */
export function useBackGuard(enabled: boolean, onBack: () => void) {
  const callback = useRef(onBack);
  callback.current = onBack;

  useEffect(() => {
    if (!enabled) return;
    const guardState = { ...(window.history.state ?? {}), nongkiGuard: true };
    window.history.pushState(guardState, "");

    const onPopState = () => {
      window.history.pushState(guardState, "");
      callback.current();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [enabled]);
}
