"use client";

import { Library, PlusSquare } from "lucide-react";
import { useCallback, useState } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { createProjectAsset } from "@/lib/canvas-api";
import {
  exportTtsAuditionPresetToProjectAssetDraft,
  isActiveTtsAuditionPreset,
  type CanvasTtsAuditionPreset,
} from "@/lib/canvas/libtv-tts-audition-presets";
import { detectCanvasEditionFromNodes } from "@/lib/canvas/spawn-project-asset-on-canvas";
import { spawnAndSelectTtsAuditionPresetAudioNode } from "@/lib/canvas/spawn-tts-audition-preset-node";
import { useCanvasStore } from "@/lib/canvas/store";
import { notifyProjectAssetsChanged } from "@/lib/canvas/use-project-assets";
import { cn } from "@/lib/utils";
import { LibtvVoicePreviewButton } from "./libtv-voice-preview-button";

export function LibtvTtsAuditionPresetList({
  presets,
  variant,
  providerId,
  modelKey,
  voiceId,
  params,
  disabled,
  onApplyPreset,
}: {
  presets: CanvasTtsAuditionPreset[];
  variant: "minimax" | "qwen";
  providerId: string;
  modelKey: string;
  voiceId: string;
  params: Record<string, unknown>;
  disabled?: boolean;
  onApplyPreset: (preset: CanvasTtsAuditionPreset) => void;
}) {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const projectId = useCanvasStore((s) => s.projectId);
  const nodes = useCanvasStore((s) => s.nodes);
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const [savingId, setSavingId] = useState<string | null>(null);

  const savePresetToAsset = useCallback(
    async (preset: CanvasTtsAuditionPreset) => {
      if (!base || !projectId || savingId) return;
      setSavingId(preset.id);
      try {
        const edition = detectCanvasEditionFromNodes(nodes);
        const draft = exportTtsAuditionPresetToProjectAssetDraft({
          preset,
          projectId,
          edition,
        });
        await createProjectAsset(base, {
          kind: draft.kind,
          displayName: draft.displayName,
          description: draft.description,
          thumbnailUrl: draft.thumbnailUrl || undefined,
          sourceProjectId: null,
          sourceNodeId: draft.sourceNodeId || undefined,
          sourceEdition: draft.sourceEdition,
          payload: draft.payload,
          refs: draft.refs,
        });
        notifyProjectAssetsChanged();
        await alert({
          title: "已保存到我的音色",
          message: `「${draft.displayName}」已写入项目资产库，可在任意画布插入或生成节点。`,
        });
      } catch (e) {
        await alert({
          title: "保存失败",
          message: e instanceof Error ? e.message : "无法保存到我的音色",
          variant: "error",
        });
      } finally {
        setSavingId(null);
      }
    },
    [alert, base, nodes, projectId, savingId],
  );

  const spawnPresetNode = useCallback(
    (preset: CanvasTtsAuditionPreset) => {
      if (disabled) return;
      const nodeId = spawnAndSelectTtsAuditionPresetAudioNode(
        preset,
        addNode,
        setNodes,
      );
      if (!nodeId) {
        void alert({
          title: "生成失败",
          message: "无法在画布上创建音频节点",
          variant: "error",
        });
      }
    },
    [addNode, alert, disabled, setNodes],
  );

  if (presets.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-[11px] leading-relaxed text-white/40">
        勾选调参试听并成功合成后，参考音色会保存在本画布，所有音频节点共用。
      </p>
    );
  }

  return (
    <div
      className="nodrag nowheel min-h-0 flex-1 overflow-y-auto overscroll-contain px-0.5"
      data-canvas-wheel-scroll
      onWheel={(e) => e.stopPropagation()}
    >
      {presets.map((preset) => {
        const active = isActiveTtsAuditionPreset(preset, {
          variant,
          providerId,
          modelKey,
          voiceId,
          params,
        });
        const rowBusy = savingId === preset.id;
        return (
          <div
            key={preset.id}
            className={cn(
              "flex items-center gap-0.5 rounded-md pr-0.5 transition",
              active ? "bg-white/[0.12]" : "hover:bg-white/[0.06]",
            )}
          >
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "flex min-w-0 flex-1 flex-col px-2 py-1 text-left leading-tight",
                active ? "text-white" : "text-white/75",
                disabled && "cursor-not-allowed opacity-50",
              )}
              title="选为参考音色（无需再次调参试听）"
              onClick={() => onApplyPreset(preset)}
            >
              <span className="truncate text-[12px] font-medium">
                {preset.label}
              </span>
              {preset.subtitle ? (
                <span className="truncate text-[10px] text-white/40">
                  {preset.subtitle}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              disabled={disabled || rowBusy || !base || !projectId}
              title="保存到我的音色"
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/45 transition hover:bg-white/10 hover:text-white/80",
                (disabled || rowBusy) && "cursor-not-allowed opacity-40",
              )}
              onClick={(e) => {
                e.stopPropagation();
                void savePresetToAsset(preset);
              }}
            >
              <Library className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              disabled={disabled}
              title="生成音频节点"
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/45 transition hover:bg-white/10 hover:text-white/80",
                disabled && "cursor-not-allowed opacity-40",
              )}
              onClick={(e) => {
                e.stopPropagation();
                spawnPresetNode(preset);
              }}
            >
              <PlusSquare className="h-3.5 w-3.5" aria-hidden />
            </button>
            <LibtvVoicePreviewButton
              previewUrl={preset.previewUrl}
              voiceId={preset.voiceId}
              voiceLanguage={preset.language}
              sampleText={preset.sampleText}
              minimaxOssFallback={false}
              mode="oss"
            />
          </div>
        );
      })}
    </div>
  );
}
