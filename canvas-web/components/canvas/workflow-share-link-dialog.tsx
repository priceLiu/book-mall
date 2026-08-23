"use client";

import { Check, Copy, Link2 } from "lucide-react";
import { useState } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

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
  const [shortCode, setShortCode] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [legacyUrl, setLegacyUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<"code" | "url" | null>(null);
  const bookMallBase = useBookMallBaseUrl();

  async function createLink() {
    if (!bookMallBase) {
      setError("未配置主站地址");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { url, init } = resolveBookMallBrowserRequest(bookMallBase, "/api/platform/workflow-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app: "CANVAS",
          resourceType: "canvas_project",
          resourceId: projectId,
          title: projectTitle,
        }),
      });
      const r = await fetch(url, init);
      const data = (await r.json()) as {
        token?: string;
        shortCode?: string;
        shareUrl?: string;
        error?: string;
      };
      if (!r.ok || !data.shortCode || !data.shareUrl) {
        throw new Error(data.error ?? "创建失败");
      }
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      setShortCode(data.shortCode);
      setShareUrl(data.shareUrl);
      setLegacyUrl(`${origin}/share/w/${data.token}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string, field: "code" | "url") {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  const qrUrl =
    shortCode && bookMallBase
      ? `${bookMallBase.replace(/\/$/, "")}/api/platform/share-code/qr?code=${encodeURIComponent(shortCode)}`
      : null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-5 shadow-xl">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--canvas-text)]">
          <Link2 className="size-4" />
          分享工作流
        </h2>
        <p className="mt-2 text-xs text-[var(--canvas-muted)]">
          分享 10 位码或主站链接；好友扫码后在主站领取画布副本。首次成功生成并首笔订阅或充值后，你将获得积分奖励。
        </p>
        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
        {shortCode && shareUrl ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="rounded border border-[var(--canvas-border)] bg-black/20 px-3 py-1.5 font-mono text-sm tracking-widest">
                {shortCode}
              </span>
              <button
                type="button"
                onClick={() => void copy(shortCode, "code")}
                className="inline-flex items-center gap-1 rounded bg-[var(--canvas-accent)] px-3 py-1.5 text-xs text-white"
              >
                {copiedField === "code" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copiedField === "code" ? "已复制" : "复制码"}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="min-w-0 flex-1 rounded border border-[var(--canvas-border)] bg-black/20 px-2 py-1.5 text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                onClick={() => void copy(shareUrl, "url")}
                className="inline-flex items-center gap-1 rounded bg-[var(--canvas-accent)] px-3 py-1.5 text-xs text-white"
              >
                {copiedField === "url" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copiedField === "url" ? "已复制" : "复制链"}
              </button>
            </div>
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="微信扫码" width={140} height={140} className="mx-auto rounded border border-[var(--canvas-border)] bg-white p-1" />
            ) : null}
            {legacyUrl ? (
              <details className="text-xs text-[var(--canvas-muted)]">
                <summary className="cursor-pointer">兼容旧链接</summary>
                <p className="mt-1 break-all font-mono">{legacyUrl}</p>
              </details>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={() => void createLink()}
            className="mt-4 w-full rounded-lg bg-[var(--canvas-accent)] py-2 text-sm text-white disabled:opacity-50"
          >
            {loading ? "生成中…" : "生成分享码"}
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
