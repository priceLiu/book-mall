"use client";

import { useState } from "react";
import { Copy, Link2 } from "lucide-react";

import { getBookMallApiBase } from "@/lib/canvas-api";

export function WorkflowShareLinkDialog({
  projectId,
  projectTitle,
  open,
  onClose,
}: {
  projectId: string;
  projectTitle: string;
  open: boolean;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function createLink() {
    setLoading(true);
    setError(null);
    try {
      const base = getBookMallApiBase();
      const r = await fetch(`${base}/api/platform/workflow-share`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app: "CANVAS",
          resourceType: "canvas_project",
          resourceId: projectId,
          title: projectTitle,
        }),
      });
      const data = (await r.json()) as { token?: string; error?: string };
      if (!r.ok || !data.token) throw new Error(data.error ?? "创建失败");
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      setUrl(`${origin}/share/w/${data.token}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-5 shadow-xl">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--canvas-text)]">
          <Link2 className="size-4" />
          分享工作流
        </h2>
        <p className="mt-2 text-xs text-[var(--canvas-muted)]">
          好友打开链接注册/登录后将复制一份画布；好友首次成功生成并首笔订阅或充值后，你将获得积分奖励。
        </p>
        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
        {url ? (
          <div className="mt-4 flex gap-2">
            <input
              readOnly
              value={url}
              className="min-w-0 flex-1 rounded border border-[var(--canvas-border)] bg-black/20 px-2 py-1.5 text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex items-center gap-1 rounded bg-[var(--canvas-accent)] px-3 py-1.5 text-xs text-white"
            >
              <Copy className="size-3.5" />
              {copied ? "已复制" : "复制"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={() => void createLink()}
            className="mt-4 w-full rounded-lg bg-[var(--canvas-accent)] py-2 text-sm text-white disabled:opacity-50"
          >
            {loading ? "生成中…" : "生成分享链接"}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-sm text-[var(--canvas-muted)] hover:text-[var(--canvas-text)]"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
