"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  Copy,
  FlipHorizontal2,
  FlipVertical2,
  Italic,
  Combine,
  Group,
  Link2,
  Loader2,
  RotateCcw,
  Ungroup,
  Strikethrough,
  Trash2,
  Type,
  Underline,
} from "lucide-react";

import {
  ECOM_COPY_FONT_PRESETS,
  normalizeCopyFontPresetId,
} from "@private/ecom-copy-overlay";
import type { EcomCopyOverlayLayer } from "@private/ecom-copy-overlay";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { ImageEditorHighlightControl, ImageEditorWarpControl } from "@/components/image-editor/image-editor-text-decor-panels";
import { ImageEditorTextEffectControl } from "@/components/image-editor/image-editor-text-effect-panel";
import {
  applyImageEditorTextLayout,
  groupTextLayers,
  isTextGrouped,
  layerPositionExportPx,
  layersSharingGroup,
  patchImageEditorTextExtras,
  patchImageEditorTextLayer,
  patchLayerPositionFromPx,
  resolveTextLayout,
  setTextLayersGrouped,
  type ImageEditorTextDocument,
  type ImageEditorTextLayerExtras,
  type ImageEditorTextLayout,
} from "@/lib/image-editor-text";
import { applyImageEditorTextEffect } from "@/lib/image-editor-text-effects";
import { cn } from "@/lib/utils";

type Props = {
  doc: ImageEditorTextDocument;
  selectedLayer: EcomCopyOverlayLayer | undefined;
  exportW: number;
  exportH: number;
  disabled?: boolean;
  onChange: (doc: ImageEditorTextDocument) => void;
  onDeleteLayer: (id: string) => void;
  onDuplicate?: () => void;
  onAiFlower?: () => void;
  onMergeLayers?: () => void | Promise<void>;
  onUngroupSelling?: (posterId: string, groupId: string) => Promise<void>;
  selectionIds?: string[];
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function ImageEditorTextInspector({
  doc,
  selectedLayer,
  exportW,
  exportH,
  disabled,
  onChange,
  onDeleteLayer,
  onDuplicate,
  onAiFlower,
  onMergeLayers,
  onUngroupSelling,
  selectionIds,
}: Props) {
  const { doubleConfirm } = useDialogs();

  const removeLayer = async () => {
    if (!selectedLayer) return;
    const ok = await doubleConfirm({
      title: "删除这段文字",
      message: "将从画布上移除当前文字块。",
      secondTitle: "确认删除",
      secondMessage: "删除后不可恢复。",
      confirmLabel: "删除",
    });
    if (!ok) return;
    onDeleteLayer(selectedLayer.id);
  };

  return (
    <aside className="flex h-full min-h-0 max-h-[46vh] w-full flex-col bg-[var(--ie-cream)] lg:max-h-none lg:rounded-xl lg:border lg:border-[var(--ie-border-soft)]">
      <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3">
        <Header
          title={selectedLayer && doc.extras[selectedLayer.id]?.groupId ? "组合 - 文字" : "文字"}
          disabled={disabled || !selectedLayer}
          onDuplicate={onDuplicate}
          onDelete={() => void removeLayer()}
        />
        {!selectedLayer ? (
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--ie-subtle)]">
            在左侧点「标题 / 副标题 / 正文」添加文字，或单击画布上的文字块，即可在此修改样式。
          </p>
        ) : (
          <InspectorBody
            doc={doc}
            layer={selectedLayer}
            exportW={exportW}
            exportH={exportH}
            disabled={disabled}
            onChange={onChange}
            onAiFlower={onAiFlower}
            onMergeLayers={onMergeLayers}
            onUngroupSelling={onUngroupSelling}
            selectionIds={selectionIds}
          />
        )}
      </div>
    </aside>
  );
}

function InspectorBody({
  doc,
  layer,
  exportW,
  exportH,
  disabled,
  onChange,
  onAiFlower,
  onMergeLayers,
  onUngroupSelling,
  selectionIds,
}: {
  doc: ImageEditorTextDocument;
  layer: EcomCopyOverlayLayer;
  exportW: number;
  exportH: number;
  disabled?: boolean;
  onChange: (doc: ImageEditorTextDocument) => void;
  onAiFlower?: () => void;
  onMergeLayers?: () => void | Promise<void>;
  onUngroupSelling?: (posterId: string, groupId: string) => Promise<void>;
  selectionIds?: string[];
}) {
  const { confirm, alert } = useDialogs();
  const [splitting, setSplitting] = useState(false);
  const extras = doc.extras[layer.id] ?? {};
  const grouped = isTextGrouped(extras);
  const family = extras.groupId ? layersSharingGroup(doc.overlay.layers, doc.extras, extras.groupId) : [layer];
  const picked = (selectionIds?.length ? selectionIds : [layer.id]).filter((id) =>
    doc.overlay.layers.some((item) => item.id === id),
  );
  const pickedGroups = new Set(picked.map((id) => doc.extras[id]?.groupId).filter(Boolean));
  const sameGroup = pickedGroups.size === 1 && picked.every((id) => doc.extras[id]?.groupId);
  const selectionGrouped = picked.length > 1 && sameGroup && picked.every((id) => isTextGrouped(doc.extras[id]));
  const canGroup = picked.length > 1 && !selectionGrouped;
  const showingUngroup = selectionGrouped || (grouped && Boolean(extras.groupId) && picked.length < 2);
  const targets = grouped ? family : [layer];
  const pos = layerPositionExportPx(layer, exportW, exportH);
  const widthPx = Math.round(layer.layoutBoxWidthPx && layer.layoutBoxWidthPx > 0 ? layer.layoutBoxWidthPx : pos.w);

  const patchLayer = (patch: Partial<EcomCopyOverlayLayer>) => {
    let next = doc;
    for (const item of targets) next = patchImageEditorTextLayer(next, item.id, patch);
    onChange(next);
  };
  const patchExtras = (patch: Partial<ImageEditorTextLayerExtras>) => {
    let next = doc;
    for (const item of targets) next = patchImageEditorTextExtras(next, item.id, patch);
    onChange(next);
  };
  const patchPos = (patch: Partial<{ x: number; y: number }>) => {
    if (!grouped) {
      onChange(patchLayerPositionFromPx(doc, layer.id, exportW, exportH, patch));
      return;
    }
    const current = layerPositionExportPx(layer, exportW, exportH);
    const dx = patch.x != null ? patch.x - current.x : 0;
    const dy = patch.y != null ? patch.y - current.y : 0;
    let next = doc;
    for (const item of targets) {
      const itemPos = layerPositionExportPx(item, exportW, exportH);
      next = patchLayerPositionFromPx(next, item.id, exportW, exportH, {
        x: itemPos.x + dx,
        y: itemPos.y + dy,
      });
    }
    onChange(next);
  };

  const layout = resolveTextLayout(layer, extras);
  const setLayout = (next: ImageEditorTextLayout) => {
    let updated = doc;
    for (const item of targets) updated = applyImageEditorTextLayout(updated, item.id, next, exportW, exportH);
    onChange(updated);
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || splitting}
          className={cn(
            "inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border text-[12px] font-medium",
            splitting ? "opacity-100" : "disabled:opacity-40",
            showingUngroup
              ? "border-[var(--ie-ink)] bg-transparent text-[var(--ie-ink)]"
              : "border-[var(--ie-ink)] bg-[var(--ie-ink)] text-[var(--ie-cream)]",
          )}
          onClick={() => {
            if (canGroup) {
              onChange(groupTextLayers(doc, picked));
              return;
            }
            const groupId = (pickedGroups.size === 1 ? ([...pickedGroups][0] as string) : extras.groupId) ?? "";
            if (showingUngroup && groupId) {
              const posterId = family.map((item) => doc.extras[item.id]?.sellingPosterId).find(Boolean);
              if (posterId && onUngroupSelling) {
                setSplitting(true);
                void onUngroupSelling(posterId, groupId).finally(() => setSplitting(false));
                return;
              }
              onChange(setTextLayersGrouped(doc, groupId, false));
              return;
            }
            if (groupId) {
              onChange(setTextLayersGrouped(doc, groupId, true));
              return;
            }
            onChange(groupTextLayers(doc, picked.length ? picked : [layer.id]));
          }}
        >
          {splitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : showingUngroup ? (
            <Ungroup className="h-3.5 w-3.5" />
          ) : (
            <Group className="h-3.5 w-3.5" />
          )}
          {splitting ? "拆分中" : showingUngroup ? "取消组合" : "组合"}
        </button>
        <button
          type="button"
          disabled={disabled || !onMergeLayers}
          className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--ie-ink)] bg-transparent text-[12px] font-medium text-[var(--ie-ink)] disabled:opacity-40"
          onClick={() => {
            void (async () => {
              const ok = await confirm({
                title: "合并图层",
                message: "会把当前样式合并为一张图片。合并后不能再单独编辑这些文字。",
                confirmLabel: "合并",
              });
              if (!ok) return;
              try {
                await onMergeLayers?.();
              } catch (error) {
                await alert({
                  title: "合并失败",
                  message: error instanceof Error ? error.message : "没能把文字合并进图片。",
                  variant: "error",
                });
              }
            })();
          }}
        >
          <Combine className="h-3.5 w-3.5" />
          合并图层
        </button>
      </div>
      <Field label="字体">
        <FontMenu
          disabled={disabled}
          value={normalizeCopyFontPresetId(layer.fontFamily)}
          onChange={(fontFamily) => patchLayer({ fontFamily })}
        />
      </Field>

      <Field label="字号">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={10}
            max={480}
            disabled={disabled}
            className={cn(inputClass, "w-16 shrink-0 text-center")}
            value={layer.fontSize}
            onChange={(e) => patchLayer({ fontSize: clamp(Number(e.target.value) || 32, 10, 480) })}
          />
          <input
            type="range"
            min={10}
            max={480}
            disabled={disabled}
            value={layer.fontSize}
            className="h-1 min-w-0 flex-1 accent-[var(--ie-border)]"
            onChange={(e) => patchLayer({ fontSize: Number(e.target.value) })}
          />
        </div>
      </Field>

      <Field label="样式">
        <div className="flex gap-1">
          <ToggleIcon active={layer.fontWeight !== "normal"} disabled={disabled} title="加粗" onClick={() => patchLayer({ fontWeight: layer.fontWeight === "normal" ? "bold" : "normal" })}>
            <Bold className="h-3.5 w-3.5" />
          </ToggleIcon>
          <ToggleIcon active={Boolean(extras.italic)} disabled={disabled} title="斜体" onClick={() => patchExtras({ italic: !extras.italic })}>
            <Italic className="h-3.5 w-3.5" />
          </ToggleIcon>
          <ToggleIcon active={Boolean(extras.underline)} disabled={disabled} title="下划线" onClick={() => patchExtras({ underline: !extras.underline })}>
            <Underline className="h-3.5 w-3.5" />
          </ToggleIcon>
          <ToggleIcon active={Boolean(extras.strike)} disabled={disabled} title="删除线" onClick={() => patchExtras({ strike: !extras.strike })}>
            <Strikethrough className="h-3.5 w-3.5" />
          </ToggleIcon>
        </div>
      </Field>

      <Field label="对齐">
        <div className="flex gap-1 rounded-lg border border-[var(--ie-border-soft)] bg-[var(--ie-cream-muted)] p-0.5">
          {(
            [
              ["left", AlignLeft, "左对齐"],
              ["center", AlignCenter, "居中"],
              ["right", AlignRight, "右对齐"],
              ["justify", AlignJustify, "分散对齐"],
            ] as const
          ).map(([id, Icon, title]) => (
            <button
              key={id}
              type="button"
              disabled={disabled}
              title={title}
              aria-pressed={(extras.align ?? layer.textAlign ?? "center") === id}
              className={cn(
                "flex flex-1 items-center justify-center rounded-md py-1.5",
                (extras.align ?? layer.textAlign ?? "center") === id
                  ? "bg-[var(--ie-cream)] text-[var(--ie-ink)] shadow-sm"
                  : "text-[var(--ie-muted)]",
              )}
              onClick={() => {
                let next = patchImageEditorTextLayer(doc, layer.id, { textAlign: id === "justify" ? "left" : id });
                next = patchImageEditorTextExtras(next, layer.id, { align: id });
                onChange(next);
              }}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </Field>

      <Field label="间距">
        <div className="grid grid-cols-2 gap-2">
          <NumberChip
            label="行距"
            value={extras.lineHeight ?? 120}
            min={80}
            max={240}
            disabled={disabled}
            onChange={(lineHeight) => patchExtras({ lineHeight })}
          />
          <NumberChip
            label="字距"
            value={extras.letterSpacing ?? 0}
            min={-4}
            max={48}
            disabled={disabled}
            onChange={(letterSpacing) => patchExtras({ letterSpacing })}
          />
        </div>
      </Field>

      <div className="grid grid-cols-3 gap-2 border-t border-[var(--ie-divider)] pt-3">
        <ImageEditorHighlightControl
          highlightId={extras.highlightId}
          color={extras.highlightColor}
          disabled={disabled}
          onChange={(patch) => patchExtras(patch)}
        />
        <ImageEditorWarpControl
          warpId={extras.warpId}
          disabled={disabled}
          onChange={(warpId) => patchExtras({ warpId })}
        />
        <FeatureCard title="AI花字" disabled={disabled} onClick={() => onAiFlower?.()} />
      </div>

      <div className="border-t border-[var(--ie-divider)] pt-3">
        <ImageEditorTextEffectControl
          effectId={extras.effectId}
          layer={layer}
          extras={extras}
          disabled={disabled}
          onPick={(effectId) => onChange(applyImageEditorTextEffect(doc, layer.id, effectId))}
          onAdjust={(patch) => {
            let next = patch.layer ? patchImageEditorTextLayer(doc, layer.id, patch.layer) : doc;
            next = patchImageEditorTextExtras(next, layer.id, {
              effectId: undefined,
              flowerId: undefined,
              ...(patch.extras ?? {}),
            });
            onChange(next);
          }}
        />
      </div>

      <Field label="透明度">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            disabled={disabled}
            value={extras.opacity ?? 100}
            className="h-1 min-w-0 flex-1 accent-[var(--ie-border)]"
            onChange={(e) => patchExtras({ opacity: Number(e.target.value) })}
          />
          <span className="w-8 text-right text-[11px] text-[var(--ie-subtle)]">{extras.opacity ?? 100}</span>
        </div>
      </Field>

      <Field label="尺寸">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
          <NumberChip
            label="宽"
            value={widthPx}
            min={8}
            max={8192}
            disabled={disabled}
            onChange={(w) =>
              patchLayer({
                layoutBoxWidthPx: w,
                maxWidthNorm: clamp(w / Math.max(1, exportW), 0.05, 1),
              })
            }
          />
          <Link2 className="h-3.5 w-3.5 text-[var(--ie-subtle)]" aria-hidden />
          <NumberChip
            label="高"
            value={pos.h}
            min={8}
            max={8192}
            disabled={disabled}
            onChange={(h) =>
              onChange(
                patchLayerPositionFromPx(doc, layer.id, exportW, exportH, { h }),
              )
            }
          />
        </div>
      </Field>

      <Field label="位置">
        <div className="grid grid-cols-2 gap-2">
          <NumberChip label="X" value={pos.x} min={0} max={exportW} disabled={disabled} onChange={(x) => patchPos({ x })} />
          <NumberChip label="Y" value={pos.y} min={0} max={exportH} disabled={disabled} onChange={(y) => patchPos({ y })} />
        </div>
      </Field>

      <Field label="排版">
        <div className="flex gap-0.5 rounded-lg bg-[var(--ie-cream-muted)] p-0.5">
          {(
            [
              ["h-left", "横排左对齐"],
              ["h-center", "横排居中"],
              ["h-right", "横排右对齐"],
              ["v-top", "竖排靠上"],
              ["v-center", "竖排居中"],
              ["v-bottom", "竖排靠下"],
            ] as const
          ).map(([id, title]) => (
            <button
              key={id}
              type="button"
              disabled={disabled}
              title={title}
              aria-label={title}
              className={cn(
                "flex h-8 flex-1 items-center justify-center rounded-md",
                layout === id ? "bg-[var(--ie-cream)] text-[var(--ie-ink)] shadow-sm" : "text-[var(--ie-muted)]",
              )}
              onClick={() => setLayout(id)}
            >
              <LayoutLines mode={id} />
            </button>
          ))}
        </div>
      </Field>

      <Field label="角度">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={-180}
            max={180}
            disabled={disabled}
            className={cn(inputClass, "w-14 text-center")}
            value={extras.rotateDeg ?? 0}
            onChange={(e) => patchExtras({ rotateDeg: clamp(Number(e.target.value) || 0, -180, 180) })}
          />
          <span className="text-[11px] text-[var(--ie-subtle)]">°</span>
          <button
            type="button"
            disabled={disabled}
            title="重置角度"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--ie-border-soft)] text-[var(--ie-ink)]"
            onClick={() => patchExtras({ rotateDeg: 0 })}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            title="水平翻转"
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--ie-border-soft)]",
              extras.flipH ? "bg-[var(--ie-cream-muted)] text-[var(--ie-ink)]" : "text-[var(--ie-ink)]",
            )}
            onClick={() => patchExtras({ flipH: !extras.flipH })}
          >
            <FlipHorizontal2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            title="垂直翻转"
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--ie-border-soft)]",
              extras.flipV ? "bg-[var(--ie-cream-muted)] text-[var(--ie-ink)]" : "text-[var(--ie-ink)]",
            )}
            onClick={() => patchExtras({ flipV: !extras.flipV })}
          >
            <FlipVertical2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </Field>
    </div>
  );
}

function Header({
  title,
  disabled,
  onDuplicate,
  onDelete,
}: {
  title: string;
  disabled?: boolean;
  onDuplicate?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--ie-divider)] pb-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--ie-border-soft)] bg-[var(--ie-cream-muted)] text-[var(--ie-ink)]">
          <Type className="h-4 w-4" />
        </span>
        <span className="text-[13px] font-semibold text-[var(--ie-ink)]">{title}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled || !onDuplicate}
          title="创建副本"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--ie-muted)] hover:bg-[var(--ie-cream-muted)] hover:text-[var(--ie-ink)] disabled:opacity-40"
          onClick={onDuplicate}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={disabled}
          title="删除文字"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--ie-muted)] hover:bg-[var(--ie-cream-muted)] hover:text-[var(--ie-ink)] disabled:opacity-40"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function FontMenu({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const current = ECOM_COPY_FONT_PRESETS.find((item) => item.id === value) ?? ECOM_COPY_FONT_PRESETS[0];

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = btnRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(168, rect.width);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      const top = Math.min(rect.bottom + 6, window.innerHeight - 280);
      setPos({ top, left, width });
    };
    place();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("resize", place);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        className={cn(inputClass, "flex items-center justify-between text-left disabled:opacity-40")}
        style={{ fontFamily: current?.css }}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{current?.label ?? "系统默认"}</span>
        <span className="text-[10px] text-[var(--ie-subtle)]">▾</span>
      </button>
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              aria-label="字体"
              className="ecom-scrollbar-thin fixed z-[90] max-h-64 overflow-y-auto rounded-xl bg-[#3a322c] py-1.5 text-white shadow-[0_12px_32px_rgba(0,0,0,0.28)]"
              style={{ top: pos.top, left: pos.left, width: pos.width }}
            >
              {ECOM_COPY_FONT_PRESETS.map((preset) => {
                const active = preset.id === value;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-white/10"
                    style={{ fontFamily: preset.css }}
                    onClick={() => {
                      onChange(preset.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("h-3.5 w-3.5 shrink-0", active ? "opacity-100" : "opacity-0")} />
                    {preset.label}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[11px] text-[var(--ie-ink)]">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] px-2 py-1.5 text-[11px] text-[var(--ie-ink)] outline-none focus:border-[var(--ie-border)]";

function ToggleIcon({
  children,
  active,
  disabled,
  title,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--ie-border-soft)]",
        active ? "bg-[var(--ie-cream-muted)] text-[var(--ie-ink)]" : "bg-[var(--ie-cream)] text-[var(--ie-muted)]",
        "disabled:opacity-40",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function NumberChip({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-1 rounded-lg border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] px-1.5 py-1">
      <span className="shrink-0 text-[10px] text-[var(--ie-subtle)]">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        disabled={disabled}
        className="w-full min-w-0 bg-transparent text-right text-[11px] text-[var(--ie-ink)] outline-none"
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0, min, max))}
      />
    </label>
  );
}

function FeatureCard({ title, disabled, onClick }: { title: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="flex flex-col items-center gap-1 rounded-xl border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] px-1 py-2 text-[10px] text-[var(--ie-ink)] hover:bg-[var(--ie-cream-muted)] disabled:opacity-40"
      onClick={onClick}
    >
      <span className="flex h-8 items-center text-[13px] font-semibold tracking-wide">{title.slice(0, 2)}</span>
      {title}
    </button>
  );
}

function LayoutLines({ mode }: { mode: ImageEditorTextLayout }) {
  const vertical = mode.startsWith("v-");
  const slots = [10, 6, 8];
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
      {slots.map((len, i) => {
        if (!vertical) {
          const x = mode === "h-right" ? 14 - len : mode === "h-center" ? (16 - len) / 2 : 2;
          return <rect key={i} x={x} y={3 + i * 4} width={len} height={1.4} rx={0.4} fill="currentColor" />;
        }
        const y = mode === "v-bottom" ? 14 - len : mode === "v-center" ? (16 - len) / 2 : 2;
        return <rect key={i} x={3 + i * 4} y={y} width={1.4} height={len} rx={0.4} fill="currentColor" />;
      })}
    </svg>
  );
}

