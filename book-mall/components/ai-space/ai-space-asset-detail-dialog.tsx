"use client";

/**
 * 资产库详情弹层：看原图 / 播放、复制提示词、收进空间、回源应用继续创作。
 *
 * 只有点开详情才加载原始媒体（列表里一律缩略图），避免翻页就把视频拉满带宽。
 */

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { AiSpaceLibraryAsset } from "@/lib/ai-space/ai-space-asset-library";
import { launchHref } from "@/lib/ai-space/ai-space-launch";

import { AiSpaceOverlay } from "./ai-space-overlay";

export function AiSpaceAssetDetailDialog({
  asset,
  busy,
  onTogglePin,
  onClose,
}: {
  asset: AiSpaceLibraryAsset;
  busy: boolean;
  onTogglePin: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const { resolved } = asset;
  const href = resolved.launch ? launchHref(resolved.launch) : null;

  const copyPrompt = async () => {
    if (!resolved.prompt) return;
    try {
      await navigator.clipboard.writeText(resolved.prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板被浏览器策略拒绝时静默：用户仍可手选文本
    }
  };

  return (
    <AiSpaceOverlay
      label={resolved.title ?? "资产详情"}
      onClose={onClose}
      backdropClassName="bg-black/50"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg border border-[#d0d7de] bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-[#eaeef2] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#1f2328]">
              {resolved.title ?? "未命名资产"}
            </p>
            <p className="truncate text-xs text-[#8c959f]">
              {asset.sourceLabel}
              {resolved.moduleLabel ? ` · ${resolved.moduleLabel}` : ""} ·{" "}
              {new Date(resolved.createdAt).toLocaleString("zh-CN")}
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            关闭
          </Button>
        </div>

        <div className="flex items-center justify-center bg-[#f6f8fa] p-3">
          {resolved.kind === "video" ? (
            <video
              src={resolved.mediaUrl}
              poster={resolved.thumbnailUrl ?? undefined}
              controls
              preload="metadata"
              className="max-h-[60vh] w-full rounded"
            />
          ) : resolved.kind === "audio" ? (
            <audio src={resolved.mediaUrl} controls preload="none" className="w-full" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolved.mediaUrl}
              alt={resolved.title ?? "资产"}
              className="max-h-[60vh] w-auto rounded object-contain"
            />
          )}
        </div>

        {resolved.prompt ? (
          <div className="border-t border-[#eaeef2] px-4 py-3">
            <p className="text-xs font-medium text-[#1f2328]">提示词</p>
            <p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-[#656d76]">
              {resolved.prompt}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-[#eaeef2] px-4 py-3">
          <Button type="button" size="sm" disabled={busy} onClick={onTogglePin}>
            {asset.pinned ? "移出空间" : "收进空间"}
          </Button>
          {resolved.prompt ? (
            <Button type="button" size="sm" variant="outline" onClick={() => void copyPrompt()}>
              {copied ? "已复制" : "复制提示词"}
            </Button>
          ) : null}
          {href ? (
            <Button asChild type="button" size="sm" variant="outline">
              <a href={href} target="_blank" rel="noreferrer">
                回原应用继续创作
              </a>
            </Button>
          ) : null}
          {asset.blockRefCount > 0 ? (
            <span className="text-xs text-[#8c959f]">
              作品墙画布上有 {asset.blockRefCount} 处引用
            </span>
          ) : null}
        </div>
      </div>
    </AiSpaceOverlay>
  );
}
