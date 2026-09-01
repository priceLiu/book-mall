"use client";

import { Loader2 } from "lucide-react";
import { useRef } from "react";

import { FilmPullMediaInput } from "@/components/film-pull/film-pull-media-input";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { IMAGE_UPLOAD_ACCEPT, IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import type { FilmPullCharacterRef, FilmPullMediaReference, FilmPullPhase } from "@/lib/film-pull-types";

type Props = {
  phase: FilmPullPhase;
  media: FilmPullMediaReference | null;
  characterRefs: FilmPullCharacterRef[];
  mediaBusy?: boolean;
  /** 拉片/渲染脚本进行中：锁定源视频不可删换 */
  mediaLocked?: boolean;
  busy?: boolean;
  characterDescription: string;
  onCharacterDescriptionChange: (v: string) => void;
  onUploadVideo: (file: File) => Promise<void>;
  onImportVideoUrl: (url: string) => Promise<void>;
  onAttachVideoAsset: (assetId: string) => Promise<void>;
  onClearVideo: () => Promise<void>;
  onUploadCharacter: (file: File) => Promise<void>;
  onAnalyze: () => void;
  onAbortAnalyze?: () => void;
  onSaveShots?: () => void;
  onRenderScript: () => void;
  onBatchGenerate: () => void;
  onFinalRender: () => void;
  onExportZip: () => void;
  analyzeDisabled?: boolean;
  /** true = 服务端 analyzing 或前台等待 */
  analyzing?: boolean;
};

export function FilmPullDock({
  phase,
  media,
  characterRefs,
  mediaBusy,
  mediaLocked,
  busy,
  characterDescription,
  onCharacterDescriptionChange,
  onUploadVideo,
  onImportVideoUrl,
  onAttachVideoAsset,
  onClearVideo,
  onUploadCharacter,
  onAnalyze,
  onAbortAnalyze,
  onSaveShots,
  onRenderScript,
  onBatchGenerate,
  onFinalRender,
  onExportZip,
  analyzeDisabled,
  analyzing,
}: Props) {
  const characterInputRef = useRef<HTMLInputElement>(null);

  const characterItems = characterRefs.map((r) => ({
    id: r.id,
    ossUrl: r.ossUrl,
    label: r.label ?? "角色",
    kind: "image" as const,
  }));

  const videoCount = media?.ossUrl ? 1 : 0;

  return (
    <div className="flex shrink-0 flex-col gap-3 border-t border-[#e8e8ed] bg-[#fafafa] px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
          源视频
          <span className="ml-1 font-normal normal-case text-[#ff3b30]">（≤60s · 必传）</span>
        </span>
        <span className="shrink-0 text-[10px] text-[#86868b]">{videoCount}/1</span>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <FilmPullMediaInput
            media={media}
            busy={mediaBusy}
            locked={mediaLocked}
            onUploadFile={onUploadVideo}
            onImportUrl={onImportVideoUrl}
            onAttachAsset={onAttachVideoAsset}
            onClear={onClearVideo}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2 self-center">
          {phase === "analyze" && (
            <>
              {analyzing ? (
                <EcomButtonSecondary size="sm" disabled={busy} onClick={onAbortAnalyze}>
                  中止
                </EcomButtonSecondary>
              ) : null}
              <EcomButtonPrimary
                size="sm"
                disabled={busy || analyzing || analyzeDisabled}
                onClick={onAnalyze}
              >
                {analyzing || busy ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : null}
                {analyzing ? "拉片中…" : "开始拉片"}
              </EcomButtonPrimary>
            </>
          )}
          {phase === "review" && (
            <>
              <EcomButtonSecondary size="sm" disabled={busy} onClick={onSaveShots}>
                保存审校
              </EcomButtonSecondary>
              <EcomButtonPrimary size="sm" disabled={busy} onClick={onRenderScript}>
                生成渲染脚本
              </EcomButtonPrimary>
            </>
          )}
          {phase === "replace" && (
            <EcomButtonPrimary size="sm" disabled={busy} onClick={onBatchGenerate}>
              批量出镜
            </EcomButtonPrimary>
          )}
          {phase === "output" && (
            <>
              <EcomButtonSecondary size="sm" disabled={busy} onClick={onExportZip}>
                导出 ZIP
              </EcomButtonSecondary>
              <EcomButtonPrimary size="sm" disabled={busy} onClick={onFinalRender}>
                合成成片
              </EcomButtonPrimary>
            </>
          )}
        </div>
      </div>

      {(phase === "replace" || phase === "output") && (
        <div className="space-y-2 border-t border-[#e8e8ed] pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
              角色参考
            </span>
            <span className="text-[10px] text-[#86868b]">{characterItems.length} 张</span>
          </div>
          <EcomRefUploadCard
            title="角色图"
            items={characterItems}
            emptyHint={`上传角色参考图，用于换角出镜。${IMAGE_UPLOAD_DROP_HINT}`}
            busy={busy}
            accept={IMAGE_UPLOAD_ACCEPT}
            multiple
            inputRef={characterInputRef}
            onOpenFilePicker={() => characterInputRef.current?.click()}
            onUploadFiles={(files) => {
              const file = files[0];
              if (file) void onUploadCharacter(file);
            }}
          />
          <textarea
            className="w-full rounded-lg border border-[#d2d2d7] px-2 py-1.5 text-xs outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
            rows={2}
            placeholder="角色文字描述（可选）"
            value={characterDescription}
            onChange={(e) => onCharacterDescriptionChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
