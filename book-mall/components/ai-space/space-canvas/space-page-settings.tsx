"use client";

/** 空间信息与公开分享设置 */

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { AiSpacePageDto } from "@/lib/ai-space/ai-space-space-types";
import {
  SPACE_THEME_PRESETS,
  SPACE_THEME_TOKENS,
  type SpaceThemePreset,
} from "@/lib/ai-space/space-blocks/theme";
import { cn } from "@/lib/utils";

import { AiSpaceOverlay } from "../ai-space-overlay";

const ACCENT_SWATCHES = [
  "#0969da",
  "#8250df",
  "#bf3989",
  "#bc4c00",
  "#1a7f37",
  "#1f2328",
];

export function SpacePageSettings({
  page,
  busy,
  error,
  onSave,
  onPublishToggle,
  onClose,
}: {
  page: AiSpacePageDto;
  busy: boolean;
  error: string | null;
  onSave: (patch: {
    title?: string;
    bio?: string;
    slug?: string;
    theme?: { preset: SpaceThemePreset; accent: string };
  }) => void;
  onPublishToggle: (publish: boolean) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(page.title);
  const [bio, setBio] = useState(page.bio);
  const [slug, setSlug] = useState(page.slug);
  const [preset, setPreset] = useState<SpaceThemePreset>(page.theme.preset);
  const [accent, setAccent] = useState(page.theme.accent);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setTitle(page.title);
    setBio(page.bio);
    setSlug(page.slug);
    setPreset(page.theme.preset);
    setAccent(page.theme.accent);
  }, [page]);

  const published = page.publishStatus === "PUBLISHED";
  const publicPath = `/space/${page.slug}`;

  const copyLink = async () => {
    const url =
      typeof window === "undefined" ? publicPath : `${window.location.origin}${publicPath}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <AiSpaceOverlay label="空间信息" onClose={busy ? undefined : onClose}>
      <div className="max-h-[85vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-lg border border-[#d0d7de] bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-[#1f2328]">空间信息</h2>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <label className="block space-y-1">
          <span className="text-xs font-medium text-[#1f2328]">标题</span>
          <input
            type="text"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-[#d0d7de] px-2 py-1.5 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-[#1f2328]">简介</span>
          <textarea
            rows={3}
            value={bio}
            maxLength={2000}
            onChange={(e) => setBio(e.target.value)}
            className="w-full rounded-md border border-[#d0d7de] px-2 py-1.5 text-sm leading-relaxed"
          />
          <span className="text-[11px] text-[#8c959f]">
            个人名片挂件会显示标题与简介。
          </span>
        </label>

        <div className="space-y-2">
          <span className="text-xs font-medium text-[#1f2328]">底色</span>
          <div className="flex flex-wrap gap-1.5">
            {SPACE_THEME_PRESETS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setPreset(key)}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs",
                  preset === key ? "border-[#0969da] bg-[#f0f6ff]" : "border-[#d0d7de]",
                )}
              >
                <span
                  className="mr-1.5 inline-block h-3 w-3 rounded-sm border border-[#d0d7de] align-middle"
                  style={{ background: SPACE_THEME_TOKENS[key].canvasBg }}
                />
                {SPACE_THEME_TOKENS[key].label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-medium text-[#1f2328]">强调色</span>
          <div className="flex flex-wrap gap-1.5">
            {ACCENT_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`强调色 ${c}`}
                onClick={() => setAccent(c)}
                className={cn(
                  "h-6 w-6 rounded-full border-2",
                  accent === c ? "border-[#1f2328]" : "border-transparent",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-[#d0d7de] p-3">
          <p className="text-xs font-semibold text-[#1f2328]">公开分享</p>

          <label className="block space-y-1">
            <span className="text-xs text-[#656d76]">链接名</span>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-[#8c959f]">/space/</span>
              <input
                type="text"
                value={slug}
                maxLength={64}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                className="min-w-0 flex-1 rounded-md border border-[#d0d7de] px-2 py-1 text-sm"
              />
            </div>
            <span className="text-[11px] text-[#8c959f]">
              小写字母、数字与连字符，2–64 位。
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={published ? "outline" : "default"}
              disabled={busy}
              onClick={() => onPublishToggle(!published)}
            >
              {published ? "取消发布" : "发布空间"}
            </Button>
            {published ? (
              <>
                <Button type="button" size="sm" variant="outline" asChild>
                  <a href={publicPath} target="_blank" rel="noreferrer">
                    查看公开页
                  </a>
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={copyLink}>
                  {copied ? "已复制" : "复制链接"}
                </Button>
              </>
            ) : (
              <span className="text-[11px] text-[#8c959f]">
                未发布时公开链接返回 404。
              </span>
            )}
          </div>
          {published ? (
            <p className="text-[11px] leading-relaxed text-[#8c959f]">
              公开页不显示「继续创作」按钮——SSO 深链只对你本人有意义。
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            关闭
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() =>
              onSave({
                title,
                bio,
                slug: slug === page.slug ? undefined : slug,
                theme: { preset, accent },
              })
            }
          >
            保存
          </Button>
        </div>
      </div>
    </AiSpaceOverlay>
  );
}
