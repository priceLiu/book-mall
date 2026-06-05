"use client";

import { Film, ImageIcon, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  generateStoryboardSheetImage,
  generateStoryboardVideo,
  syncStoryboardSheet,
} from "@/lib/ecom-storyboard-api";
import type { StoryboardGatewayModel, StoryboardProject } from "@/lib/storyboard-types";

type Props = {
  project: StoryboardProject;
  imageModels: StoryboardGatewayModel[];
  videoModels: StoryboardGatewayModel[];
  durationSec: number;
  aspectRatio: "16:9" | "9:16";
  onQuickReply: (text: string) => void;
  onImageReady: () => void;
  onVideoReady: () => void;
  onAlert: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
};

const QUICK_REPLIES = [
  "已上传产品图",
  "已上传角色图",
  "跳过",
  "是，自动生成角色",
  "否，不需要",
  "生成全部分镜图",
  "生成视频",
] as const;

export function StoryboardWorkflowBar({
  project,
  imageModels,
  videoModels,
  durationSec,
  aspectRatio,
  onQuickReply,
  onImageReady,
  onVideoReady,
  onAlert,
}: Props) {
  const schemes = project.meta?.deliverable?.schemes ?? [];
  const hasSheet = Boolean(project.sheet) || schemes.length > 0;
  const [imageModel, setImageModel] = useState(
    project.meta?.workflow?.imageModelKey ?? "wan2.7-image",
  );
  const [videoModel, setVideoModel] = useState(
    project.meta?.workflow?.videoModelKey ??
      (typeof project.settings?.videoModelKey === "string"
        ? project.settings.videoModelKey
        : "doubao-seedance-2.0"),
  );
  const [autoGenChar, setAutoGenChar] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [vidBusy, setVidBusy] = useState(false);

  if (!hasSheet) return null;

  const selectedIndex = project.meta?.selectedSchemeIndex ?? 0;
  const phase = project.meta?.workflow?.phase ?? (project.sheetPngUrl ? "image" : "finalized");

  async function ensureSheet(): Promise<boolean> {
    if (project.sheet) return true;
    try {
      const updated = await syncStoryboardSheet(project.id, {
        schemeIndex: selectedIndex,
      });
      if (updated.sheet) onImageReady();
      return Boolean(updated.sheet);
    } catch {
      return false;
    }
  }

  async function handleGenerateImage() {
    setImgBusy(true);
    try {
      const ready = await ensureSheet();
      if (!ready) {
        await onAlert({
          title: "无法生图",
          message: "请先在右侧采用一套分镜方案，或让助手重新输出结构化分镜。",
        });
        return;
      }
      await generateStoryboardSheetImage(project.id, {
        modelKey: imageModel,
        aspectRatio,
        autoGenCharacter: autoGenChar,
      });
      onImageReady();
      await onAlert({ title: "分镜图已生成", message: "完整分镜图已保存，可在右侧查看。" });
    } catch (e) {
      await onAlert({
        title: "生成失败",
        message: e instanceof Error ? e.message : "分镜图生成失败",
        variant: "error",
      });
    } finally {
      setImgBusy(false);
    }
  }

  async function handleGenerateVideo() {
    if (!project.sheetPngUrl) {
      await onAlert({ title: "提示", message: "请先生成分镜图。" });
      return;
    }
    setVidBusy(true);
    try {
      await generateStoryboardVideo(project.id, {
        durationSec,
        aspectRatio,
        modelKey: videoModel,
      });
      onVideoReady();
      await onAlert({ title: "视频已生成", message: "完整成片已保存。" });
    } catch (e) {
      await onAlert({
        title: "生成失败",
        message: e instanceof Error ? e.message : "视频生成失败",
        variant: "error",
      });
    } finally {
      setVidBusy(false);
    }
  }

  return (
    <div className="border-t border-[#e8e8ed] bg-white px-4 py-3">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-[#6e6e73]">
        制作指引 · 快捷操作
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {QUICK_REPLIES.map((q) => (
          <button
            key={q}
            type="button"
            className="rounded-full border border-[#d2d2d7] bg-[#fafafa] px-2.5 py-1 text-[11px] text-[#1d1d1f] hover:border-[#0071e3] hover:text-[#0071e3]"
            onClick={() => onQuickReply(q)}
          >
            {q}
          </button>
        ))}
      </div>

      <div className="space-y-2 rounded-lg border border-[#e8e8ed] bg-[#fafafa] p-3">
        <div className="flex items-center gap-2 text-xs text-[#6e6e73]">
          <span
            className={
              phase === "finalized" || phase === "refs" || phase === "planning"
                ? "font-semibold text-[#0071e3]"
                : ""
            }
          >
            ① 参考图
          </span>
          <span>→</span>
          <span
            className={
              phase === "image" || !project.sheetPngUrl
                ? "font-semibold text-[#0071e3]"
                : project.sheetPngUrl
                  ? "text-[#34c759]"
                  : ""
            }
          >
            ② 分镜图
          </span>
          <span>→</span>
          <span
            className={
              phase === "done" || project.videoAssetId
                ? "text-[#34c759]"
                : project.sheetPngUrl
                  ? "font-semibold text-[#0071e3]"
                  : ""
            }
          >
            ③ 视频
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="flex-1 rounded border border-[#d2d2d7] bg-white px-2 py-1.5 text-xs"
            value={imageModel}
            onChange={(e) => setImageModel(e.target.value)}
            disabled={imgBusy}
          >
            {imageModels.map((m) => (
              <option key={m.modelKey} value={m.modelKey} disabled={!m.credentialBound}>
                {m.displayName}
                {!m.credentialBound ? "（未绑定）" : ""}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-[11px] text-[#6e6e73]">
            <input
              type="checkbox"
              checked={autoGenChar}
              onChange={(e) => setAutoGenChar(e.target.checked)}
            />
            自动生成角色
          </label>
          <EcomButtonPrimary size="sm" type="button" disabled={imgBusy} onClick={handleGenerateImage}>
            {imgBusy ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5 shrink-0" />
            )}
            生成分镜图
          </EcomButtonPrimary>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="flex-1 rounded border border-[#d2d2d7] bg-white px-2 py-1.5 text-xs"
            value={videoModel}
            onChange={(e) => setVideoModel(e.target.value)}
            disabled={vidBusy || !project.sheetPngUrl}
          >
            {videoModels.map((m) => (
              <option key={m.modelKey} value={m.modelKey} disabled={!m.credentialBound}>
                {m.displayName}
                {!m.credentialBound ? "（未绑定）" : ""}
              </option>
            ))}
          </select>
          <EcomButtonSecondary
            size="sm"
            type="button"
            disabled={vidBusy || !project.sheetPngUrl}
            onClick={handleGenerateVideo}
          >
            {vidBusy ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <Film className="h-3.5 w-3.5 shrink-0" />
            )}
            生成视频
          </EcomButtonSecondary>
        </div>

        {project.sheetPngUrl ? (
          <p className="flex items-center gap-1 text-[10px] text-[#34c759]">
            <Sparkles className="h-3 w-3" />
            分镜图已持久化保存
          </p>
        ) : null}
      </div>
    </div>
  );
}
