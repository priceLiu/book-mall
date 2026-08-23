"use client";

import { Check, Copy, Link2 } from "lucide-react";
import { useState } from "react";

import { fetchQrPlatform } from "@/lib/qr-platform-fetch";

function bookMallOriginFromShareUrl(shareUrl: string): string | null {
  try {
    return new URL(shareUrl).origin;
  } catch {
    return null;
  }
}

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
  const [shortCode, setShortCode] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [legacyUrl, setLegacyUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<"code" | "url" | null>(null);

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
    shortCode && shareUrl
      ? `${bookMallOriginFromShareUrl(shareUrl)}/api/platform/share-code/qr?code=${encodeURIComponent(shortCode)}`
      : null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4">
      <div className="qr-modal-shell w-full max-w-md p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--qr-text-primary)]">
          <Link2 className="size-4" />
          分享工作流
        </h2>
        <p className="mt-2 text-xs text-[var(--qr-text-muted)]">
          分享 10 位码或主站链接；好友扫码后在主站领取模板副本。
        </p>
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        {shortCode && shareUrl ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="qr-input font-mono text-sm tracking-widest">{shortCode}</span>
              <button type="button" className="qr-btn-primary shrink-0 px-3" onClick={() => void copy(shortCode, "code")}>
                {copiedField === "code" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copiedField === "code" ? "已复制" : "复制码"}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="qr-input min-w-0 flex-1 text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button type="button" className="qr-btn-primary shrink-0 px-3" onClick={() => void copy(shareUrl, "url")}>
                {copiedField === "url" ? "已复制" : "复制链"}
              </button>
            </div>
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="微信扫码" width={140} height={140} className="mx-auto rounded border border-white/10 p-1" />
            ) : null}
            {legacyUrl ? (
              <details className="text-xs text-[var(--qr-text-muted)]">
                <summary className="cursor-pointer">兼容旧链接</summary>
                <p className="mt-1 break-all font-mono">{legacyUrl}</p>
              </details>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            disabled={loading}
            className="qr-btn-primary mt-4 w-full"
            onClick={() => void createLink()}
          >
            {loading ? "生成中…" : "生成分享码"}
          </button>
        )}
        <button type="button" className="qr-btn-secondary mt-4 w-full" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}
