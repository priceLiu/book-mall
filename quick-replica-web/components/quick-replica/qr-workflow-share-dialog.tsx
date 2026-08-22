"use client";

import { Copy, Link2 } from "lucide-react";
import { useState } from "react";

import { fetchQrPlatform } from "@/lib/qr-platform-fetch";

export function QrWorkflowShareDialog({
  templateId,
  templateTitle,
  open,
  onClose,
}: {
  templateId: string;
  templateTitle: string;
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
      const r = await fetchQrPlatform("/api/book-mall/api/platform/workflow-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app: "QUICK_REPLICA",
          resourceType: "qr_template",
          resourceId: templateId,
          title: templateTitle,
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
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4">
      <div className="qr-modal-shell w-full max-w-md p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--qr-text-primary)]">
          <Link2 className="size-4" />
          分享工作流
        </h2>
        <p className="mt-2 text-xs text-[var(--qr-text-muted)]">
          好友打开链接后将复制一份模板；好友首次成功生成并首笔订阅或充值后，你将获得积分奖励。
        </p>
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        {url ? (
          <div className="mt-4 flex gap-2">
            <input
              readOnly
              value={url}
              className="qr-input min-w-0 flex-1 text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button type="button" className="qr-btn-primary shrink-0 px-3" onClick={() => void copy()}>
              <Copy className="size-3.5" />
              {copied ? "已复制" : "复制"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={loading}
            className="qr-btn-primary mt-4 w-full"
            onClick={() => void createLink()}
          >
            {loading ? "生成中…" : "生成分享链接"}
          </button>
        )}
        <button type="button" className="qr-btn-secondary mt-4 w-full" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}
