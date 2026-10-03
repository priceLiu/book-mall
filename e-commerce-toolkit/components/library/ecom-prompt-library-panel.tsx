"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, Search } from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomImagePreviewHost, useEcomImagePreview } from "@/components/media";
import { EcomMediaLibraryTile } from "@/components/media/ecom-media-library-tile";
import { EcomMediaSkeletonGrid } from "@/components/media/ecom-media-skeleton";
import { EcomVideoPreviewDialog } from "@/components/media/ecom-video-preview-dialog";
import { buildEcomOssThumbUrl } from "@/lib/ecom-oss-image-url";
import {
  listPromptLibrary,
  promptLibraryModuleLabel,
  type EcomPromptLibraryItem,
} from "@/lib/ecom-prompt-library-api";

type KindTab = "all" | "image" | "video";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EcomPromptLibraryPageHeader() {
  return (
    <header className="flex shrink-0 flex-col gap-2 border-b border-[#e8e8ed] bg-white px-4 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        <Link
          href="/library"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-[#6e6e73] hover:bg-[#f5f5f7]"
          aria-label="返回我的资产"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-[#1d1d1f]">提示词库</h1>
          <p className="text-xs text-[#6e6e73]">
            每条成图/成片对应一条完整提示词，便于检索与复用
          </p>
        </div>
      </div>
    </header>
  );
}

export function EcomPromptLibraryPanel() {
  const { toast } = useDialogs();
  const [kind, setKind] = useState<KindTab>("all");
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [items, setItems] = useState<EcomPromptLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<{ src: string; title: string } | null>(
    null,
  );
  const { preview, openPreview, closePreview } = useEcomImagePreview();

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listPromptLibrary({
        kind: kind === "all" ? "all" : kind,
        q: debouncedQ || undefined,
      });
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [kind, debouncedQ]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const image = items.filter((i) => i.kind === "image").length;
    const video = items.filter((i) => i.kind === "video").length;
    return { all: items.length, image, video };
  }, [items]);

  async function copyPrompt(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "已复制", message: "提示词已复制到剪贴板", variant: "success" });
    } catch {
      toast({ title: "复制失败", message: "请手动选择文本复制", variant: "error" });
    }
  }

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 border-b border-[#e8e8ed] bg-white/95 px-4 pb-3 pt-1 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "all" as const, label: "全部" },
              { id: "image" as const, label: "图片" },
              { id: "video" as const, label: "视频" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                kind === tab.id
                  ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                  : "border-[#e8e8ed] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]"
              }`}
              onClick={() => setKind(tab.id)}
            >
              {tab.label}
              {!loading && counts[tab.id] > 0 ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    kind === tab.id ? "bg-white/20" : "bg-[#f5f5f7] text-[#6e6e73]"
                  }`}
                >
                  {counts[tab.id]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <label className="relative mt-3 flex items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-[#86868b]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索提示词或标题…"
            className="h-9 w-full rounded-lg border border-[#e8e8ed] bg-[#f5f5f7] pl-9 pr-3 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:border-[#0071e3] focus:bg-white focus:outline-none"
          />
        </label>
      </div>

      {loading ? (
        <EcomMediaSkeletonGrid count={6} gridClass="mt-6 grid gap-4 sm:grid-cols-1" />
      ) : error ? (
        <p className="mt-6 text-sm text-red-600">{error}</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-[#6e6e73]">
          暂无带提示词的成图/成片。在各模块成功出图后会自动收录（需入库时写入 prompt）。
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {items.map((item) => {
            const thumb = item.thumbnailUrl?.trim() || item.ossUrl;
            const expanded = expandedId === item.id;
            const title = item.title?.trim() || item.projectName?.trim() || "未命名";
            return (
              <li
                key={item.id}
                className="overflow-hidden rounded-xl border border-[#e8e8ed] bg-white shadow-sm"
              >
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:gap-4">
                  <div className="w-full shrink-0 sm:w-[120px]">
                    <EcomMediaLibraryTile
                      kind={item.kind}
                      src={thumb}
                      alt={title}
                      onPreview={() =>
                        item.kind === "video"
                          ? setPreviewVideo({ src: item.ossUrl, title })
                          : openPreview(buildEcomOssThumbUrl(thumb), title)
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-[#1d1d1f]">{title}</p>
                      <span className="rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[10px] text-[#6e6e73]">
                        {promptLibraryModuleLabel(item.module)}
                      </span>
                      {item.modelKey ? (
                        <span className="text-[10px] text-[#86868b]">{item.modelKey}</span>
                      ) : null}
                      <span className="text-[10px] text-[#86868b]">{formatWhen(item.createdAt)}</span>
                    </div>
                    <p
                      className={`mt-2 whitespace-pre-wrap font-mono text-xs leading-relaxed text-[#1d1d1f] ${
                        expanded ? "" : "line-clamp-4"
                      }`}
                    >
                      {item.prompt}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e8e8ed] bg-white px-3 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
                        onClick={() => void copyPrompt(item.prompt)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        复制提示词
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 items-center rounded-full border border-transparent px-3 text-xs font-medium text-[#0071e3] hover:bg-[#f0f6ff]"
                        onClick={() => setExpandedId(expanded ? null : item.id)}
                      >
                        {expanded ? "收起" : "展开全文"}
                      </button>
                      <Link
                        href="/library"
                        className="inline-flex h-8 items-center rounded-full px-3 text-xs font-medium text-[#6e6e73] hover:text-[#0071e3]"
                      >
                        在成图与视频中查看
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <EcomImagePreviewHost preview={preview} onClose={closePreview} />
      {previewVideo ? (
        <EcomVideoPreviewDialog
          open
          src={previewVideo.src}
          title={previewVideo.title}
          onOpenChange={(open) => {
            if (!open) setPreviewVideo(null);
          }}
        />
      ) : null}
    </>
  );
}
