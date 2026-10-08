"use client";

import { useEffect, useRef } from "react";

export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  cancelLabel = "Batal",
  onConfirm,
  onCancel,
}: {
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/70 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm rounded-2xl bg-ink-900 p-5 ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-lg font-bold">
          {title}
        </h2>
        <p className="mt-1 text-sm text-white/60">{text}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="h-10 rounded-xl px-4 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-10 rounded-xl bg-danger px-4 text-sm font-semibold text-white hover:bg-danger-dark"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
