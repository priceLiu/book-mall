"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import { EcomDialogCloseButton } from "@/components/ui/dialog";
import { EcomWechatShareIcon } from "@/components/ui/ecom-wechat-share-icon";

function bookMallOriginFromShareUrl(shareUrl: string): string | null {
  try {
    return new URL(shareUrl).origin;
  } catch {
    return null;
  }
}

export function WorkflowShareLinkDialog({
  projectId,
  projectTitle,
  open,
  onClose,
  resourceType = "ecom_storyboard_project",
  description,
}: {
  projectId: string;
  projectTitle: string;
  open: boolean;
  onClose: () => void;
  resourceType?: string;
  description?: string;
}) {
  const [shortCode, setShortCode] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [legacyUrl, setLegacyUrl] = useState<string | null>(null);
  const [teamMemberShare, setTeamMemberShare] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<"code" | "url" | null>(null);

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
          resourceType,
          resourceId: projectId,
          title: projectTitle,
        }),
      });
      const data = (await r.json()) as {
        token?: string;
        shortCode?: string;
        shareUrl?: string;
        teamMemberShare?: boolean;
        error?: string;
      };
      if (!r.ok || !data.shortCode || !data.shareUrl) {
        throw new Error(data.error ?? "创建失败");
      }
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      setShortCode(data.shortCode);
      setShareUrl(data.shareUrl);
      setTeamMemberShare(Boolean(data.teamMemberShare));
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
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-md rounded-xl border border-[#e8e8ed] bg-white p-5 pr-12 shadow-xl">
        <EcomDialogCloseButton onClick={onClose} />
        <h2 className="flex items-center gap-2 text-base font-semibold text-[#1d1d1f]">
          <EcomWechatShareIcon className="size-4" />
          {teamMemberShare ? "邀请成员体验" : "分享工作流"}
        </h2>
        <p className="mt-2 text-xs text-[#6e6e73]">
          {description ??
            (teamMemberShare
              ? "分享 10 位码或主站链接；好友领取副本后将加入你的团队（不发分享积分）。"
              : "分享 10 位码或主站链接；好友扫码后在主站领取分镜副本。首次成功生成并首笔付费后，你将获得积分奖励。")}
        </p>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {shortCode && shareUrl ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="rounded border border-[#d9d9d9] px-3 py-1.5 font-mono text-sm tracking-widest">
                {shortCode}
              </span>
              <EcomButtonPrimary size="sm" type="button" onClick={() => void copy(shortCode, "code")}>
                {copiedField === "code" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copiedField === "code" ? "已复制" : "复制码"}
              </EcomButtonPrimary>
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="min-w-0 flex-1 rounded border border-[#d9d9d9] px-2 py-1.5 text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <EcomButtonPrimary size="sm" type="button" onClick={() => void copy(shareUrl, "url")}>
                {copiedField === "url" ? "已复制" : "复制链"}
              </EcomButtonPrimary>
            </div>
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="微信扫码" width={140} height={140} className="mx-auto rounded border border-[#d9d9d9] p-1" />
            ) : null}
            {legacyUrl ? (
              <details className="text-xs text-[#6e6e73]">
                <summary className="cursor-pointer">兼容旧链接</summary>
                <p className="mt-1 break-all font-mono">{legacyUrl}</p>
              </details>
            ) : null}
          </div>
        ) : (
          <EcomButtonPrimary
            type="button"
            disabled={loading}
            className="mt-4 w-full"
            onClick={() => void createLink()}
          >
            {loading ? "生成中…" : "生成分享码"}
          </EcomButtonPrimary>
        )}
      </div>
    </div>
  );
}
