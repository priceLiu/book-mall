"use client";

import { ChevronDown, ChevronUp, ImageIcon, Loader2, Save, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import type { ReplicaVoiceoverDraft } from "@/lib/media-decompose-replica-workflow";
import { cn } from "@/lib/utils";

type RefSlotProps = {
  label: string;
  url?: string;
  previewUrl?: string;
  uploading?: boolean;
  generating?: boolean;
  required?: boolean;
};

function ReplicaRefSlot({
  label,
  url,
  previewUrl,
  uploading,
  generating,
  required,
}: RefSlotProps) {
  const displayUrl = url?.trim() || previewUrl;
  const busy = uploading || generating;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <p className="text-[11px] font-medium text-[#6e6e73]">
        {label}
        {required ? <span className="text-[#c0392b]"> *</span> : null}
      </p>
      <div
        className={cn(
          "relative aspect-[3/4] w-full max-w-[9.5rem] overflow-hidden rounded-xl border bg-[#f5f5f7]",
          displayUrl ? "border-[#d2d2d7]" : "border-dashed border-[#c7c7cc]",
          busy && "ecom-media-generating-sweep",
        )}
        aria-busy={busy || undefined}
      >
        {displayUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={displayUrl} alt={label} className="size-full object-cover" />
            {busy ? (
              <EcomMediaGeneratingBusy
                label={generating ? "AI 生成中…" : "上传中…"}
              />
            ) : null}
          </>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1.5 px-2 text-center">
            <ImageIcon className="h-6 w-6 text-[#aeaeb2]" aria-hidden />
            <span className="text-[10px] leading-tight text-[#86868b]">待上传</span>
          </div>
        )}
      </div>
    </div>
  );
}

type RefGridProps = {
  modelUrl?: string;
  productUrl?: string;
  modelPreviewUrl?: string;
  productPreviewUrl?: string;
  uploadingRole?: "model" | "product" | null;
  modelGenerating?: boolean;
};

/** 内容区 · 模特 / 产品参考图占位 */
export function ReplicaRefSlotGrid({
  modelUrl,
  productUrl,
  modelPreviewUrl,
  productPreviewUrl,
  uploadingRole,
  modelGenerating,
}: RefGridProps) {
  return (
    <div className="rounded-xl border border-[#e8e8ed] bg-white p-4">
      <p className="mb-3 text-xs font-semibold text-[#1d1d1f]">复刻参考图</p>
      <div className="flex flex-wrap gap-4">
        <ReplicaRefSlot
          label="模特 @图片1"
          url={modelUrl}
          previewUrl={modelPreviewUrl}
          uploading={uploadingRole === "model" && !modelGenerating}
          generating={modelGenerating}
          required
        />
        <ReplicaRefSlot
          label="产品 @图片2"
          url={productUrl}
          previewUrl={productPreviewUrl}
          uploading={uploadingRole === "product"}
          required
        />
      </div>
    </div>
  );
}

type ProductBriefCardProps = {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void | Promise<void>;
  onRecognize?: () => void | Promise<void>;
  saving?: boolean;
  recognizing?: boolean;
  disabled?: boolean;
  recognizeDisabled?: boolean;
  dirty?: boolean;
};

/** 内容区 · 产品描述（识产品结果可编辑保存） */
export function ReplicaProductBriefCard({
  value,
  onChange,
  onSave,
  onRecognize,
  saving,
  recognizing,
  disabled,
  recognizeDisabled,
  dirty,
}: ProductBriefCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[#e8e8ed] bg-white p-4",
        recognizing && "ecom-media-generating-sweep",
      )}
      aria-busy={recognizing || undefined}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[#1d1d1f]">产品描述</p>
          <p className="text-[11px] text-[#6e6e73]">
            根据产品图 AI 识别，或结合已填文字润色补全；确认后保存并用于生成复刻脚本。
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {onRecognize ? (
            <EcomButtonSecondary
              size="sm"
              type="button"
              disabled={disabled || saving || recognizing || recognizeDisabled}
              className="h-7 px-2 text-[10px]"
              onClick={() => void onRecognize()}
            >
              {recognizing ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3 shrink-0" />
              )}
              AI 识别产品
            </EcomButtonSecondary>
          ) : null}
          <EcomButtonSecondary
            size="sm"
            type="button"
            disabled={disabled || saving || recognizing || !dirty}
            className="h-7 px-2 text-[10px]"
            onClick={() => void onSave()}
          >
            {saving ? (
              <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
            ) : (
              <Save className="h-3 w-3 shrink-0" />
            )}
            保存
          </EcomButtonSecondary>
        </div>
      </div>
      <div className="relative">
        <textarea
          value={value}
          disabled={disabled || saving || recognizing}
          rows={6}
          placeholder="例如：产品：驼色无袖收腰大摆长款连衣裙&#10;品类：女装/连衣裙&#10;材质/工艺：…"
          className="w-full resize-y rounded-lg border border-[#d2d2d7] bg-[#fafafa] px-3 py-2.5 text-sm leading-relaxed text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[#0071e3] focus:bg-white focus:ring-2 focus:ring-[#0071e3]/20 disabled:opacity-60"
          onChange={(e) => onChange(e.target.value)}
        />
        {recognizing ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-white/70 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-full border border-[#e8e8ed] bg-white px-3 py-1.5 text-xs font-medium text-[#1d1d1f] shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--ecom-chrome-accent)]" />
              AI 识产品中…
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type SellingPointsCardProps = {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void | Promise<void>;
  onGenerate?: () => void | Promise<void>;
  onGenerateVoiceover?: () => void | Promise<void>;
  saving?: boolean;
  generating?: boolean;
  voiceoverGenerating?: boolean;
  disabled?: boolean;
  generateDisabled?: boolean;
  voiceoverDisabled?: boolean;
  dirty?: boolean;
  showVoiceover?: boolean;
};

/** 内容区 · 卖点（可选单行/短段） */
export function ReplicaSellingPointsCard({
  value,
  onChange,
  onSave,
  onGenerate,
  onGenerateVoiceover,
  saving,
  generating,
  voiceoverGenerating,
  disabled,
  generateDisabled,
  voiceoverDisabled,
  dirty,
  showVoiceover = false,
}: SellingPointsCardProps) {
  const generateLabel = value.trim() ? "AI 润色卖点" : "AI 生成卖点";
  return (
    <div
      className={cn(
        "rounded-xl border border-[#e8e8ed] bg-white p-4",
        generating && "ecom-media-generating-sweep",
      )}
      aria-busy={generating || voiceoverGenerating || undefined}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[#1d1d1f]">卖点</p>
          <p className="text-[11px] text-[#6e6e73]">可选；用于脚本与口播生成。不填也可继续，AI 可后续补全。</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {onGenerate ? (
            <EcomButtonSecondary
              size="sm"
              type="button"
              disabled={disabled || saving || generating || voiceoverGenerating || generateDisabled}
              className="h-7 px-2 text-[10px]"
              onClick={() => void onGenerate()}
            >
              {generating ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3 shrink-0" />
              )}
              {generateLabel}
            </EcomButtonSecondary>
          ) : null}
          {showVoiceover && onGenerateVoiceover ? (
            <EcomButtonSecondary
              size="sm"
              type="button"
              disabled={
                disabled || saving || generating || voiceoverGenerating || voiceoverDisabled
              }
              className="h-7 px-2 text-[10px]"
              onClick={() => void onGenerateVoiceover()}
            >
              {voiceoverGenerating ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3 shrink-0" />
              )}
              AI 口播方案
            </EcomButtonSecondary>
          ) : null}
          {onSave ? (
            <EcomButtonSecondary
              size="sm"
              type="button"
              disabled={disabled || saving || generating || voiceoverGenerating || !dirty}
              className="h-7 px-2 text-[10px]"
              onClick={() => void onSave()}
            >
              {saving ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
              ) : (
                <Save className="h-3 w-3 shrink-0" />
              )}
              保存
            </EcomButtonSecondary>
          ) : null}
        </div>
      </div>
      <input
        type="text"
        value={value}
        disabled={disabled || saving || generating || voiceoverGenerating}
        placeholder="例如：轻薄透气、莫兰迪配色、通勤百搭（可不填）"
        className="w-full rounded-lg border border-[#d2d2d7] bg-[#fafafa] px-3 py-2 text-sm text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[#0071e3] focus:bg-white focus:ring-2 focus:ring-[#0071e3]/20 disabled:opacity-60"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** 内容区 · AI 口播方案（默认折叠，展开为紧凑列表） */
export function ReplicaVoiceoverDraftCard({
  draft,
}: {
  draft: ReplicaVoiceoverDraft;
}) {
  const [expanded, setExpanded] = useState(false);
  const filledCount = useMemo(
    () => draft.shots.filter((s) => s.voiceover.trim()).length,
    [draft.shots],
  );
  const preview = useMemo(() => {
    const first = draft.shots.find((s) => s.voiceover.trim());
    return first?.voiceover.trim() ?? "";
  }, [draft.shots]);

  return (
    <div className="rounded-xl border border-[#e8e8ed] bg-white px-3 py-2.5">
      <button
        type="button"
        className="flex w-full items-start gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-xs font-semibold text-[#1d1d1f]">AI 口播方案</p>
            <span className="text-[10px] text-[#86868b]">
              {filledCount}/{draft.shots.length} 段
            </span>
          </div>
          {!expanded && preview ? (
            <p className="mt-0.5 truncate text-[11px] leading-snug text-[#6e6e73]">{preview}</p>
          ) : !expanded ? (
            <p className="mt-0.5 text-[10px] text-[#86868b]">点击展开各段口播</p>
          ) : null}
        </div>
        {expanded ? (
          <ChevronUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#86868b]" aria-hidden />
        ) : (
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#86868b]" aria-hidden />
        )}
      </button>
      {expanded ? (
        <div
          className={cn(
            "mt-2 max-h-36 overflow-y-auto rounded-lg border border-[#e8e8ed] bg-[#fafafa]",
            "divide-y divide-[#ececef]",
          )}
        >
          {draft.shots.map((row) => (
            <div key={row.index} className="flex gap-2 px-2 py-1.5 text-[11px] leading-snug">
              <span className="w-7 shrink-0 font-medium tabular-nums text-[#86868b]">
                段{row.index}
              </span>
              <span className="min-w-0 flex-1 text-[#1d1d1f]">
                {row.voiceover.trim() || "—"}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-1.5 text-[10px] leading-snug text-[#aeaeb2]">
        生成复刻脚本后，可在分镜表口播列「应用新口播」。
      </p>
    </div>
  );
}

type AttachmentTileProps = {
  url: string;
  label?: string;
  status?: "uploading" | "done" | "error";
};

/** 对话气泡内 · 图片附件（含上传态） */
export function ReplicaAttachmentTile({ url, label, status }: AttachmentTileProps) {
  const uploading = status === "uploading";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-black/10 bg-black/5",
        uploading && "ecom-media-generating-sweep",
      )}
      aria-busy={uploading || undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label ?? "图片"} className="max-h-36 max-w-[11rem] object-cover" />
      {uploading ? <EcomMediaGeneratingBusy label="上传中…" /> : null}
      {label ? (
        <p className="px-2 py-1 text-[10px] leading-tight text-[#6e6e73]">{label}</p>
      ) : null}
    </div>
  );
}
