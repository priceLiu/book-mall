"use client";

import { Cpu, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  canSubmitBackgroundReplace,
  isWanxBackgroundReplaceModel,
  type BackgroundReplaceEdgeDraft,
  type BackgroundReplaceFormState,
} from "@/lib/background-replace-types";
import { cn } from "@/lib/utils";

type Props = {
  form: BackgroundReplaceFormState;
  busy: boolean;
  hasBase: boolean;
  subjectHint?: string;
  modelDisplayName?: string;
  onPickModel: () => void;
  onChange: (next: BackgroundReplaceFormState) => void;
  onUploadRefImage: (file: File) => Promise<string>;
  onSubmit: () => void;
};

function EdgeList({
  label,
  items,
  disabled,
  onChange,
  onUpload,
}: {
  label: string;
  items: BackgroundReplaceEdgeDraft[];
  disabled: boolean;
  onChange: (next: BackgroundReplaceEdgeDraft[]) => void;
  onUpload: (file: File) => Promise<string>;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[#374151]">{label}</p>
        <EcomButtonSecondary
          type="button"
          size="sm"
          disabled={disabled || items.length >= 10}
          onClick={() => onChange([...items, { url: "", prompt: "" }])}
        >
          <Plus className="h-3.5 w-3.5" />
          添加
        </EcomButtonSecondary>
      </div>
      {items.map((item, index) => (
        <div key={`${label}-${index}`} className="rounded-lg border border-[#e5e7eb] p-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="text-[11px] text-[#6b7280]">
              边缘图
              <input
                type="file"
                accept="image/png"
                disabled={disabled}
                className="mt-1 block w-full text-xs"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void onUpload(file).then((url) => {
                    const next = [...items];
                    next[index] = { ...item, url };
                    onChange(next);
                  });
                }}
              />
            </label>
            <button
              type="button"
              className="text-[#ff3b30]"
              disabled={disabled}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {item.url ? (
            <p className="truncate text-[11px] text-[#6b7280]">{item.url}</p>
          ) : null}
          <input
            className="mt-1 w-full rounded-md border border-[#e5e7eb] px-2 py-1 text-xs"
            placeholder="对应 prompt，可空"
            disabled={disabled}
            value={item.prompt}
            onChange={(e) => {
              const next = [...items];
              next[index] = { ...item, prompt: e.target.value };
              onChange(next);
            }}
          />
        </div>
      ))}
    </div>
  );
}

export function BackgroundReplacePanel({
  form,
  busy,
  hasBase,
  subjectHint,
  modelDisplayName,
  onPickModel,
  onChange,
  onUploadRefImage,
  onSubmit,
}: Props) {
  const canSubmit = canSubmitBackgroundReplace(form, hasBase);
  const wanx = isWanxBackgroundReplaceModel(form.modelKey);

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-[#6b7280]">
        {subjectHint ??
          (wanx
            ? "万相会先抠出人物，再在透明区画新场景。"
            : "可先框选背景再写场景（更稳），也可以只写场景描述。")}
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={onPickModel}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-left",
          "transition hover:border-[#2563eb]/40 hover:bg-[#f0f6ff]/50",
          busy && "opacity-60",
        )}
      >
        <Cpu className="h-4 w-4 shrink-0 text-[#2563eb]" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-[#6b7280]">换背景模型</p>
          <p className="truncate text-sm font-medium text-[#111827]">
            {modelDisplayName ?? form.modelKey}
          </p>
        </div>
      </button>

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-[#374151]">场景描述</span>
        <textarea
          rows={3}
          disabled={busy}
          value={form.refPrompt}
          placeholder="例如：咖啡馆暖光、大理石桌面"
          onChange={(e) => onChange({ ...form, refPrompt: e.target.value })}
          className="w-full resize-none rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
        />
      </label>

      {wanx ? (
      <div>
        <p className="mb-1 text-xs font-medium text-[#374151]">引导图（可选）</p>
        <label
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#d2d2d7] px-3 py-2 text-xs text-[#6b7280]",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <ImagePlus className="h-4 w-4" />
          {form.refImageUrl ? "已选引导图，点击更换" : "上传风格参考图"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void onUploadRefImage(file).then((url) =>
                onChange({ ...form, refImageUrl: url }),
              );
            }}
          />
        </label>
        {form.refImageUrl ? (
          <img
            src={form.refImageUrl}
            alt=""
            className="mt-2 max-h-28 rounded-lg border border-[#e5e7eb] object-contain"
          />
        ) : null}
      </div>
      ) : null}

      {wanx ? (
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-[#374151]">负向提示（可选）</span>
        <input
          disabled={busy}
          value={form.negRefPrompt}
          placeholder="低质量、模糊、变形"
          onChange={(e) => onChange({ ...form, negRefPrompt: e.target.value })}
          className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
        />
      </label>
      ) : null}

      {wanx ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-[#374151]">模型版本</span>
              <select
                disabled={busy}
                value={form.modelVersion}
                onChange={(e) =>
                  onChange({ ...form, modelVersion: e.target.value === "v2" ? "v2" : "v3" })
                }
                className="w-full rounded-lg border border-[#e5e7eb] px-2 py-1.5"
              >
                <option value="v3">v3 效果更好</option>
                <option value="v2">v2 更快</option>
              </select>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-[#374151]">生成张数</span>
              <select
                disabled={busy}
                value={String(form.n)}
                onChange={(e) => onChange({ ...form, n: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#e5e7eb] px-2 py-1.5"
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
            </label>
          </div>

          {form.refImageUrl ? (
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-[#374151]">
                引导图随机度 {form.noiseLevel}
              </span>
              <input
                type="range"
                min={0}
                max={999}
                disabled={busy}
                value={form.noiseLevel}
                onChange={(e) =>
                  onChange({ ...form, noiseLevel: Number(e.target.value) })
                }
                className="w-full"
              />
            </label>
          ) : null}

          {form.refPrompt.trim() && form.refImageUrl ? (
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-[#374151]">
                文本权重 {form.refPromptWeight.toFixed(2)}
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                disabled={busy}
                value={form.refPromptWeight}
                onChange={(e) =>
                  onChange({ ...form, refPromptWeight: Number(e.target.value) })
                }
                className="w-full"
              />
            </label>
          ) : null}

          <details className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-[#374151]">
              高级 · 边缘引导元素
            </summary>
            <p className="mt-2 text-[11px] text-[#9ca3af]">
              须为透明底边缘图（HED），前景+背景合计最多 10 张。
            </p>
            <div className="mt-2 space-y-3">
              <EdgeList
                label="前景边缘"
                items={form.foregroundEdges}
                disabled={busy}
                onChange={(foregroundEdges) => onChange({ ...form, foregroundEdges })}
                onUpload={onUploadRefImage}
              />
              <EdgeList
                label="背景边缘"
                items={form.backgroundEdges}
                disabled={busy}
                onChange={(backgroundEdges) => onChange({ ...form, backgroundEdges })}
                onUpload={onUploadRefImage}
              />
            </div>
          </details>
        </>
      ) : null}

      <div className="sticky bottom-0 border-t border-[#e5e7eb] bg-white pt-3">
        <EcomButtonPrimary
          type="button"
          fullWidth
          className="!max-w-none"
          disabled={busy || !canSubmit}
          onClick={onSubmit}
        >
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          开始换背景
        </EcomButtonPrimary>
      </div>
    </div>
  );
}
