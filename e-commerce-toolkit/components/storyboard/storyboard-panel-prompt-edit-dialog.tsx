"use client";

import { useEffect, useMemo, useState } from "react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  resolvePanelSceneTextPreview,
} from "@/lib/storyboard-scene-prompt";
import type { StoryboardPanel, StoryboardReference } from "@/lib/storyboard-types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panel: StoryboardPanel | null;
  references?: StoryboardReference[];
  globalSceneAnchor?: string;
  onSave: (panel: StoryboardPanel) => void | Promise<void>;
  onSaveAndRegenerateImage?: (panel: StoryboardPanel) => void | Promise<void>;
  onSaveAndRegenerateVideo?: (panel: StoryboardPanel) => void | Promise<void>;
  saving?: boolean;
  canRegenerateVideo?: boolean;
};

const textareaClass =
  "w-full min-h-[120px] resize-y rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-[13px] leading-relaxed text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]/30";

/** 镜头 Prompt 编辑：场景 / 生图 / 生视频 + 分镜表画面内容 */
export function StoryboardPanelPromptEditDialog({
  open,
  onOpenChange,
  panel,
  references = [],
  globalSceneAnchor,
  onSave,
  onSaveAndRegenerateImage,
  onSaveAndRegenerateVideo,
  saving = false,
  canRegenerateVideo = false,
}: Props) {
  const [draft, setDraft] = useState<StoryboardPanel | null>(panel);
  const [visual, setVisual] = useState("");

  useEffect(() => {
    if (!open || !panel) return;
    setDraft({ ...panel });
    setVisual(`${panel.scene?.trim() ?? ""} ${panel.action?.trim() ?? ""}`.trim());
  }, [open, panel]);

  const sceneRefCount = useMemo(
    () =>
      references.filter(
        (r) =>
          (r.role === "scene" || r.role === "other") &&
          r.ossUrl?.trim().startsWith("http"),
      ).length,
    [references],
  );

  const resolvedScenePreview = useMemo(() => {
    if (!draft) return "";
    return resolvePanelSceneTextPreview(draft, references, globalSceneAnchor);
  }, [draft, references, globalSceneAnchor]);

  if (!draft) return null;

  function buildNormalizedPanel(): StoryboardPanel {
    const visualTrimmed = visual.trim();
    const firstLine = visualTrimmed.split("\n")[0]?.trim() || visualTrimmed || "—";
    return {
      ...draft!,
      shotType: draft!.shotType?.trim() || "中景",
      scene: firstLine,
      action: visualTrimmed || firstLine,
      scenePrompt: draft!.scenePrompt?.trim() || undefined,
      imagePrompt: draft!.imagePrompt?.trim() || undefined,
      videoPromptEn: draft!.videoPromptEn?.trim() || undefined,
    };
  }

  async function handleSave() {
    await onSave(buildNormalizedPanel());
    onOpenChange(false);
  }

  async function handleSaveAndRegenerateImage() {
    if (!onSaveAndRegenerateImage) return;
    const normalized = buildNormalizedPanel();
    await onSaveAndRegenerateImage(normalized);
    onOpenChange(false);
  }

  async function handleSaveAndRegenerateVideo() {
    if (!onSaveAndRegenerateVideo) return;
    const normalized = buildNormalizedPanel();
    await onSaveAndRegenerateVideo(normalized);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,880px)] w-[min(94vw,56rem)] max-w-none flex-col gap-4 p-6 sm:max-w-none">
        <DialogHeader className="shrink-0">
          <DialogTitle>镜头 {draft.index} · Prompt 编辑</DialogTitle>
        </DialogHeader>

        <div className="ecom-scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#1d1d1f]">画面内容（分镜表）</span>
            <textarea
              className={textareaClass}
              value={visual}
              onChange={(e) => setVisual(e.target.value)}
              placeholder="导演表「画面内容」列，保存后同步到底部分镜表"
            />
          </label>

          {sceneRefCount > 0 ? (
            <p className="text-[11px] leading-relaxed text-[#86868b]">
              已上传 {sceneRefCount} 张场景参考图；下方「场景 Prompt」写机位与局部差异。保存后生图/成片将按解析结果使用：
              <span className="mt-1 block whitespace-pre-wrap text-[#6e6e73]">
                {resolvedScenePreview}
              </span>
            </p>
          ) : null}

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#1d1d1f]">场景 Prompt</span>
            <textarea
              className={textareaClass}
              value={draft.scenePrompt ?? ""}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, scenePrompt: e.target.value } : d))
              }
              placeholder="环境、光线、道具、空间布局…"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#1d1d1f]">生图 Prompt</span>
            <textarea
              className={textareaClass}
              value={draft.imagePrompt ?? ""}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, imagePrompt: e.target.value } : d))
              }
              placeholder="完整中文生图描述（含场景、人物、产品交互）"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#1d1d1f]">生视频 Prompt</span>
            <textarea
              className={textareaClass}
              value={draft.videoPromptEn ?? ""}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, videoPromptEn: e.target.value } : d))
              }
              placeholder="运镜与动作描述；留空时成片使用场景+动作模板"
            />
          </label>
        </div>

        <DialogFooter className="shrink-0 flex-wrap gap-2 sm:justify-end">
          <EcomButtonSecondary
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </EcomButtonSecondary>
          <EcomButtonPrimary type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </EcomButtonPrimary>
          {onSaveAndRegenerateImage ? (
            <EcomButtonPrimary
              type="button"
              size="sm"
              onClick={handleSaveAndRegenerateImage}
              disabled={saving}
            >
              {saving ? "处理中…" : "保存并重新生图"}
            </EcomButtonPrimary>
          ) : null}
          {canRegenerateVideo && onSaveAndRegenerateVideo ? (
            <EcomButtonSecondary
              type="button"
              size="sm"
              onClick={handleSaveAndRegenerateVideo}
              disabled={saving}
            >
              保存并重新生视频
            </EcomButtonSecondary>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
