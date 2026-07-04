"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Box,
  Check,
  ChevronDown,
  Dices,
  ImageIcon,
  PanelsTopLeft,
  Pickaxe,
  SlidersHorizontal,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";

import { QrImageUploadZone } from "@/components/quick-replica/qr-image-upload-zone";
import { extractImageFilesFromClipboard } from "@/lib/qr-image-upload-paste";
import {
  QR_DEFAULT_WORLD_MODEL_KEY,
  QR_WORLD_MODEL_OPTIONS,
  QR_WORLD_REF_VIEWS,
  resolveWorldModelOption,
  resolveWorldModelOptionById,
  resolveWorldRefAzimuth,
  type QrWorldModelOption,
} from "@/lib/qr-world-model-options";
import type { QrTemplate, QrWorkspaceDraft } from "@/lib/qr-template-types";
import { uploadQrAsset } from "@/lib/qr-upload-asset";
import { useLockBodyScroll } from "@/lib/use-lock-body-scroll";

const MAX_REF_IMAGES = 8;

/** 弹层宽度 ≈ 屏幕 1/3，整体 16:9 */
const OMNIBOX_SHELL_CLASS =
  "w-[33.333vw] max-w-[960px] min-w-[min(100%,400px)]";

type WorldInputMode = "2d" | "3d";

type Props = {
  draft: QrWorkspaceDraft;
  onDraftChange: (draft: QrWorkspaceDraft) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  generating: boolean;
  presetTemplates?: QrTemplate[];
  onToast?: (message: string) => void;
  onGenerate: () => void;
  /** 场景 viewer 打开时需高于 z-[100] */
  overlayZIndex?: number;
};

export function QrWorldPromptOmnibox({
  draft,
  onDraftChange,
  expanded,
  onExpandedChange,
  generating,
  presetTemplates = [],
  onToast,
  onGenerate,
  overlayZIndex = 60,
}: Props) {
  const collapsedRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptCardRef = useRef<HTMLDivElement>(null);

  const [inputMode, setInputMode] = useState<WorldInputMode>("2d");
  const [modelOpen, setModelOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const selectedModel = resolveWorldModelOption(
    draft.modelKey.trim() || QR_DEFAULT_WORLD_MODEL_KEY,
  );
  const refUrls = draft.sceneImageUrls.filter((u) => u.trim());
  const thumbUrl = refUrls[0] ?? (draft.targetImageUrl.trim() || undefined);
  const canGenerate = Boolean(draft.prompt.trim() || refUrls.length > 0);

  useLockBodyScroll(expanded);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!expanded) {
      setModelOpen(false);
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      const panel = panelRef.current;
      const collapsed = collapsedRef.current;
      const target = event.target as Node;
      if (panel?.contains(target) || collapsed?.contains(target)) return;
      onExpandedChange(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [expanded, onExpandedChange]);

  useEffect(() => {
    if (!modelOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (modelMenuRef.current?.contains(target)) return;
      if (modelButtonRef.current?.contains(target)) return;
      setModelOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [modelOpen]);

  const patchDraft = useCallback(
    (patch: Partial<QrWorkspaceDraft>) => {
      onDraftChange({ ...draft, ...patch });
    },
    [draft, onDraftChange],
  );

  const pickModel = (option: QrWorldModelOption) => {
    patchDraft({ modelKey: option.modelKey });
    setModelOpen(false);
  };

  const handleUploadFiles = async (files: File[]) => {
    const room = MAX_REF_IMAGES - refUrls.length;
    if (room <= 0) {
      onToast?.(`最多 ${MAX_REF_IMAGES} 张参考图`);
      return;
    }
    setUploading(true);
    try {
      const next = [...refUrls];
      const azimuths = [...(draft.worldRefAzimuths ?? [])];
      for (const file of files.slice(0, room)) {
        const url = await uploadQrAsset(file, "image");
        next.push(url);
        azimuths.push(resolveWorldRefAzimuth(next.length - 1));
      }
      patchDraft({ sceneImageUrls: next, worldRefAzimuths: azimuths });
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const removeRef = (index: number) => {
    const nextUrls = refUrls.filter((_, i) => i !== index);
    const nextAz = (draft.worldRefAzimuths ?? []).filter((_, i) => i !== index);
    patchDraft({ sceneImageUrls: nextUrls, worldRefAzimuths: nextAz });
  };

  const setRefAzimuth = (index: number, azimuth: number) => {
    const next = [...(draft.worldRefAzimuths ?? [])];
    while (next.length < refUrls.length) {
      next.push(resolveWorldRefAzimuth(next.length));
    }
    next[index] = azimuth;
    patchDraft({ worldRefAzimuths: next });
  };

  const handlePromptPaste = (event: React.ClipboardEvent) => {
    const files = extractImageFilesFromClipboard(event);
    if (!files.length) return;
    event.preventDefault();
    void handleUploadFiles(files);
  };

  const rollPrompt = () => {
    const pool = presetTemplates
      .map((t) => t.reference.prompt.text.trim())
      .filter(Boolean);
    if (!pool.length) {
      onToast?.("暂无可用预设");
      return;
    }
    patchDraft({ prompt: pool[Math.floor(Math.random() * pool.length)]! });
    onExpandedChange(true);
  };

  const clearInput = () => {
    patchDraft({
      prompt: "",
      sceneImageUrls: [],
      targetImageUrl: "",
      worldRefAzimuths: [],
      worldAutoLayout: false,
    });
  };

  const collapsedBar = (
    <button
      type="button"
      onClick={() => onExpandedChange(true)}
      className="omnibox-container relative flex w-full items-center gap-2 rounded-lg border px-4 py-3 text-left transition hover:border-white/20"
      style={{ borderColor: "var(--qr-border)" }}
    >
      {thumbUrl ? (
        <div className="flex shrink-0">
          <div className="h-6 w-6 overflow-hidden rounded-sm border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
          </div>
          {refUrls.length > 1 ? (
            <span className="ml-1 self-center text-[10px] text-[var(--qr-text-muted)]">
              +{refUrls.length - 1}
            </span>
          ) : null}
        </div>
      ) : null}
      <span
        className={`line-clamp-1 min-w-0 flex-1 text-sm font-medium ${
          draft.prompt.trim() ? "text-[var(--qr-text-primary)]" : "text-[var(--qr-text-muted)]"
        }`}
      >
        {draft.prompt.trim() || "想象一个世界…"}
      </span>
      <span
        className="relative flex shrink-0 items-center justify-center text-[var(--qr-text-secondary)]"
        aria-hidden
      >
        <SlidersHorizontal className="h-4 w-4" />
      </span>
    </button>
  );

  const actionPills = (
    <div className="pointer-events-auto flex flex-wrap justify-center gap-0.5">
      <button
        type="button"
        className="group flex w-fit items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 text-sm text-[var(--qr-text-secondary)] backdrop-blur transition hover:text-[var(--qr-text-primary)]"
        onClick={() => onExpandedChange(true)}
      >
        <PanelsTopLeft className="h-4 w-4" />
        <span>预设</span>
      </button>
      <button
        type="button"
        disabled={!presetTemplates.length}
        className="group flex w-fit items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 text-sm text-[var(--qr-text-secondary)] backdrop-blur transition hover:text-[var(--qr-text-primary)] disabled:opacity-50"
        onClick={rollPrompt}
      >
        <Dices className="h-4 w-4" />
        <span>随机灵感</span>
      </button>
      <button
        type="button"
        className="group flex w-fit items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-sm text-[var(--qr-text-secondary)] backdrop-blur transition hover:text-[var(--qr-text-primary)]"
        onClick={clearInput}
      >
        <X className="h-4 w-4" />
        <span>清空</span>
      </button>
    </div>
  );

  const refThumbRow = refUrls.length > 0 && (
    <div className="mt-3 flex flex-wrap gap-2">
      {refUrls.map((url, i) => {
        const azimuth = resolveWorldRefAzimuth(i, draft.worldRefAzimuths?.[i]);
        const viewLabel =
          QR_WORLD_REF_VIEWS.find((v) => v.azimuth === azimuth)?.label ??
          QR_WORLD_REF_VIEWS[i % QR_WORLD_REF_VIEWS.length]!.label;
        return (
          <div key={`${url}-${i}`} className="flex flex-col items-center gap-1">
            <div className="group relative h-10 w-10 overflow-hidden rounded-md border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="移除参考图"
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/80 text-white opacity-0 shadow transition group-hover:opacity-100"
                onClick={() => removeRef(i)}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
            {refUrls.length > 1 ? (
              <select
                value={String(azimuth)}
                onChange={(e) => setRefAzimuth(i, Number(e.target.value))}
                className="max-w-[4.5rem] truncate rounded bg-white/[0.06] px-1 py-0.5 text-[10px] text-[var(--qr-text-secondary)] outline-none"
                aria-label={`参考图 ${i + 1} 方位`}
              >
                {QR_WORLD_REF_VIEWS.map((v) => (
                  <option key={v.id} value={v.azimuth}>
                    {v.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[10px] text-[var(--qr-text-muted)]">{viewLabel}</span>
            )}
          </div>
        );
      })}
      {refUrls.length < MAX_REF_IMAGES ? (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-white/15 text-[var(--qr-text-muted)] transition hover:border-white/30 hover:text-[var(--qr-text-primary)] disabled:opacity-50"
          aria-label="添加参考图"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );

  const modelDropdown = (
    <div className="relative">
      <button
        ref={modelButtonRef}
        type="button"
        onClick={() => setModelOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm text-[var(--qr-text-primary)] transition hover:bg-white/[0.04]"
        style={{ borderColor: "var(--qr-border)" }}
      >
        {selectedModel.label}
        <ChevronDown className="h-4 w-4 text-[var(--qr-text-muted)]" />
      </button>
      {modelOpen ? (
        <div
          ref={modelMenuRef}
          className="absolute left-0 top-full z-40 mt-1 min-w-[240px] rounded-xl border p-1 shadow-xl"
          style={{
            borderColor: "var(--qr-border)",
            background: "var(--qr-bg-surface)",
          }}
        >
          {QR_WORLD_MODEL_OPTIONS.map((option) => {
            const active = option.modelKey === selectedModel.modelKey;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => pickModel(option)}
                className={`flex w-full items-start justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition ${
                  active ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`text-sm font-medium ${
                        option.legacy
                          ? "text-[var(--qr-text-muted)]"
                          : "text-[var(--qr-text-primary)]"
                      }`}
                    >
                      {option.label}
                    </span>
                    {option.badge ? (
                      <span className="rounded bg-violet-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {option.badge}
                      </span>
                    ) : null}
                  </div>
                  {option.subtitle ? (
                    <p className="mt-0.5 text-xs text-[var(--qr-text-muted)]">{option.subtitle}</p>
                  ) : null}
                </div>
                {active ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--qr-text-primary)]" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );

  const expandedPanel = (
    <div className="flex w-full flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setInputMode("2d")}
          className={`flex flex-col gap-1 rounded-xl border p-2.5 text-left transition ${
            inputMode === "2d"
              ? "border-white/20 bg-white/[0.08]"
              : "border-transparent bg-white/[0.03] hover:bg-white/[0.05]"
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--qr-text-primary)]">
            <ImageIcon className="h-4 w-4" />
            2D 输入
          </div>
          <p className="text-xs leading-relaxed text-[var(--qr-text-muted)]">
            添加图片、视频或全景图来生成世界
          </p>
        </button>
        <button
          type="button"
          onClick={() => setInputMode("3d")}
          className={`relative flex flex-col gap-1 rounded-xl border p-2.5 text-left transition ${
            inputMode === "3d"
              ? "border-white/20 bg-white/[0.08]"
              : "border-transparent bg-white/[0.03] hover:bg-white/[0.05]"
          }`}
        >
          <span className="absolute right-2 top-2 rounded bg-orange-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
            Beta
          </span>
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--qr-text-primary)]">
            <Box className="h-4 w-4" />
            3D 输入
          </div>
          <p className="text-xs leading-relaxed text-[var(--qr-text-muted)]">
            用 3D 模型与基础体块搭建场景布局
          </p>
        </button>
      </div>

      {inputMode === "2d" ? (
        <>
          <div
            ref={promptCardRef}
            className="rounded-xl border p-3"
            style={{ borderColor: "var(--qr-border)", background: "var(--qr-bg-surface)" }}
            onPaste={handlePromptPaste}
          >
            <div className="flex gap-2">
              <textarea
                value={draft.prompt}
                onChange={(e) => patchDraft({ prompt: e.target.value })}
                onPaste={handlePromptPaste}
                rows={3}
                placeholder="描述你想创造的世界…"
                className="min-h-[72px] min-w-0 flex-1 resize-y bg-transparent text-sm leading-relaxed text-[var(--qr-text-primary)] placeholder:text-[var(--qr-text-muted)] focus:outline-none"
              />
              <button
                type="button"
                className="shrink-0 self-start p-1 text-[var(--qr-text-secondary)] hover:text-[var(--qr-text-primary)]"
                aria-label="高级设置"
                onClick={() => onToast?.("高级参数即将推出")}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </div>

            {refThumbRow}

            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <p className="text-[10px] text-[var(--qr-text-muted)]">
                支持 Ctrl+V / ⌘V 粘贴图片
              </p>
              <div className="flex items-center gap-2">
                {modelDropdown}
                <button
                  type="button"
                  disabled={generating || !canGenerate}
                  onClick={onGenerate}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
                  style={{ background: "var(--qr-brand)" }}
                >
                  <Wand2 className="h-4 w-4" />
                  生成
                </button>
              </div>
            </div>
          </div>

          {refUrls.length >= 2 ? (
            <label
              className="flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition hover:bg-white/[0.03]"
              style={{ borderColor: "var(--qr-border)" }}
            >
              <input
                type="checkbox"
                checked={draft.worldAutoLayout ?? false}
                onChange={(e) => patchDraft({ worldAutoLayout: e.target.checked })}
                className="mt-0.5"
              />
              <span>
                <span className="text-sm font-medium text-[var(--qr-text-primary)]">Auto Layout</span>
                <span className="mt-0.5 block text-xs text-[var(--qr-text-muted)]">
                  基于同一空间的多视角参考图生成连贯场景
                </span>
              </span>
            </label>
          ) : null}

          <div
            className="rounded-xl border border-dashed transition hover:border-white/25"
            style={{ borderColor: "var(--qr-border)" }}
          >
            <QrImageUploadZone
              className="rounded-xl p-4"
              disabled={uploading || refUrls.length >= MAX_REF_IMAGES}
              onFiles={handleUploadFiles}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (files.length) void handleUploadFiles(files);
                }}
              />
              <button
                type="button"
                disabled={uploading || refUrls.length >= MAX_REF_IMAGES}
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 text-center disabled:opacity-50"
              >
                <Sparkles className="h-6 w-6 text-[var(--qr-text-muted)]" />
                <p className="text-sm font-medium text-[var(--qr-text-primary)]">
                  最多添加 {MAX_REF_IMAGES} 张参考图以补充视觉细节
                </p>
                <p className="max-w-sm text-xs text-[var(--qr-text-muted)]">
                  系统会自动拼接参考图，生成更连贯的场景
                </p>
                {uploading ? (
                  <p className="text-xs text-[var(--qr-brand)]">上传中…</p>
                ) : null}
              </button>
            </QrImageUploadZone>
          </div>
        </>
      ) : (
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: "var(--qr-border)", background: "var(--qr-bg-surface)" }}
        >
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-medium text-[var(--qr-text-primary)]">
              用 Chisel 定义 3D 布局
            </h3>
            <span className="rounded bg-orange-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
              Beta
            </span>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-[var(--qr-text-muted)]">
            导入 3D 文件或使用内置基础体块搭建布局，再据此生成世界。
          </p>
          <textarea
            value={draft.prompt}
            onChange={(e) => patchDraft({ prompt: e.target.value })}
            rows={4}
            placeholder="描述 3D 场景布局与氛围…"
            className="mb-3 w-full resize-y rounded-lg border bg-black/20 px-3 py-2 text-sm leading-relaxed text-[var(--qr-text-primary)] placeholder:text-[var(--qr-text-muted)] focus:outline-none"
            style={{ borderColor: "var(--qr-border)" }}
          />
          <div className="flex justify-end">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ background: "var(--qr-brand)" }}
              onClick={() => onToast?.("Chisel 3D 编辑器即将推出")}
            >
              <Pickaxe className="h-4 w-4" />
              启动 Chisel
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const expandedOverlay =
    mounted && expanded
      ? createPortal(
          <div
            className="fixed inset-0 flex items-start justify-center overflow-hidden bg-black/45 px-3 pb-6 pt-[72px] backdrop-blur-sm"
            style={{ zIndex: overlayZIndex }}
            role="presentation"
          >
            <div
              ref={panelRef}
              className={`flex flex-col overflow-hidden rounded-xl border shadow-2xl backdrop-blur ${OMNIBOX_SHELL_CLASS}`}
              style={{
                borderColor: "var(--qr-border)",
                background: "color-mix(in srgb, var(--qr-bg-surface) 95%, transparent)",
                aspectRatio: "16 / 9",
                maxHeight: "min(calc(33.333vw * 9 / 16), calc(100vh - 6rem))",
              }}
            >
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                {expandedPanel}
              </div>
            </div>
            <div
              className="pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2"
              style={{ zIndex: overlayZIndex + 1 }}
            >
              <div className="pointer-events-auto">{actionPills}</div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={collapsedRef} className="flex w-full flex-col items-center gap-2">
        <div
          className={`${OMNIBOX_SHELL_CLASS} rounded-xl p-2 shadow-2xl backdrop-blur transition-opacity duration-150 ease-out ${
            expanded ? "pointer-events-none opacity-0" : "bg-[var(--qr-bg-surface)]/90"
          }`}
          aria-hidden={expanded}
        >
          {collapsedBar}
        </div>
        {!expanded ? actionPills : null}
      </div>
      {expandedOverlay}
    </>
  );
}
