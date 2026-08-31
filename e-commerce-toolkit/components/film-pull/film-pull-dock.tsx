"use client";

import { Loader2 } from "lucide-react";

import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import type { FilmPullCharacterRef, FilmPullMediaReference, FilmPullPhase } from "@/lib/film-pull-types";

type Props = {
  phase: FilmPullPhase;
  media: FilmPullMediaReference | null;
  characterRefs: FilmPullCharacterRef[];
  mediaBusy?: boolean;
  busy?: boolean;
  characterDescription: string;
  onCharacterDescriptionChange: (v: string) => void;
  onUploadVideo: (file: File) => void;
  onClearVideo: () => void;
  onUploadCharacter: (file: File) => void;
  onAnalyze: () => void;
  onSaveShots?: () => void;
  onRenderScript: () => void;
  onBatchGenerate: () => void;
  onFinalRender: () => void;
  onExportZip: () => void;
  analyzeDisabled?: boolean;
};

export function FilmPullDock({
  phase,
  media,
  characterRefs,
  mediaBusy,
  busy,
  characterDescription,
  onCharacterDescriptionChange,
  onUploadVideo,
  onClearVideo,
  onUploadCharacter,
  onAnalyze,
  onSaveShots,
  onRenderScript,
  onBatchGenerate,
  onFinalRender,
  onExportZip,
  analyzeDisabled,
}: Props) {
  return (
    <div className="flex shrink-0 flex-col gap-3 border-t border-[#e8e8ed] bg-[#fafafa] px-4 py-3">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-[200px] max-w-[280px]">
          <p className="mb-1 text-xs font-medium text-[#6e6e73]">源视频（≤60s）</p>
          {media?.ossUrl ? (
            <div className="flex items-center gap-2">
              <video
                src={media.ossUrl}
                className="h-16 w-28 rounded-lg bg-black object-cover"
                muted
                playsInline
              />
              <EcomButtonSecondary size="sm" onClick={onClearVideo} disabled={mediaBusy}>
                更换
              </EcomButtonSecondary>
            </div>
          ) : (
            <EcomRefUploadCard
              acceptVideo
              busy={mediaBusy}
              label="上传视频"
              onPickFile={onUploadVideo}
            />
          )}
        </div>

        {(phase === "replace" || phase === "output") && (
          <div className="min-w-[200px] flex-1">
            <p className="mb-1 text-xs font-medium text-[#6e6e73]">角色参考</p>
            <div className="flex flex-wrap items-center gap-2">
              {characterRefs.map((r) => (
                <img
                  key={r.id}
                  src={r.ossUrl}
                  alt={r.label ?? "角色"}
                  className="h-14 w-14 rounded-lg object-cover"
                />
              ))}
              <EcomRefUploadCard
                acceptVideo={false}
                busy={busy}
                label="添加角色"
                onPickFile={onUploadCharacter}
              />
            </div>
            <textarea
              className="mt-2 w-full max-w-md rounded-lg border border-[#d2d2d7] px-2 py-1 text-xs"
              rows={2}
              placeholder="角色文字描述（可选）"
              value={characterDescription}
              onChange={(e) => onCharacterDescriptionChange(e.target.value)}
            />
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {phase === "analyze" && (
            <EcomButtonPrimary size="sm" disabled={busy || analyzeDisabled} onClick={onAnalyze}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              开始拉片
            </EcomButtonPrimary>
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
    </div>
  );
}
