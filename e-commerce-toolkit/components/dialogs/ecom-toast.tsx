"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type ToastOpts = {
  title: string;
  message?: string;
  variant?: "default" | "success" | "error";
  /** @default 6000 */
  durationMs?: number;
};

type ToastItem = ToastOpts & { id: number };

const DEFAULT_DURATION_MS = 6000;

export function useEcomToastQueue() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((opts: ToastOpts) => {
    const id = nextIdRef.current;
    nextIdRef.current += 1;
    setToasts((prev) => [
      ...prev,
      {
        id,
        title: opts.title,
        message: opts.message,
        variant: opts.variant ?? "default",
        durationMs: opts.durationMs ?? DEFAULT_DURATION_MS,
      },
    ]);
  }, []);

  return { toasts, toast, dismiss };
}

export function EcomToastHost({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[400] flex max-w-[min(100vw-2rem,22rem)] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((item) => (
        <EcomToastCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function EcomToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.id), item.durationMs);
    return () => window.clearTimeout(timer);
  }, [item.durationMs, item.id, onDismiss]);

  const borderClass =
    item.variant === "error"
      ? "border-red-200"
      : item.variant === "success"
        ? "border-emerald-200"
        : "border-[var(--ecom-hairline)]";

  return (
    <div
      className={`pointer-events-auto rounded-xl border bg-white p-4 shadow-lg ${borderClass}`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--ecom-ink)]">{item.title}</p>
          {item.message ? (
            <p className="mt-1 text-xs leading-relaxed text-[var(--ecom-muted)]">
              {item.message}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(item.id)}
          className="shrink-0 rounded p-0.5 text-[var(--ecom-muted)] hover:text-[var(--ecom-ink)]"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
