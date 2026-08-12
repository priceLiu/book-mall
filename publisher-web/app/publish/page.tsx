"use client";

import { useCallback, useState } from "react";
import {
  dispatchPublishToExtension,
  PUBLISHER_PLATFORMS,
  PLATFORM_LABELS,
  type PublisherPlatform,
} from "@private/publisher-client";

async function pubFetch(path: string, init?: RequestInit) {
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

export default function PublishPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [platforms, setPlatforms] = useState<PublisherPlatform[]>([...PUBLISHER_PLATFORMS]);
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
      const job = (await pubFetch("sso/tools/publisher/jobs", {
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
        payload: { title, content },
      });
      setStatus(`任务 ${job.jobId} 已派发给扩展，请确认扩展已安装并已登录。`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "发布失败");
    } finally {
      setLoading(false);
    }
  }, [content, platforms, title]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-xl font-semibold">新建发布</h1>
      <div className="space-y-4 rounded-2xl border bg-white p-6">
        <input
          className="w-full rounded-xl border px-3 py-2 text-sm"
          placeholder="标题（可选）"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="min-h-[160px] w-full rounded-xl border px-3 py-2 text-sm"
          placeholder="正文"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {PUBLISHER_PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              className={`rounded-lg border px-3 py-1 text-sm ${
                platforms.includes(p) ? "border-[var(--pub-primary)] bg-blue-50" : ""
              }`}
              onClick={() => toggle(p)}
            >
              {PLATFORM_LABELS[p]}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={loading || !content.trim() || platforms.length === 0}
          className="rounded-xl bg-[var(--pub-primary)] px-4 py-2 text-sm text-white disabled:opacity-50"
          onClick={() => void onPublish()}
        >
          {loading ? "提交中…" : "派发给扩展发布"}
        </button>
        {status ? <p className="text-sm text-[var(--pub-muted)]">{status}</p> : null}
      </div>
    </main>
  );
}
