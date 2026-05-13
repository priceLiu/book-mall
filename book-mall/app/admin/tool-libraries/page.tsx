"use client";

import { useCallback, useEffect, useState } from "react";
import {
  confirmDestructiveTwice,
  CONFIRM_DELETE_LIBRARY_OSS_SECOND_ZH,
} from "@/lib/confirm-destructive-twice";

type AdminVideoRow = {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  videoUrl: string;
  prompt: string | null;
  mode: string;
  resolution: string;
  durationSec: number;
  seed: string | null;
  modelLabel: string | null;
  retainUntil: string;
  createdAt: string;
};

type AdminImageRow = {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  imageUrl: string;
  prompt: string | null;
  createdAt: string;
};

export default function AdminToolLibrariesPage() {
  const [tab, setTab] = useState<"video" | "image">("video");
  const [videos, setVideos] = useState<AdminVideoRow[]>([]);
  const [images, setImages] = useState<AdminImageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadVideos = useCallback(async () => {
    const r = await fetch("/api/admin/tool-libraries/videos", { cache: "no-store" });
    const data = (await r.json()) as { items?: AdminVideoRow[]; error?: string };
    if (!r.ok) throw new Error(data.error ?? "加载视频库失败");
    setVideos(Array.isArray(data.items) ? data.items : []);
  }, []);

  const loadImages = useCallback(async () => {
    const r = await fetch("/api/admin/tool-libraries/images", { cache: "no-store" });
    const data = (await r.json()) as { items?: AdminImageRow[]; error?: string };
    if (!r.ok) throw new Error(data.error ?? "加载图片库失败");
    setImages(Array.isArray(data.items) ? data.items : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadVideos(), loadImages()]);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadVideos, loadImages]);

  async function deleteVideo(id: string) {
    if (
      !confirmDestructiveTwice(
        "确定删除该条视频库记录？将删除数据库条目，并尝试删除可识别的 OSS 对象。",
        CONFIRM_DELETE_LIBRARY_OSS_SECOND_ZH,
      )
    )
      return;
    setBusyId(id);
    try {
      const r = await fetch(
        `/api/admin/tool-libraries/videos?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!r.ok) throw new Error("删除失败");
      setVideos((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteImage(id: string) {
    if (
      !confirmDestructiveTwice(
        "确定删除该条图片库记录？将删除数据库条目，并尝试删除可识别的 OSS 对象。",
        CONFIRM_DELETE_LIBRARY_OSS_SECOND_ZH,
      )
    )
      return;
    setBusyId(id);
    try {
      const r = await fetch(
        `/api/admin/tool-libraries/images?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!r.ok) throw new Error("删除失败");
      setImages((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">工具资源库</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          用户「我的视频库 / 我的图片库」入库记录。删除时会尝试解析 URL 并删除当前环境配置的 Bucket 内对象（与 tool-web 上传所用 OSS
          环境变量一致：<code className="rounded bg-muted px-1">OSS_*</code>、可选{" "}
          <code className="rounded bg-muted px-1">OSS_PUBLIC_URL_BASE</code>
          ）。无法识别为当前 Bucket 公网地址的链接将仅删除数据库记录。
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-sm font-medium transition ${
           tab === "video"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
          onClick={() => setTab("video")}
        >
          视频库 ({videos.length})
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-sm font-medium transition ${
            tab === "image"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
          onClick={() => setTab("image")}
        >
          图片库 ({images.length})
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : tab === "video" ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-3 py-2 font-medium">时间</th>
                <th className="px-3 py-2 font-medium">用户</th>
                <th className="px-3 py-2 font-medium">模式</th>
                <th className="px-3 py-2 font-medium">提示词摘要</th>
                <th className="px-3 py-2 font-medium">建议保留至</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.id} className="border-b border-border/80 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                    {v.createdAt.slice(0, 19).replace("T", " ")}
                  </td>
                  <td className="max-w-[180px] px-3 py-2">
                    <div className="truncate text-xs" title={v.userEmail ?? v.userId}>
                      {v.userEmail ?? v.userId}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    {v.mode} · {v.durationSec}s · {v.resolution}
                  </td>
                  <td className="max-w-[280px] px-3 py-2">
                    <div className="line-clamp-2 text-xs text-muted-foreground" title={v.prompt ?? ""}>
                      {v.prompt ?? "—"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-muted-foreground">
                    {v.retainUntil.slice(0, 10)}
                  </td>
                  <td className="space-x-2 whitespace-nowrap px-3 py-2">
                    <a
                      className="text-primary underline"
                      href={v.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      打开
                    </a>
                    <button
                      type="button"
                      className="text-destructive underline disabled:opacity-50"
                      disabled={busyId === v.id}
                      onClick={() => void deleteVideo(v.id)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {videos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    暂无记录
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-3 py-2 font-medium">时间</th>
                <th className="px-3 py-2 font-medium">用户</th>
                <th className="px-3 py-2 font-medium">提示词摘要</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {images.map((im) => (
                <tr key={im.id} className="border-b border-border/80 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                    {im.createdAt.slice(0, 19).replace("T", " ")}
                  </td>
                  <td className="max-w-[200px] px-3 py-2">
                    <div className="truncate text-xs" title={im.userEmail ?? im.userId}>
                      {im.userEmail ?? im.userId}
                    </div>
                  </td>
                  <td className="max-w-[360px] px-3 py-2">
                    <div className="line-clamp-2 text-xs text-muted-foreground" title={im.prompt ?? ""}>
                      {im.prompt ?? "—"}
                    </div>
                  </td>
                  <td className="space-x-2 whitespace-nowrap px-3 py-2">
                    <a
                      className="text-primary underline"
                      href={im.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      打开
                    </a>
                    <button
                      type="button"
                      className="text-destructive underline disabled:opacity-50"
                      disabled={busyId === im.id}
                      onClick={() => void deleteImage(im.id)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {images.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    暂无记录
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
