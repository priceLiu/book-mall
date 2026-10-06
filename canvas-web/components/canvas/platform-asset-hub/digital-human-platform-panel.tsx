"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  listAiSpaceDigitalHumans,
  type CanvasAiSpaceDigitalHuman,
} from "@/lib/canvas-ai-space";

export function DigitalHumanPlatformPanel() {
  const base = useBookMallBaseUrl();
  const [items, setItems] = useState<CanvasAiSpaceDigitalHuman[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!base?.trim()) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const list = await listAiSpaceDigitalHumans(base);
        if (!cancelled) setItems(list);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "加载失败");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [base]);

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 py-16 text-white/50">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">加载平台数字人…</span>
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-8 text-center text-sm text-rose-300/90">{error}</p>
    );
  }

  if (!items.length) {
    return (
      <p className="py-8 text-center text-sm text-white/45">
        暂无平台数字人形象。请在 book-mall AI 空间配置后刷新。
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {items.map((item) => (
        <li
          key={item.id}
          className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
        >
          <div className="relative aspect-[3/4] bg-black/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.avatarImageUrl}
              alt={item.name}
              className="size-full object-cover"
            />
          </div>
          <p className="truncate px-2 py-2 text-xs text-white">{item.name}</p>
        </li>
      ))}
    </ul>
  );
}
