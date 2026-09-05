"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function ShareCodeBundle({
  code,
  shareUrl,
  qrUrl,
  legacyUrl,
  codeLabel = "分享码",
}: {
  code: string;
  shareUrl: string;
  qrUrl: string;
  legacyUrl?: string;
  codeLabel?: string;
}) {
  const [copiedField, setCopiedField] = useState<"code" | "url" | null>(null);

  async function copy(text: string, field: "code" | "url") {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs font-medium text-[#656d76]">{codeLabel}</p>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-[#f6f8fa] px-4 py-2 font-mono text-xl font-semibold tracking-[0.2em] text-[#1f2328]">
            {code}
          </span>
          <button
            type="button"
            onClick={() => void copy(code, "code")}
            className="inline-flex items-center gap-1 rounded-lg border border-[#d0d7de] px-3 py-2 text-xs text-[#1f2328] hover:bg-[#f6f8fa]"
          >
            {copiedField === "code" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copiedField === "code" ? "已复制" : "复制码"}
          </button>
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-[#656d76]">分享链接</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={shareUrl}
            className="min-w-0 flex-1 rounded-lg border border-[#d0d7de] bg-[#f6f8fa] px-3 py-2 text-sm text-[#1f2328]"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            onClick={() => void copy(shareUrl, "url")}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#8957e5] px-4 py-2 text-sm font-medium text-white hover:bg-[#7c4fd6]"
          >
            {copiedField === "url" ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copiedField === "url" ? "已复制" : "复制链接"}
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrUrl}
          alt="微信扫码分享"
          width={160}
          height={160}
          className="rounded-lg border border-[#d0d7de] bg-white p-2"
        />
        <p className="max-w-xs text-xs text-[#656d76]">
          微信扫一扫打开链接；邀请码将引导好友注册，工作流码将复制一份项目/模板。
        </p>
      </div>

      {legacyUrl ? (
        <details className="text-xs text-[#656d76]">
          <summary className="cursor-pointer hover:text-[#1f2328]">兼容旧链接</summary>
          <p className="mt-1 break-all font-mono">{legacyUrl}</p>
        </details>
      ) : null}
    </div>
  );
}
