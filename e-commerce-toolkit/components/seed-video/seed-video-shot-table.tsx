"use client";

import { Fragment } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ProductDesignPromptMentionTextarea } from "@/components/product-design/product-design-prompt-mention-textarea";
import { EcomVideoSlot } from "@/components/media/ecom-video-slot";
import { SeedVideoRefsGalleryStrip } from "@/components/seed-video/seed-video-refs-gallery-strip";
import { SeedVideoShotRefCell } from "@/components/seed-video/seed-video-shot-ref-cell";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";
import type { SeedVideoReference, SeedVideoShot } from "@/lib/seed-video-types";

type Props = {
  shots: SeedVideoShot[];
  references: SeedVideoReference[];
  onChange: (shots: SeedVideoShot[]) => void;
  disabled?: boolean;
  generatingIndex?: number | null;
  generatingIndices?: ReadonlySet<number>;
  onPreviewVideo?: (src: string, title?: string) => void;
  /** 单次成片：只展示脚本表，不展示逐镜视频格 */
  hideVideoColumn?: boolean;
  hideStatusColumn?: boolean;
  /** 方案②：镜号列勾选 + 表底按选中生成 */
  showGenerateActions?: boolean;
  selectDisabled?: boolean;
  selectedShotIndices?: ReadonlySet<number>;
  onToggleShotSelected?: (index: number, checked: boolean) => void;
  onGenerateSelected?: () => void;
  generateSelectedDisabled?: boolean;
  selectedCount?: number;
  onBatchTtsSelected?: () => void;
  batchTtsDisabled?: boolean;
  batchTtsLabel?: string;
  onBatchComposeSelected?: () => void;
  batchComposeDisabled?: boolean;
  batchComposeLabel?: string;
  /** 逐镜指定参考图（legacy）；拆图复刻等场景请用 hideRefColumn + showRefsGallery */
  editableRefs?: boolean;
  /** 隐藏「参考图」列（参考图在表头展示或上方上传区统一管理） */
  hideRefColumn?: boolean;
  /** 表头下方展示全部参考图及 @图片N */
  showRefsGallery?: boolean;
  /** 全局参考图 busy（兼容旧用法，锁定所有参考图格） */
  refBusy?: boolean;
  /** 仅锁定正在上传/处理的镜号参考图格 */
  refBusyShotIndices?: ReadonlySet<number>;
  videoPromptMentionRefs?: EcomPromptImageRef[];
  onUploadShotRef?: (shotIndex: number, file: File) => void | Promise<void>;
  onUnassignShotRef?: (shotIndex: number) => void;
  /** 增删镜头（删行：生成中/已出片禁止） */
  showRowActions?: boolean;
  onAddRow?: () => void;
  onDeleteRow?: (index: number) => void;
  canDeleteShot?: (shot: SeedVideoShot) => boolean;
  /** AI 口播草稿（按镜号）；有值时展示「应用新口播」 */
  voiceoverDraftByIndex?: ReadonlyMap<number, string>;
  onApplyVoiceoverDraft?: (shotIndex: number) => void | Promise<void>;
  onApplyAllVoiceoverDrafts?: () => void | Promise<void>;
};

export function SeedVideoShotTable({
  shots,
  references,
  onChange,
  disabled,
  generatingIndex = null,
  generatingIndices,
  onPreviewVideo,
  hideVideoColumn = false,
  hideStatusColumn = false,
  showGenerateActions = false,
  selectDisabled = false,
  selectedShotIndices,
  onToggleShotSelected,
  onGenerateSelected,
  generateSelectedDisabled = false,
  selectedCount = 0,
  onBatchTtsSelected,
  batchTtsDisabled = false,
  batchTtsLabel = "批量 TTS",
  onBatchComposeSelected,
  batchComposeDisabled = false,
  batchComposeLabel = "合成成片",
  editableRefs = false,
  hideRefColumn = false,
  showRefsGallery = false,
  refBusy = false,
  refBusyShotIndices,
  videoPromptMentionRefs,
  onUploadShotRef,
  onUnassignShotRef,
  showRowActions = false,
  onAddRow,
  onDeleteRow,
  canDeleteShot,
  voiceoverDraftByIndex,
  onApplyVoiceoverDraft,
  onApplyAllVoiceoverDrafts,
}: Props) {
  function patchShot(index: number, patch: Partial<SeedVideoShot>) {
    onChange(shots.map((s) => (s.index === index ? { ...s, ...patch } : s)));
  }

  function refUrl(refImageId: string): string | undefined {
    return references.find((r) => r.id === refImageId)?.ossUrl;
  }

  function isShotGenerating(index: number, shot?: SeedVideoShot): boolean {
    if (shot?.videoUrl?.trim()) return false;
    if (generatingIndices?.has(index)) return true;
    return generatingIndex === index;
  }

  function shotStatus(shot: SeedVideoShot): { label: string; className: string } {
    if (isShotGenerating(shot.index, shot)) {
      return { label: "生成中", className: "text-[#0071e3]" };
    }
    if (shot.videoUrl && shot.ttsUrl) {
      return { label: "就绪", className: "text-[#34c759]" };
    }
    if (shot.videoUrl) {
      return { label: "视频 OK", className: "text-[#1d1d1f]" };
    }
    if (shot.ttsUrl) {
      return { label: "TTS OK", className: "text-[#6e6e73]" };
    }
    return { label: "待生成", className: "text-[#86868b]" };
  }

  const showRefColumn = !hideRefColumn;
  const columnCount =
    5 +
    (showRefColumn ? 1 : 0) +
    (hideVideoColumn ? 0 : 1) +
    (hideStatusColumn ? 0 : 1) +
    (showRowActions ? 1 : 0);

  const generateLabel =
    selectedCount > 0 ? `生成 (${selectedCount})` : "生成";

  const voiceoverDraftCount = voiceoverDraftByIndex?.size ?? 0;
  const showVoiceoverDraftActions = voiceoverDraftCount > 0 && Boolean(onApplyVoiceoverDraft);

  return (
    <div className="overflow-x-auto rounded-xl border border-[#e8e8ed]">
      {showRefsGallery ? (
        <div className="border-b border-[#e8e8ed] bg-[#fafafa] px-3 py-2.5">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[#6e6e73]">
            参考图 · 在视频 Prompt 中用 @图片1 … 引用
          </p>
          {videoPromptMentionRefs && videoPromptMentionRefs.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {videoPromptMentionRefs.map((ref) => (
                <div
                  key={ref.token}
                  className="flex items-center gap-1.5 rounded-lg border border-[#e8e8ed] bg-white px-1.5 py-1"
                  title={ref.label}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ref.url}
                    alt={ref.label}
                    className="h-10 w-10 shrink-0 rounded-md border border-[#e8e8ed] object-cover"
                  />
                  <span className="pr-1 font-mono text-[10px] font-medium text-[#0071e3]">
                    {ref.token}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <SeedVideoRefsGalleryStrip references={references} />
          )}
        </div>
      ) : null}
      <table className="min-w-full text-left text-xs">
        <thead>
          <tr className="bg-[#1d1d1f] text-white">
            <th className="px-3 py-2 font-medium">镜号</th>
            <th className="px-3 py-2 font-medium">时间</th>
            {showRefColumn ? (
              <th className="px-3 py-2 font-medium">参考图</th>
            ) : null}
            {!hideVideoColumn ? (
              <th className="px-3 py-2 font-medium w-[108px]">镜头视频</th>
            ) : null}
            <th className="px-3 py-2 font-medium min-w-[120px]">画面描述</th>
            <th className="px-3 py-2 font-medium min-w-[180px]">视频 Prompt</th>
            <th className="px-3 py-2 font-medium min-w-[140px]">口播</th>
            {!hideStatusColumn ? <th className="px-3 py-2 font-medium">状态</th> : null}
            {showRowActions ? (
              <th className="px-3 py-2 font-medium w-[4rem]">操作</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {shots.map((shot) => {
            const thumb = refUrl(shot.refImageId);
            const status = shotStatus(shot);
            const isGenerating = isShotGenerating(shot.index, shot);
            const isSelected =
              (selectedShotIndices?.has(shot.index) ?? false) && !isGenerating;
            const deletable = canDeleteShot ? canDeleteShot(shot) : !isGenerating && !shot.videoUrl?.trim();
            return (
              <Fragment key={shot.index}>
              <tr className="border-t border-[#e8e8ed] align-top">
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {showGenerateActions ? (
                      <input
                        type="checkbox"
                        className="size-3.5 shrink-0 rounded border-[#d2d2d7] text-[#0071e3] focus:ring-[#0071e3]/30 disabled:opacity-40"
                        checked={isSelected}
                        disabled={selectDisabled || isGenerating}
                        aria-label={`选择镜 ${shot.index}`}
                        onChange={(e) => onToggleShotSelected?.(shot.index, e.target.checked)}
                      />
                    ) : null}
                    <span className="min-w-[1rem] text-center text-xs font-semibold text-[#1d1d1f]">
                      {shot.index}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-[#6e6e73]">{shot.timeSlice}</td>
                {showRefColumn ? (
                <td className="px-3 py-2">
                  {editableRefs && onUploadShotRef ? (
                    <SeedVideoShotRefCell
                      shotIndex={shot.index}
                      refImageId={shot.refImageId}
                      refImageLabel={shot.refImageLabel}
                      references={references}
                      disabled={disabled || isGenerating}
                      busy={refBusyShotIndices?.has(shot.index) ?? refBusy}
                      onAssign={(refId, refLabel) =>
                        patchShot(shot.index, { refImageId: refId, refImageLabel: refLabel })
                      }
                      onUpload={(file) => onUploadShotRef(shot.index, file)}
                      onUnassign={
                        onUnassignShotRef
                          ? () => onUnassignShotRef(shot.index)
                          : () => patchShot(shot.index, { refImageId: "", refImageLabel: "" })
                      }
                    />
                  ) : thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={shot.refImageLabel}
                      className="h-12 w-12 rounded-lg border border-[#e8e8ed] object-cover"
                    />
                  ) : (
                    <span className="text-[#86868b]">{shot.refImageLabel || "—"}</span>
                  )}
                </td>
                ) : null}
                {!hideVideoColumn ? (
                  <td className="px-3 py-2">
                    <EcomVideoSlot
                      src={shot.videoUrl}
                      aspectRatio="9:16"
                      compact
                      generating={isGenerating}
                      emptyLabel="待生成"
                      playSize="sm"
                      onPreview={
                        shot.videoUrl
                          ? () => onPreviewVideo?.(shot.videoUrl!, `镜 ${shot.index}`)
                          : undefined
                      }
                    />
                  </td>
                ) : null}
                <td className="px-3 py-2">
                  <textarea
                    className="ecom-scrollbar-thin w-full min-h-[4rem] resize-y rounded-lg border border-[#e8e8ed] bg-white px-2 py-1.5 text-[#1d1d1f] focus:border-[#0071e3] focus:outline-none disabled:opacity-50"
                    value={shot.sceneDescription}
                    disabled={disabled || isGenerating}
                    onChange={(e) => patchShot(shot.index, { sceneDescription: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  {videoPromptMentionRefs && videoPromptMentionRefs.length > 0 ? (
                    <ProductDesignPromptMentionTextarea
                      value={shot.videoPrompt}
                      referenceImages={videoPromptMentionRefs}
                      disabled={disabled || isGenerating}
                      minHeightClass="min-h-[4rem]"
                      className="rounded-lg border border-[#e8e8ed] bg-white px-2 py-1.5 text-xs leading-relaxed"
                      onChange={(next) => patchShot(shot.index, { videoPrompt: next })}
                    />
                  ) : (
                    <textarea
                      className="ecom-scrollbar-thin w-full min-h-[4rem] resize-y rounded-lg border border-[#e8e8ed] bg-white px-2 py-1.5 text-[#1d1d1f] focus:border-[#0071e3] focus:outline-none disabled:opacity-50"
                      value={shot.videoPrompt}
                      disabled={disabled || isGenerating}
                      onChange={(e) => patchShot(shot.index, { videoPrompt: e.target.value })}
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="space-y-1.5">
                    {showVoiceoverDraftActions &&
                    voiceoverDraftByIndex?.has(shot.index) ? (
                      <EcomButtonSecondary
                        type="button"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        disabled={disabled || isGenerating}
                        onClick={() => void onApplyVoiceoverDraft?.(shot.index)}
                      >
                        应用新口播
                      </EcomButtonSecondary>
                    ) : null}
                    <textarea
                      className="ecom-scrollbar-thin w-full min-h-[4rem] resize-y rounded-lg border border-[#e8e8ed] bg-white px-2 py-1.5 text-[#1d1d1f] focus:border-[#0071e3] focus:outline-none disabled:opacity-50"
                      value={shot.voiceover ?? ""}
                      placeholder="可留空"
                      disabled={disabled || isGenerating}
                      onChange={(e) => patchShot(shot.index, { voiceover: e.target.value })}
                    />
                  </div>
                </td>
                {!hideStatusColumn ? (
                  <td className={`px-3 py-2 ${status.className}`}>{status.label}</td>
                ) : null}
                {showRowActions ? (
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-lg text-[#86868b] transition hover:bg-[#fff5f5] hover:text-[#ff3b30] disabled:cursor-not-allowed disabled:opacity-30"
                      disabled={disabled || !deletable || shots.length <= 1}
                      title={
                        !deletable
                          ? isGenerating
                            ? "生成中不可删除"
                            : "已出片不可删除"
                          : "删除本镜"
                      }
                      aria-label={`删除镜 ${shot.index}`}
                      onClick={() => onDeleteRow?.(shot.index)}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                ) : null}
              </tr>
              {isGenerating ? (
                <tr aria-hidden="true" className="pointer-events-none border-0">
                  <td colSpan={columnCount} className="border-0 px-3 py-0">
                    <div className="flex justify-center pb-2 pt-0.5">
                      <div
                        className="ecom-upload-progress ecom-upload-progress-indeterminate h-0.5 w-40 overflow-hidden rounded-full bg-[#e8e8ed]"
                        role="progressbar"
                        aria-label={`镜 ${shot.index} 生成中`}
                      >
                        <span />
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null}
              </Fragment>
            );
          })}
        </tbody>
        {showGenerateActions || showRowActions || showVoiceoverDraftActions || onBatchTtsSelected || onBatchComposeSelected ? (
          <tfoot>
            <tr className="border-t border-[#e8e8ed] bg-[#fafafa]">
              <td colSpan={columnCount} className="px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {showGenerateActions ? (
                    <EcomButtonSecondary
                      type="button"
                      size="sm"
                      className="min-w-[9rem] px-6"
                      disabled={generateSelectedDisabled}
                      onClick={() => onGenerateSelected?.()}
                    >
                      {generateLabel}
                    </EcomButtonSecondary>
                  ) : null}
                  {onBatchTtsSelected ? (
                    <EcomButtonSecondary
                      type="button"
                      size="sm"
                      className="min-w-[9rem] px-6"
                      disabled={batchTtsDisabled}
                      onClick={() => onBatchTtsSelected()}
                    >
                      {batchTtsLabel}
                    </EcomButtonSecondary>
                  ) : null}
                  {onBatchComposeSelected ? (
                    <EcomButtonPrimary
                      type="button"
                      size="sm"
                      className="min-w-[9rem] px-6"
                      disabled={batchComposeDisabled}
                      onClick={() => onBatchComposeSelected()}
                    >
                      {batchComposeLabel}
                    </EcomButtonPrimary>
                  ) : null}
                  {showVoiceoverDraftActions && onApplyAllVoiceoverDrafts ? (
                    <EcomButtonSecondary
                      type="button"
                      size="sm"
                      disabled={disabled}
                      onClick={() => void onApplyAllVoiceoverDrafts()}
                    >
                      全部应用新口播 ({voiceoverDraftCount})
                    </EcomButtonSecondary>
                  ) : null}
                  {showRowActions ? (
                    <EcomButtonSecondary
                      type="button"
                      size="sm"
                      disabled={disabled}
                      onClick={() => onAddRow?.()}
                    >
                      <Plus className="mr-1 inline size-3.5" />
                      增加镜头
                    </EcomButtonSecondary>
                  ) : null}
                </div>
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
