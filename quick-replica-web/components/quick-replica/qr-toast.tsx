"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

type Props = {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
};

export function QrToast({ message, onDismiss, durationMs = 2400 }: Props) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss, durationMs]);

  if (!message || typeof document === "undefined") return null;

  return createPortal(
    <div className="qr-toast" role="status" aria-live="polite">
      <Check className="h-4 w-4 shrink-0 text-[var(--qr-brand)]" aria-hidden />
      <span>{message}</span>
    </div>,
    document.body,
  );
}
