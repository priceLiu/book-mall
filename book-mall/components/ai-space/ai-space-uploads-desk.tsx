"use client";

import { Film, ImageIcon, Loader2, Music } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AiSpaceAudioControls } from "@/components/ai-space/ai-space-audio-controls";
import { Button } from "@/components/ui/button";
import type {
  AiSpaceUploadItem,
  AiSpaceUploadKind,
} from "@/lib/ai-space/ai-space-uploads-service";
import { cn } from "@/lib/utils";

const API = "/api/platform/v1/ai-space/uploads";

const KIND_FILTERS: { value: AiSpaceUploadKind | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "audio", label: "音频" },
  { value: "video", label: "视频" },
  { value: "image", label: "图片" },
];

const KIND_ICON: Record<AiSpaceUploadKind, typeof Music> = {
  audio: Music,
  video: Film,
  image: ImageIcon,
};

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}分${s.toString().padStart(2, "0")}秒` : `${s.toFixed(0)} 秒`;
}

function UploadPreview({ item }: { item: AiSpaceUploadItem }) {
  if (item.kind === "audio") {
    return (
      <div className="flex h-full w-full items-center bg-[#f6f8fa] px-3">
        <AiSpaceAudioControls className="w-full" src={item.mediaUrl} />
      </div>
    );
  }
  if (item.kind === "video") {
    return (
      <video
        className="h-full w-full object-contain"
        src={item.mediaUrl}
        preload="metadata"
        controls
        playsInline
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.thumbnailUrl ?? item.mediaUrl}
      alt={item.name}
      className="h-full w-full object-contain"
      loading="lazy"
    />
  );
}

export function AiSpaceUploadsDesk() {
  const [items, setItems] = useState<AiSpaceUploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<AiSpaceUploadKind | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API, { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as {
        items?: AiSpaceUploadItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "读取失败");
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => (kind === "all" ? items : items.filter((i) => i.kind === kind)),
    [items, kind],
  );

  const counts = useMemo(() => {
    const c = { all: items.length, audio: 0, video: 0, image: 0 };
    for (const i of items) c[i.kind] += 1;
    return c;
  }, [items]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#d0d7de] bg-white p-6 text-sm text-[#656d76]">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在加载上传素材…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[#d0d7de] bg-white p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void load()}>
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {KIND_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setKind(f.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition",
              kind === f.value
                ? "bg-[#1f2328] text-white"
                : "border border-[#d0d7de] bg-white text-[#656d76] hover:text-[#1f2328]",
            )}
          >
            {f.label}
            {counts[f.value] > 0 ? ` (${counts[f.value]})` : ""}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#d0d7de] bg-white p-10 text-center">
          <p className="text-sm font-medium text-[#1f2328]">还没有本地上传的素材</p>
          <p className="mt-2 text-sm text-[#656d76]">
            本地上传的视频/形象，以及快速复制声音克隆的<strong className="font-medium text-[#1f2328]">试听音频</strong>
            （克隆时那段台词的示范朗读，不是音色本身）。TTS 与合成成片不在此列表。
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/account/ai-space?tab=audio">去上传音频</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/account/ai-space?tab=videos">去上传视频</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/account/ai-space?tab=digital-humans">去上传形象</Link>
            </Button>
          </div>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <li
                key={`${item.kind}-${item.id}`}
                className="overflow-hidden rounded-lg border border-[#d0d7de] bg-white"
              >
                <div className="relative aspect-video overflow-hidden bg-[#0d1117]">
                  <div className="absolute inset-0">
                    <UploadPreview item={item} />
                  </div>
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
                    <Icon className="h-3 w-3" aria-hidden />
                    {item.kind === "audio" ? "音频" : item.kind === "video" ? "视频" : "图片"}
                  </span>
                </div>
                <div className="space-y-1 p-3">
                  <p className="truncate text-sm font-medium text-[#1f2328]" title={item.name}>
                    {item.name}
                  </p>
                  <p className="text-xs text-[#8c959f]">
                    {item.subtitle}
                    {item.durationSec ? ` · ${formatDuration(item.durationSec)}` : ""} ·{" "}
                    {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                  </p>
                  <Link
                    href={item.manageHref}
                    className="inline-block text-xs text-[#0969da] hover:underline"
                  >
                    在源库中管理
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
