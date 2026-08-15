"use client";

import { Loader2, Trash2, Upload } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AI_SPACE_VIDEO_CATEGORIES,
  AI_SPACE_VIDEO_CATEGORY_LABEL,
  type AiSpaceVideoCategory,
  type AiSpaceVideoLibraryItem,
} from "@/lib/ai-space/ai-space-video-types";

import {
  AiSpaceConfirmDialog,
  type AiSpaceConfirmRequest,
} from "./ai-space-confirm-dialog";

const API = "/api/platform/v1/ai-space/video-materials";

function categoryLabel(category: string): string {
  if (category === "published") return "各应用已发布（作品墙引用）";
  return AI_SPACE_VIDEO_CATEGORY_LABEL[category] ?? category;
}

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return "时长未知";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}分${s.toString().padStart(2, "0")}秒` : `${s.toFixed(0)} 秒`;
}

export function AiSpaceVideoLibrary({
  initialItems,
}: {
  initialItems: AiSpaceVideoLibraryItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<AiSpaceVideoCategory>("upload");
  const [confirmRequest, setConfirmRequest] = useState<AiSpaceConfirmRequest | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onUpload = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("category", uploadCategory);
        const res = await fetch(API, {
          method: "POST",
          body: form,
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as {
          material?: {
            id: string;
            name: string;
            category: string;
            videoUrl: string;
            durationSec: number;
            createdAt: string;
          };
          error?: string;
        };
        if (!res.ok || !data.material) {
          setError(data.error ?? "上传失败");
          return;
        }
        const m = data.material;
        setItems((prev) => [
          {
            origin: "material",
            id: m.id,
            name: m.name,
            category: m.category,
            videoUrl: m.videoUrl,
            thumbnailUrl: null,
            durationSec: m.durationSec,
            createdAt: m.createdAt,
            sourceLabel: null,
          },
          ...prev,
        ]);
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [uploadCategory],
  );

  const patch = useCallback(
    async (id: string, body: { name?: string; category?: AiSpaceVideoCategory }) => {
      setError(null);
      setBusyId(id);
      try {
        const res = await fetch(API, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id, ...body }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "更新失败");
          return;
        }
        setItems((prev) =>
          prev.map((i) => (i.origin === "material" && i.id === id ? { ...i, ...body } : i)),
        );
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const doDelete = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API}?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "删除失败");
        return;
      }
      setItems((prev) => prev.filter((i) => !(i.origin === "material" && i.id === id)));
      setConfirmRequest(null);
    } finally {
      setBusyId(null);
    }
  }, []);

  const askDelete = useCallback(
    async (item: AiSpaceVideoLibraryItem) => {
      setError(null);
      let refs = { composeTaskCount: 0, composeTaskStatuses: [] as string[] };
      try {
        const res = await fetch(`${API}?checkRefsFor=${encodeURIComponent(item.id)}`, {
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as {
          refs?: { composeTaskCount: number; composeTaskStatuses: string[] };
        };
        if (data.refs) refs = data.refs;
      } catch {
        // 引用检测失败不阻断，第二次确认仍会提示不可恢复
      }

      setConfirmRequest({
        title: "删除视频",
        message: (
          <>
            <p>将从视频创作库删除「{item.name}」。</p>
            {refs.composeTaskCount > 0 ? (
              <p>
                该视频已被 <strong>{refs.composeTaskCount}</strong> 个合成任务作为背景引用（
                {refs.composeTaskStatuses.join(" / ")}）。
              </p>
            ) : null}
          </>
        ),
        confirmLabel: "继续",
        onConfirm: () =>
          setConfirmRequest({
            title: "再次确认删除",
            variant: "destructive",
            message: (
              <>
                <p>
                  删除后 <strong>不可恢复</strong>，同时会清理 <strong>云端存储（OSS）</strong> 上的视频文件。
                </p>
                <p>若该视频已展示在作品墙，展示也会一并移除。</p>
              </>
            ),
            confirmLabel: "确认删除",
            onConfirm: () => doDelete(item.id),
          }),
      });
    },
    [doDelete],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, AiSpaceVideoLibraryItem[]>();
    for (const item of items) {
      const list = map.get(item.category);
      if (list) list.push(item);
      else map.set(item.category, [item]);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="rounded-lg border border-[#d0d7de] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1f2328]">上传自拍视频</h2>
        <p className="mt-1 text-xs text-[#656d76]">
          自拍与外部素材存在本库，可作为合成台的背景；各应用已发布的视频经作品墙引用展示，不在此复制。
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-md border border-[#d0d7de] bg-white px-2 text-sm text-[#1f2328]"
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value as AiSpaceVideoCategory)}
          >
            {AI_SPACE_VIDEO_CATEGORIES.filter((c) => c.id !== "compose").map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                上传中…
              </>
            ) : (
              <>
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                选择视频
              </>
            )}
          </Button>
        </div>
      </section>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#d0d7de] bg-[#f6f8fa] p-10 text-center">
          <p className="text-sm font-medium text-[#1f2328]">视频创作库还是空的</p>
          <p className="mt-1 text-sm text-[#656d76]">
            上传自拍视频，或在各应用把视频「展示到 AI 空间」后在这里统一浏览。
          </p>
        </div>
      ) : (
        grouped.map(([category, list]) => (
          <section key={category} className="space-y-3">
            <h2 className="text-sm font-semibold text-[#1f2328]">
              {categoryLabel(category)}
              <span className="ml-2 text-xs font-normal text-[#656d76]">{list.length} 条</span>
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((item) => (
                <li
                  key={`${item.origin}-${item.id}`}
                  className="overflow-hidden rounded-lg border border-[#d0d7de] bg-white"
                >
                  <div className="aspect-video">
                    <video
                      className="h-full w-full bg-black object-contain"
                      controls
                      preload="metadata"
                      poster={item.thumbnailUrl ?? undefined}
                      src={item.videoUrl}
                    />
                  </div>
                  <div className="space-y-2 p-3">
                    {item.origin === "material" ? (
                      <Input
                        className="h-8 text-sm"
                        defaultValue={item.name}
                        disabled={busyId === item.id}
                        onBlur={(e) => {
                          const next = e.target.value.trim();
                          if (next && next !== item.name) void patch(item.id, { name: next });
                        }}
                      />
                    ) : (
                      <p className="truncate text-sm font-medium text-[#1f2328]">{item.name}</p>
                    )}
                    <p className="text-xs text-[#8c959f]">
                      {item.sourceLabel ? `${item.sourceLabel} · ` : ""}
                      {formatDuration(item.durationSec)} ·{" "}
                      {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                    </p>
                    {item.origin === "material" ? (
                      <div className="flex items-center gap-2">
                        <select
                          className="h-8 rounded-md border border-[#d0d7de] bg-white px-2 text-xs text-[#1f2328]"
                          value={item.category}
                          disabled={busyId === item.id}
                          onChange={(e) =>
                            void patch(item.id, {
                              category: e.target.value as AiSpaceVideoCategory,
                            })
                          }
                        >
                          {AI_SPACE_VIDEO_CATEGORIES.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busyId === item.id}
                          onClick={() => void askDelete(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-[#8c959f]">
                        引用项：真源在原应用，如需移除请在作品墙「取消展示」。
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <AiSpaceConfirmDialog
        request={confirmRequest}
        busy={busyId !== null}
        onCancel={() => setConfirmRequest(null)}
      />
    </div>
  );
}
