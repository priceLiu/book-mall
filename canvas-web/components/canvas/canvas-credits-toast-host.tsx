"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastItem = {
  id: number;
  message: string;
  at: number;
};

let nextId = 1;
const listeners = new Set<(item: ToastItem) => void>();

/** 非阻塞积分扣减提示（3s 自动消失） */
export function showCanvasCreditsToast(message: string): void {
  const item = { id: nextId++, message, at: Date.now() };
  for (const fn of listeners) fn(item);
}

export function CanvasCreditsToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onShow = (item: ToastItem) => {
      setItems((prev) => [...prev.slice(-2), item]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== item.id));
      }, 3200);
    };
    listeners.add(onShow);
    return () => {
      listeners.delete(onShow);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[80] flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-center gap-2 rounded-xl border border-amber-400/30 bg-[#1a1a1a]/95 px-3 py-2 text-sm text-amber-100 shadow-lg backdrop-blur",
          )}
        >
          <Zap className="size-4 shrink-0 fill-amber-300/90 text-amber-300/90" />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
