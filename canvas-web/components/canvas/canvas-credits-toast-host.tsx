"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type CanvasToastKind = "credits" | "success";

type ToastItem = {
  id: number;
  message: string;
  at: number;
  kind: CanvasToastKind;
};

let nextId = 1;
const listeners = new Set<(item: ToastItem) => void>();

function emitCanvasToast(message: string, kind: CanvasToastKind): void {
  const item = { id: nextId++, message, at: Date.now(), kind };
  for (const fn of listeners) fn(item);
}

/** 非阻塞积分扣减提示（3s 自动消失） */
export function showCanvasCreditsToast(message: string): void {
  emitCanvasToast(message, "credits");
}

/** 非阻塞操作成功提示（3s 自动消失） */
export function showCanvasSuccessToast(message: string): void {
  emitCanvasToast(message, "success");
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
    <div className="pointer-events-none fixed bottom-6 right-6 z-[10050] flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-center gap-2 rounded-xl border bg-[#1a1a1a]/97 px-3 py-2 text-sm shadow-lg",
            t.kind === "success"
              ? "border-violet-400/35 text-violet-50"
              : "border-yellow-400/30 text-yellow-300",
          )}
        >
          {t.kind === "success" ? (
            <CheckCircle2 className="size-4 shrink-0 text-violet-300/90" />
          ) : null}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
