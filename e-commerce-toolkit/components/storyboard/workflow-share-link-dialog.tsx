"use client";

import { Copy, Link2 } from "lucide-react";
import { useState } from "react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";

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
      const r = await fetch("/api/book-mall/api/platform/workflow-share", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app: "ECOM",
          resourceType: "ecom_storyboard_project",
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
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-[#e8e8ed] bg-white p-5 shadow-xl">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[#1d1d1f]">
          <Link2 className="size-4" />
          分享工作流
        </h2>
        <p className="mt-2 text-xs text-[#6e6e73]">
          好友打开链接后将复制一份分镜项目；好友首次成功生成并首笔订阅或充值后，你将获得积分奖励。
        </p>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {url ? (
          <div className="mt-4 flex gap-2">
            <input
              readOnly
              value={url}
              className="min-w-0 flex-1 rounded border border-[#d9d9d9] px-2 py-1.5 text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <EcomButtonPrimary size="sm" type="button" onClick={() => void copy()}>
              <Copy className="size-3.5" />
              {copied ? "已复制" : "复制"}
            </EcomButtonPrimary>
          </div>
        ) : (
          <EcomButtonPrimary
            type="button"
            disabled={loading}
            className="mt-4 w-full"
            onClick={() => void createLink()}
          >
            {loading ? "生成中…" : "生成分享链接"}
          </EcomButtonPrimary>
        )}
        <EcomButtonSecondary type="button" className="mt-4 w-full" onClick={onClose}>
          关闭
        </EcomButtonSecondary>
      </div>
    </div>
  );
}
