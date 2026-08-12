"use client";

import { useCallback, useState } from "react";
import {
  dispatchPublishToExtension,
  PUBLISHER_PLATFORMS,
  PLATFORM_LABELS,
  type PublisherPlatform,
} from "@private/publisher-client";

async function ecomPublisherFetch(path: string, init?: RequestInit) {
  const res = await fetch(`/api/book-mall/${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `请求失败 (${res.status})`);
  }
  return data;
}

type Props = {
  title?: string;
  content: string;
  images?: string[];
  triggerLabel?: string;
};

export function EcomPublishDialog({
  title: initialTitle = "",
  content,
  images,
  triggerLabel = "一键发布",
}: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [platforms, setPlatforms] = useState<PublisherPlatform[]>(["xiaohongshu", "douyin"]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = (p: PublisherPlatform) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const onPublish = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const job = (await ecomPublisherFetch("sso/tools/publisher/jobs", {
        method: "POST",
        body: JSON.stringify({ platforms }),
      })) as {
        jobId: string;
        jobTicket: string;
        userId: string;
        platforms: PublisherPlatform[];
      };

      dispatchPublishToExtension({
        jobTicket: job.jobTicket,
        userId: job.userId,
        platforms: job.platforms,
        payload: { title, content, images },
      });
      setStatus(`任务 ${job.jobId} 已派发给浏览器扩展。`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "发布失败");
    } finally {
      setLoading(false);
    }
  }, [content, images, platforms, title]);

  if (!open) {
    return (
      <button
        type="button"
        className="rounded-lg border border-[var(--ecom-hairline)] px-3 py-1.5 text-xs text-[var(--ecom-ink)] hover:bg-black/[0.03]"
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="mb-3 text-base font-semibold text-[var(--ecom-ink)]">一键发布到社交平台</h3>
        <input
          className="mb-2 w-full rounded-xl border px-3 py-2 text-sm"
          placeholder="标题（可选）"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <p className="mb-2 line-clamp-4 rounded-xl bg-[#f5f5f7] p-3 text-xs text-[var(--ecom-muted)]">
          {content}
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {PUBLISHER_PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              className={`rounded-lg border px-2 py-1 text-xs ${
                platforms.includes(p) ? "border-[var(--ecom-primary)] bg-blue-50" : ""
              }`}
              onClick={() => toggle(p)}
            >
              {PLATFORM_LABELS[p]}
            </button>
          ))}
        </div>
        {status ? <p className="mb-2 text-xs text-[var(--ecom-muted)]">{status}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded-lg px-3 py-1.5 text-sm" onClick={() => setOpen(false)}>
            关闭
          </button>
          <button
            type="button"
            disabled={loading || platforms.length === 0}
            className="rounded-lg bg-[var(--ecom-primary)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
            onClick={() => void onPublish()}
          >
            {loading ? "提交中…" : "派发给扩展"}
          </button>
        </div>
      </div>
    </div>
  );
}
