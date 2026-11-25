"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { ChevronDown, ChevronLeft, ChevronUp, Eye, EyeOff, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";

import type { EcomCopyOverlayLayer } from "@private/ecom-copy-overlay";

import type { ImageEditorTextLayerExtras } from "@/lib/image-editor-text";
import {
  IMAGE_EDITOR_MAX_STROKES,
  IMAGE_EDITOR_TEXT_EFFECTS,
  commitImageEditorStrokes,
  imageEditorTextAdjustStyle,
  imageEditorTextEffectStyle,
  nextImageEditorStroke,
  readImageEditorStrokes,
  reconcileStrokePatch,
  shadowOffsetsFromPose,
  shadowPoseFromOffsets,
  type ImageEditorTextEffectGroup,
} from "@/lib/image-editor-text-effects";
import { cn } from "@/lib/utils";

import { useFloatDrag } from "./use-float-drag";

type AdjustPatch = {
  layer?: Partial<EcomCopyOverlayLayer>;
  extras?: Partial<ImageEditorTextLayerExtras>;
};

type Props = {
  effectId: string | undefined;
  layer: EcomCopyOverlayLayer;
  extras: ImageEditorTextLayerExtras;
  disabled?: boolean;
  onPick: (effectId: string) => void;
  onAdjust: (patch: AdjustPatch) => void;
};

export function ImageEditorTextEffectControl({ effectId, layer, extras, disabled, onPick, onAdjust }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const sliderRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<null | "gallery" | "adjust">(null);
  const [returnToAdjust, setReturnToAdjust] = useState(false);
  const [active, setActive] = useState<ImageEditorTextEffectGroup>("basic");
  const [pos, setPos] = useState<{ top: number; right: number; height: number } | null>(null);
  const selected = effectId && effectId !== "none" ? effectId : "none";
  const open = view !== null;
  const drag = useFloatDrag();

  useEffect(() => {
    if (!open) drag.reset();
  }, [open, drag.reset]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = view === "gallery" && !returnToAdjust ? btnRef.current : sliderRef.current ?? btnRef.current;
      const rect = anchor?.getBoundingClientRect();
      if (!rect) return;
      const height = Math.min(view === "adjust" ? 640 : 540, window.innerHeight - 24);
      const top = Math.max(12, Math.min(rect.top - height * 0.42, window.innerHeight - height - 12));
      const width = view === "adjust" ? 300 : 336;
      let right = window.innerWidth - rect.left + 10;
      const left = window.innerWidth - right - width;
      if (left < 8) right = Math.max(8, window.innerWidth - 8 - width);
      setPos({ top, right, height });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, view, returnToAdjust]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (document.activeElement instanceof HTMLInputElement && document.activeElement.type === "color") return;
      if (panelRef.current?.contains(target)) return;
      if (btnRef.current?.contains(target)) return;
      if (sliderRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-effect-summary]")) return;
      setView(null);
      setReturnToAdjust(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setView(null);
        setReturnToAdjust(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const showGroup = (group: ImageEditorTextEffectGroup) => {
    setActive(group);
    const root = scrollerRef.current;
    if (!root) return;
    if (group === "basic") {
      root.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const node = root.querySelector<HTMLElement>("[data-effect-group='flower']");
    if (!node) return;
    const top = node.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
    root.scrollTo({ top, behavior: "smooth" });
  };

  const basic = IMAGE_EDITOR_TEXT_EFFECTS.filter((item) => item.group === "basic");
  const flower = IMAGE_EDITOR_TEXT_EFFECTS.filter((item) => item.group === "flower");

  const emit = (patch: AdjustPatch) => onAdjust(reconcileStrokePatch(layer, extras, patch));

  return (
    <div className="space-y-2">
    <div className="flex items-center gap-2">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-expanded={view === "gallery"}
        aria-haspopup="dialog"
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1.5 py-1.5 text-left disabled:opacity-40",
          view === "gallery" ? "bg-[#e7f1ff]" : "bg-[#f3f1ec]",
        )}
        onClick={() => {
          setReturnToAdjust(false);
          setView((cur) => (cur === "gallery" && !returnToAdjust ? null : "gallery"));
        }}
      >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
          <LiveEffectMark effectId={selected} layer={layer} extras={extras} fontPx={22} />
        </span>
        <span className="text-[13px] text-[var(--ie-ink)]">特效</span>
        {view === "gallery" ? (
          <ChevronUp className="ml-auto h-4 w-4 shrink-0 text-[#3d7eff]" />
        ) : (
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-[var(--ie-muted)]" />
        )}
      </button>
      <button
        ref={sliderRef}
        type="button"
        disabled={disabled}
        title="调节填充、描边与投影"
        aria-expanded={view === "adjust"}
        className={cn(
          "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[var(--ie-ink)] disabled:opacity-40",
          view === "adjust" ? "bg-[#e7f1ff] text-[#3d7eff]" : "bg-[#f3f1ec]",
        )}
        onClick={() => {
          setReturnToAdjust(false);
          setView((cur) => (cur === "adjust" ? null : "adjust"));
        }}
      >
        <SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} />
      </button>

      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="文字特效"
              className="fixed z-[80] flex cursor-move flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.14)] [&_button]:cursor-pointer [&_input]:cursor-auto [&_textarea]:cursor-text"
              style={{
                top: pos.top,
                right: pos.right,
                width: view === "adjust" ? 300 : 336,
                height: pos.height,
                transform: `translate(${drag.shift.x}px, ${drag.shift.y}px)`,
              }}
              onPointerDown={drag.onPointerDown}
            >
              {view === "adjust" ? (
                <EffectAdjustBody
                  effectId={selected}
                  layer={layer}
                  extras={extras}
                  onOpenGallery={() => {
                    setReturnToAdjust(true);
                    setView("gallery");
                  }}
                  onBack={() => {
                    setView(null);
                    setReturnToAdjust(false);
                  }}
                  onAdjust={emit}
                />
              ) : (
                <>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[15px] font-semibold text-[#1d1d1f]">文字特效</span>
                <button
                  type="button"
                  aria-label={returnToAdjust ? "返回调节" : "关闭文字特效"}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#8e8e93] hover:bg-[#f3f4f6] hover:text-[#1d1d1f]"
                  onClick={() => {
                    if (returnToAdjust) {
                      setView("adjust");
                      setReturnToAdjust(false);
                      return;
                    }
                    setView(null);
                  }}
                >
                  {returnToAdjust ? <ChevronLeft className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex min-h-0 flex-1 pb-3 pl-1 pr-2">
                <div className="flex w-[52px] shrink-0 flex-col pt-1">
                  <GroupTab label="基础" active={active === "basic"} onClick={() => showGroup("basic")} />
                  <GroupTab label="花字" active={active === "flower"} onClick={() => showGroup("flower")} />
                </div>
                <div
                  ref={scrollerRef}
                  className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto pr-1"
                  onScroll={(event) => {
                    const root = event.currentTarget;
                    const flower = root.querySelector<HTMLElement>("[data-effect-group='flower']");
                    if (!flower) return;
                    const top = flower.getBoundingClientRect().top - root.getBoundingClientRect().top;
                    const next = top < 36 ? "flower" : "basic";
                    setActive((cur) => (cur === next ? cur : next));
                  }}
                >
                  <div className="grid grid-cols-3 gap-2">
                    {basic.map((item) => (
                      <EffectTile
                        key={item.id}
                        id={item.id}
                        selected={selected === item.id}
                        onPick={onPick}
                      />
                    ))}
                  </div>
                  <div data-effect-group="flower" className="mt-2 grid grid-cols-3 gap-2">
                    {flower.map((item) => (
                      <EffectTile
                        key={item.id}
                        id={item.id}
                        selected={selected === item.id}
                        onPick={onPick}
                      />
                    ))}
                  </div>
                </div>
              </div>
                </>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
    <EffectSummaryRows
      layer={layer}
      extras={extras}
      disabled={disabled}
      onAdjust={emit}
      onOpenAdjust={() => {
        setReturnToAdjust(false);
        setView("adjust");
      }}
    />
    </div>
  );
}

function EffectSummaryRows({
  layer,
  extras,
  disabled,
  onAdjust,
  onOpenAdjust,
}: {
  layer: EcomCopyOverlayLayer;
  extras: ImageEditorTextLayerExtras;
  disabled?: boolean;
  onAdjust: (patch: AdjustPatch) => void;
  onOpenAdjust: () => void;
}) {
  const strokes = readImageEditorStrokes(layer, extras);
  const [strokeIndex, setStrokeIndex] = useState(0);
  const index = Math.min(strokeIndex, Math.max(0, strokes.length - 1));
  const pose = shadowPoseFromOffsets(layer.shadowOffsetX ?? 0, layer.shadowOffsetY ?? 0);
  const angle = extras.shadowAngle ?? pose.angle;
  const distance = extras.shadowDistance ?? pose.distance;
  const shadowOn =
    Boolean(extras.shadowHidden) ||
    (layer.shadowBlur ?? 0) > 0 ||
    distance > 0 ||
    Math.hypot(layer.shadowOffsetX ?? 0, layer.shadowOffsetY ?? 0) > 0.5;
  const glowOn = (layer.glowBlur ?? 0) > 0 || Boolean(extras.glowHidden);
  const bgOn = Boolean(layer.textBgEnabled) || Boolean(extras.bgHidden);

  const writeStrokes = (next: typeof strokes, select?: number) => {
    if (select != null) setStrokeIndex(select);
    onAdjust(commitImageEditorStrokes(next));
  };

  return (
    <div data-effect-summary className="space-y-1.5" aria-label="文字效果">
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-[12px] text-[var(--ie-ink)]">填充/渐变</span>
        <MiniSwatch
          className="ml-auto"
          value={toHex(layer.color)}
          disabled={disabled}
          label="填充颜色"
          onChange={(color) => onAdjust({ layer: { color } })}
        />
      </div>

      {strokes.length === 0 ? (
        <SummaryLine label="描边">
          <IconBtn label="添加描边" disabled={disabled} onClick={() => writeStrokes([nextImageEditorStroke(0)], 0)}>
            <Plus className="h-3.5 w-3.5" />
          </IconBtn>
        </SummaryLine>
      ) : strokes.length === 1 ? (
        <SummaryLine label="描边">
          <StrokeTools
            stroke={strokes[0]}
            disabled={disabled}
            onOpenAdjust={onOpenAdjust}
            onChange={(patch) => writeStrokes([{ ...strokes[0], ...patch }])}
            onToggleHidden={() => writeStrokes([{ ...strokes[0], hidden: !strokes[0].hidden }])}
            onRemove={() => writeStrokes([])}
          />
          <IconBtn label="添加描边" disabled={disabled} onClick={() => writeStrokes([...strokes, nextImageEditorStroke(1)], 1)}>
            <Plus className="h-3.5 w-3.5" />
          </IconBtn>
        </SummaryLine>
      ) : (
        <div className="space-y-1">
          <SummaryLine label="描边">
            {strokes.map((stroke, i) => (
              <button
                key={`${stroke.color}-${i}`}
                type="button"
                disabled={disabled}
                aria-label={`描边${i + 1}`}
                className={cn(
                  "h-5 w-5 rounded-md border border-black/10",
                  i === index && "ring-2 ring-[#3d7eff]",
                  stroke.hidden && "opacity-40",
                )}
                style={{ backgroundColor: stroke.color }}
                onClick={() => setStrokeIndex(i)}
              />
            ))}
            <IconBtn
              label={strokes[index]?.hidden ? "显示描边" : "隐藏描边"}
              disabled={disabled}
              onClick={() => writeStrokes(strokes.map((stroke, i) => (i === index ? { ...stroke, hidden: !stroke.hidden } : stroke)))}
            >
              {strokes[index]?.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </IconBtn>
            <IconBtn label="删除描边" disabled={disabled} onClick={() => writeStrokes(strokes.filter((_, i) => i !== index), Math.max(0, index - 1))}>
              <Trash2 className="h-3.5 w-3.5" />
            </IconBtn>
            {strokes.length < IMAGE_EDITOR_MAX_STROKES ? (
              <IconBtn
                label="添加描边"
                disabled={disabled}
                onClick={() => writeStrokes([...strokes, nextImageEditorStroke(strokes.length)], strokes.length)}
              >
                <Plus className="h-3.5 w-3.5" />
              </IconBtn>
            ) : null}
          </SummaryLine>
          <div className="flex items-center gap-1 rounded-lg bg-[#f4f3f0] px-2 py-1">
            <span className="w-12 shrink-0 text-[12px] text-[var(--ie-ink)]">描边{index + 1}</span>
            <StrokeTools
              stroke={strokes[index]}
              disabled={disabled}
              onOpenAdjust={onOpenAdjust}
              onChange={(patch) => writeStrokes(strokes.map((stroke, i) => (i === index ? { ...stroke, ...patch } : stroke)))}
              onToggleHidden={() =>
                writeStrokes(strokes.map((stroke, i) => (i === index ? { ...stroke, hidden: !stroke.hidden } : stroke)))
              }
              onRemove={() => writeStrokes(strokes.filter((_, i) => i !== index), Math.max(0, index - 1))}
            />
          </div>
        </div>
      )}

      {shadowOn ? (
        <SummaryLine label="投影">
          <AngleDial
            value={angle}
            onChange={(next) =>
              onAdjust({
                layer: { ...shadowOffsetsFromPose(next, distance) },
                extras: { shadowAngle: next, shadowDistance: distance },
              })
            }
          />
          <MiniSwatch
            value={toHex(layer.shadowColor, "#000000")}
            disabled={disabled}
            label="投影颜色"
            onChange={(shadowColor) => onAdjust({ layer: { shadowColor } })}
          />
          <IconBtn label="调节投影" disabled={disabled} onClick={onOpenAdjust}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn label={extras.shadowHidden ? "显示投影" : "隐藏投影"} disabled={disabled} onClick={() => onAdjust({ extras: { shadowHidden: !extras.shadowHidden } })}>
            {extras.shadowHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </IconBtn>
          <IconBtn
            label="删除投影"
            disabled={disabled}
            onClick={() =>
              onAdjust({
                layer: { shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, shadowOpacity: 0 },
                extras: { shadowHidden: false, shadowDistance: 0 },
              })
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        </SummaryLine>
      ) : (
        <SummaryLine label="投影">
          <IconBtn
            label="添加投影"
            disabled={disabled}
            onClick={() =>
              onAdjust({
                layer: {
                  shadowBlur: 4,
                  shadowColor: layer.shadowColor ?? "#000000",
                  shadowOpacity: 1,
                  ...shadowOffsetsFromPose(-90, 12),
                },
                extras: { shadowHidden: false, shadowAngle: -90, shadowDistance: 12 },
              })
            }
          >
            <Plus className="h-3.5 w-3.5" />
          </IconBtn>
        </SummaryLine>
      )}

      {glowOn ? (
        <SummaryLine label="外发光">
          <MetricInput
            value={Math.round(layer.glowBlur ?? 0)}
            min={1}
            max={64}
            disabled={disabled}
            label="外发光范围"
            onChange={(glowBlur) => onAdjust({ layer: { glowBlur } })}
          />
          <MiniSwatch
            value={toHex(layer.glowColor, "#ff4fd8")}
            disabled={disabled}
            label="外发光颜色"
            onChange={(glowColor) => onAdjust({ layer: { glowColor } })}
          />
          <IconBtn label="调节外发光" disabled={disabled} onClick={onOpenAdjust}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn label={extras.glowHidden ? "显示外发光" : "隐藏外发光"} disabled={disabled} onClick={() => onAdjust({ extras: { glowHidden: !extras.glowHidden } })}>
            {extras.glowHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </IconBtn>
          <IconBtn label="删除外发光" disabled={disabled} onClick={() => onAdjust({ layer: { glowBlur: 0, glowOpacity: 0 }, extras: { glowHidden: false } })}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        </SummaryLine>
      ) : (
        <SummaryLine label="外发光">
          <IconBtn
            label="添加外发光"
            disabled={disabled}
            onClick={() =>
              onAdjust({
                layer: { glowBlur: 16, glowColor: layer.glowColor ?? "#ff4fd8", glowOpacity: 1 },
                extras: { glowHidden: false },
              })
            }
          >
            <Plus className="h-3.5 w-3.5" />
          </IconBtn>
        </SummaryLine>
      )}

      {bgOn ? (
        <SummaryLine label="背景">
          <MetricInput
            value={Math.round((layer.textBgOpacity ?? 1) * 100)}
            min={0}
            max={100}
            disabled={disabled}
            label="背景透明度"
            onChange={(value) => onAdjust({ layer: { textBgOpacity: value / 100, textBgEnabled: true } })}
          />
          <MiniSwatch
            value={toHex(layer.textBgColor, "#f5c542")}
            disabled={disabled}
            label="背景颜色"
            onChange={(textBgColor) => onAdjust({ layer: { textBgColor, textBgEnabled: true } })}
          />
          <IconBtn label="调节背景" disabled={disabled} onClick={onOpenAdjust}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn label={extras.bgHidden ? "显示背景" : "隐藏背景"} disabled={disabled} onClick={() => onAdjust({ extras: { bgHidden: !extras.bgHidden } })}>
            {extras.bgHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </IconBtn>
          <IconBtn label="删除背景" disabled={disabled} onClick={() => onAdjust({ layer: { textBgEnabled: false }, extras: { bgHidden: false } })}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        </SummaryLine>
      ) : (
        <SummaryLine label="背景">
          <IconBtn
            label="添加背景"
            disabled={disabled}
            onClick={() =>
              onAdjust({
                layer: {
                  textBgEnabled: true,
                  textBgColor: layer.textBgColor ?? "#f5c542",
                  textBgOpacity: layer.textBgOpacity ?? 1,
                  textBgPaddingPx: layer.textBgPaddingPx && layer.textBgPaddingPx > 0 ? layer.textBgPaddingPx : 12,
                  textBgRadiusPx: layer.textBgRadiusPx ?? 12,
                },
                extras: { bgHidden: false },
              })
            }
          >
            <Plus className="h-3.5 w-3.5" />
          </IconBtn>
        </SummaryLine>
      )}
    </div>
  );
}

function SummaryLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1 py-0.5">
      <span className="w-12 shrink-0 text-[12px] text-[var(--ie-ink)]">{label}</span>
      <div className="ml-auto flex min-w-0 items-center gap-1">{children}</div>
    </div>
  );
}

function StrokeTools({
  stroke,
  disabled,
  onChange,
  onToggleHidden,
  onRemove,
  onOpenAdjust,
}: {
  stroke: { width: number; color: string; opacity: number; hidden?: boolean };
  disabled?: boolean;
  onChange: (patch: { width?: number; color?: string }) => void;
  onToggleHidden: () => void;
  onRemove: () => void;
  onOpenAdjust: () => void;
}) {
  return (
    <>
      <MetricInput value={Math.round(stroke.width)} min={1} max={48} disabled={disabled} label="描边范围" onChange={(width) => onChange({ width })} />
      <MiniSwatch value={toHex(stroke.color, "#1e3a8a")} disabled={disabled} label="描边颜色" onChange={(color) => onChange({ color })} />
      <IconBtn label="调节描边" disabled={disabled} onClick={onOpenAdjust}>
        <SlidersHorizontal className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn label={stroke.hidden ? "显示描边" : "隐藏描边"} disabled={disabled} onClick={onToggleHidden}>
        {stroke.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </IconBtn>
      <IconBtn label="删除描边" disabled={disabled} onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5" />
      </IconBtn>
    </>
  );
}

function IconBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#8e8e93] hover:bg-[#f3f4f6] hover:text-[#1d1d1f] disabled:opacity-40"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MetricInput({
  value,
  min,
  max,
  disabled,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  label: string;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      aria-label={label}
      min={min}
      max={max}
      disabled={disabled}
      value={value}
      className="h-6 w-10 rounded-md bg-[#f3f1ec] text-center text-[11px] text-[var(--ie-ink)] outline-none"
      onChange={(event) => onChange(Math.max(min, Math.min(max, Math.round(Number(event.target.value) || 0))))}
    />
  );
}

function MiniSwatch({
  value,
  disabled,
  label,
  className,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  label: string;
  className?: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="color"
      aria-label={label}
      disabled={disabled}
      value={value}
      className={cn("h-5 w-5 shrink-0 cursor-pointer rounded-md border border-black/10 bg-transparent p-0", className)}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function EffectAdjustBody({
  effectId,
  layer,
  extras,
  onOpenGallery,
  onBack,
  onAdjust,
}: {
  effectId: string;
  layer: EcomCopyOverlayLayer;
  extras: ImageEditorTextLayerExtras;
  onOpenGallery: () => void;
  onBack: () => void;
  onAdjust: (patch: AdjustPatch) => void;
}) {
  const pose = shadowPoseFromOffsets(layer.shadowOffsetX ?? 0, layer.shadowOffsetY ?? 0);
  const angle = extras.shadowAngle ?? pose.angle;
  const distance = extras.shadowDistance ?? pose.distance;
  const strokeOn = (layer.strokeWidth ?? 0) > 0 || Boolean(extras.strokeHidden);
  const shadowOn =
    Boolean(extras.shadowHidden) ||
    (layer.shadowBlur ?? 0) > 0 ||
    distance > 0 ||
    Math.hypot(layer.shadowOffsetX ?? 0, layer.shadowOffsetY ?? 0) > 0.5;
  const glowOn = (layer.glowBlur ?? 0) > 0 || Boolean(extras.glowHidden);
  const bgOn = Boolean(layer.textBgEnabled) || Boolean(extras.bgHidden);

  const tune = (patch: AdjustPatch) => onAdjust(patch);

  return (
    <>
      <div className="flex items-center gap-1 px-3 py-3">
        <button
          type="button"
          aria-label="返回"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#1d1d1f] hover:bg-[#f3f4f6]"
          onClick={onBack}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[15px] font-semibold text-[#1d1d1f]">文字特效</span>
      </div>
      <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-xl bg-[#f4f5f7] px-1.5 py-1.5 text-left"
          onClick={onOpenGallery}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
            <LiveEffectMark effectId={effectId} layer={layer} extras={extras} fontPx={22} />
          </span>
          <span className="text-[13px] text-[#1d1d1f]">特效</span>
          <ChevronDown className="ml-auto h-4 w-4 text-[#8e8e93]" />
        </button>

        <section className="mt-3 border-t border-[#ececee] pt-3">
          <SectionTitle icon="fill" label="填充/渐变" />
          <ColorRow
            label="颜色"
            value={toHex(layer.color)}
            onChange={(color) => tune({ layer: { color } })}
          />
          <TuneSlider
            label="透明度"
            value={extras.fillOpacity ?? 100}
            min={0}
            max={100}
            onChange={(fillOpacity) => tune({ extras: { fillOpacity } })}
          />
        </section>

        <EffectBlock
          icon="stroke"
          label="描边"
          open={strokeOn}
          hidden={Boolean(extras.strokeHidden)}
          onAdd={() =>
            tune({
              layer: { strokeWidth: layer.strokeWidth && layer.strokeWidth > 0 ? layer.strokeWidth : 8, strokeColor: layer.strokeColor ?? "#1a237e" },
              extras: { strokeHidden: false, strokeOpacity: extras.strokeOpacity ?? 100 },
            })
          }
          onToggleHidden={() => tune({ extras: { strokeHidden: !extras.strokeHidden } })}
          onRemove={() => tune({ layer: { strokeWidth: 0 }, extras: { strokeHidden: false } })}
        >
          <div className="mb-1 text-[12px] text-[#1d1d1f]">描边1</div>
          <ColorRow
            label="颜色"
            value={toHex(layer.strokeColor, "#1a237e")}
            onChange={(strokeColor) => tune({ layer: { strokeColor } })}
          />
          <TuneSlider
            label="范围"
            value={Math.round(layer.strokeWidth ?? 0)}
            min={1}
            max={48}
            onChange={(strokeWidth) => tune({ layer: { strokeWidth } })}
          />
          <TuneSlider
            label="透明度"
            value={extras.strokeOpacity ?? 100}
            min={0}
            max={100}
            onChange={(strokeOpacity) => tune({ extras: { strokeOpacity } })}
          />
        </EffectBlock>

        <EffectBlock
          icon="shadow"
          label="投影"
          open={shadowOn}
          hidden={Boolean(extras.shadowHidden)}
          onAdd={() =>
            tune({
              layer: {
                shadowBlur: layer.shadowBlur && layer.shadowBlur > 0 ? layer.shadowBlur : 4,
                shadowColor: layer.shadowColor ?? "#000000",
                shadowOpacity: layer.shadowOpacity ?? 1,
                ...shadowOffsetsFromPose(angle, distance > 0 ? distance : 12),
              },
              extras: { shadowHidden: false, shadowAngle: angle, shadowDistance: distance > 0 ? distance : 12 },
            })
          }
          onToggleHidden={() => tune({ extras: { shadowHidden: !extras.shadowHidden } })}
          onRemove={() =>
            tune({
              layer: { shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, shadowOpacity: 0 },
              extras: { shadowHidden: false, shadowDistance: 0 },
            })
          }
        >
          <div className="flex items-center justify-between py-1">
            <span className="text-[12px] text-[#6e6e73]">颜色</span>
            <span className="flex items-center gap-2">
              <ColorSwatch value={toHex(layer.shadowColor, "#000000")} onChange={(shadowColor) => tune({ layer: { shadowColor } })} />
              <AngleDial
                value={angle}
                onChange={(next) =>
                  tune({
                    layer: { ...shadowOffsetsFromPose(next, distance) },
                    extras: { shadowAngle: next, shadowDistance: distance },
                  })
                }
              />
            </span>
          </div>
          <TuneSlider
            label="模糊"
            value={Math.round(layer.shadowBlur ?? 0)}
            min={0}
            max={48}
            onChange={(shadowBlur) => tune({ layer: { shadowBlur }, extras: { shadowAngle: angle, shadowDistance: distance } })}
          />
          <TuneSlider
            label="距离"
            value={distance}
            min={0}
            max={80}
            onChange={(next) =>
              tune({
                layer: { ...shadowOffsetsFromPose(angle, next), shadowBlur: Math.max(layer.shadowBlur ?? 0, next > 0 ? layer.shadowBlur ?? 0 : 0) },
                extras: { shadowAngle: angle, shadowDistance: next },
              })
            }
          />
          <TuneSlider
            label="透明度"
            value={Math.round((layer.shadowOpacity ?? 1) * 100)}
            min={0}
            max={100}
            onChange={(value) => tune({ layer: { shadowOpacity: value / 100 }, extras: { shadowAngle: angle, shadowDistance: distance } })}
          />
        </EffectBlock>

        <EffectBlock
          icon="glow"
          label="外发光"
          open={glowOn}
          hidden={Boolean(extras.glowHidden)}
          onAdd={() =>
            tune({
              layer: {
                glowBlur: layer.glowBlur && layer.glowBlur > 0 ? layer.glowBlur : 16,
                glowColor: layer.glowColor ?? "#ff4fd8",
                glowOpacity: layer.glowOpacity ?? 1,
              },
              extras: { glowHidden: false },
            })
          }
          onToggleHidden={() => tune({ extras: { glowHidden: !extras.glowHidden } })}
          onRemove={() => tune({ layer: { glowBlur: 0, glowOpacity: 0 }, extras: { glowHidden: false } })}
        >
          <ColorRow
            label="颜色"
            value={toHex(layer.glowColor, "#ff4fd8")}
            onChange={(glowColor) => tune({ layer: { glowColor } })}
          />
          <TuneSlider
            label="范围"
            value={Math.round(layer.glowBlur ?? 0)}
            min={1}
            max={64}
            onChange={(glowBlur) => tune({ layer: { glowBlur } })}
          />
          <TuneSlider
            label="透明度"
            value={Math.round((layer.glowOpacity ?? 1) * 100)}
            min={0}
            max={100}
            onChange={(value) => tune({ layer: { glowOpacity: value / 100 } })}
          />
        </EffectBlock>

        <EffectBlock
          icon="bg"
          label="背景"
          open={bgOn}
          hidden={Boolean(extras.bgHidden)}
          onAdd={() =>
            tune({
              layer: {
                textBgEnabled: true,
                textBgColor: layer.textBgColor ?? "#ffe14a",
                textBgOpacity: layer.textBgOpacity ?? 1,
                textBgPaddingPx: layer.textBgPaddingPx && layer.textBgPaddingPx > 0 ? layer.textBgPaddingPx : 12,
                textBgRadiusPx: layer.textBgRadiusPx ?? 12,
              },
              extras: { bgHidden: false },
            })
          }
          onToggleHidden={() => tune({ extras: { bgHidden: !extras.bgHidden } })}
          onRemove={() => tune({ layer: { textBgEnabled: false }, extras: { bgHidden: false } })}
        >
          <ColorRow
            label="颜色"
            value={toHex(layer.textBgColor, "#ffe14a")}
            onChange={(textBgColor) => tune({ layer: { textBgColor, textBgEnabled: true } })}
          />
          <TuneSlider
            label="透明度"
            value={Math.round((layer.textBgOpacity ?? 1) * 100)}
            min={0}
            max={100}
            onChange={(value) => tune({ layer: { textBgOpacity: value / 100, textBgEnabled: true } })}
          />
          <TuneSlider
            label="圆角"
            value={Math.round(layer.textBgRadiusPx ?? 0)}
            min={0}
            max={160}
            onChange={(textBgRadiusPx) => tune({ layer: { textBgRadiusPx, textBgEnabled: true } })}
          />
        </EffectBlock>
      </div>
    </>
  );
}

function SectionTitle({ icon, label }: { icon: "fill" | "stroke" | "shadow" | "glow" | "bg"; label: string }) {
  return (
    <div className="flex items-center gap-2 py-1 text-[13px] text-[#1d1d1f]">
      <SectionIcon name={icon} />
      {label}
    </div>
  );
}

function EffectBlock({
  icon,
  label,
  open,
  hidden,
  onAdd,
  onToggleHidden,
  onRemove,
  children,
}: {
  icon: "stroke" | "shadow" | "glow" | "bg";
  label: string;
  open: boolean;
  hidden: boolean;
  onAdd: () => void;
  onToggleHidden: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  if (!open) {
    return (
      <section className="mt-1 border-t border-[#ececee] py-2">
        <div className="flex items-center gap-2 text-[13px] text-[#1d1d1f]">
          <SectionIcon name={icon} />
          <span className="flex-1">{label}</span>
          <button
            type="button"
            aria-label={`添加${label}`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#8e8e93] hover:bg-[#f3f4f6] hover:text-[#1d1d1f]"
            onClick={onAdd}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>
    );
  }
  return (
    <section className="mt-1 border-t border-[#ececee] py-2">
      <div className="flex items-center gap-2 text-[13px] text-[#1d1d1f]">
        <SectionIcon name={icon} />
        <span className="flex-1">{label}</span>
        <button type="button" aria-label={hidden ? `显示${label}` : `隐藏${label}`} className="inline-flex h-6 w-6 items-center justify-center text-[#8e8e93]" onClick={onToggleHidden}>
          {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
        <button type="button" aria-label={`删除${label}`} className="inline-flex h-6 w-6 items-center justify-center text-[#8e8e93]" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className={cn("mt-1 pl-6", hidden && "opacity-40")}>{children}</div>
    </section>
  );
}

function SectionIcon({ name }: { name: "fill" | "stroke" | "shadow" | "glow" | "bg" }) {
  const common = "h-3.5 w-3.5 text-[#1d1d1f]";
  if (name === "fill") {
    return (
      <svg viewBox="0 0 16 16" className={common} aria-hidden>
        <path d="M8 1.5 14 8 8 14.5 2 8Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  if (name === "stroke") {
    return (
      <svg viewBox="0 0 16 16" className={common} aria-hidden>
        <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  if (name === "shadow") {
    return (
      <svg viewBox="0 0 16 16" className={common} aria-hidden>
        <rect x="2" y="3" width="8" height="8" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M6.5 11.5H12a1.2 1.2 0 0 0 1.2-1.2V6.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }
  if (name === "glow") {
    return (
      <svg viewBox="0 0 16 16" className={common} aria-hidden>
        <circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className={common} aria-hidden>
      <rect x="2" y="3" width="12" height="10" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px] text-[#6e6e73]">{label}</span>
      <ColorSwatch value={value} onChange={onChange} />
    </div>
  );
}

function ColorSwatch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="color"
      aria-label="颜色"
      value={value}
      className="h-7 w-12 cursor-pointer rounded-md border border-[#e6e6e8] bg-white p-0.5"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function TuneSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const next = (raw: number) => onChange(Math.max(min, Math.min(max, Math.round(raw))));
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-12 shrink-0 text-[12px] text-[#6e6e73]">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        className="h-1 min-w-0 flex-1 accent-[#3d7eff]"
        onChange={(event) => next(Number(event.target.value))}
      />
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        aria-label={`${label}数值`}
        className="w-12 bg-transparent text-right text-[12px] text-[#1d1d1f] outline-none"
        onChange={(event) => next(Number(event.target.value))}
      />
    </div>
  );
}

function AngleDial({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const drag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el) return;
    const apply = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const dx = ev.clientX - (rect.left + rect.width / 2);
      const dy = ev.clientY - (rect.top + rect.height / 2);
      onChange(Math.round((Math.atan2(-dy, dx) * 180) / Math.PI));
    };
    apply(event.nativeEvent);
    const move = (ev: PointerEvent) => apply(ev);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <button
      ref={ref}
      type="button"
      title="投影角度"
      className="inline-flex items-center gap-1 text-[12px] text-[#1d1d1f]"
      onPointerDown={drag}
    >
      <span className="relative h-5 w-5 rounded-full border border-[#d0d0d4]">
        <span
          className="absolute left-1/2 top-0.5 h-2 w-px -translate-x-1/2 bg-[#1d1d1f]"
          style={{ transform: `rotate(${90 - value}deg)`, transformOrigin: "50% 7px" }}
        />
      </span>
      {value}
    </button>
  );
}

function toHex(color: string | undefined, fallback = "#ffffff"): string {
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (color && /^#[0-9a-fA-F]{3}$/.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  return fallback;
}

function GroupTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cn(
        "relative px-2 py-2 text-left text-[13px]",
        active ? "font-medium text-[#1d1d1f]" : "text-[#a1a1a6]",
      )}
      onClick={onClick}
    >
      {active ? <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-[#3d7eff]" /> : null}
      {label}
    </button>
  );
}

function EffectTile({
  id,
  selected,
  onPick,
}: {
  id: string;
  selected: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-[#f3f4f6]",
        selected && "ring-2 ring-[#3d7eff]",
      )}
      onClick={() => onPick(id)}
    >
      {id === "none" ? <NoneMark /> : <TextEffectSample effectId={id} fontPx={34} />}
    </button>
  );
}

function NoneMark() {
  return (
    <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-[2.5px] border-[#c8ccd2]">
      <span className="absolute h-[2.5px] w-11 -rotate-45 rounded-full bg-[#c8ccd2]" />
    </span>
  );
}

function LiveEffectMark({
  effectId,
  layer,
  extras,
  fontPx,
}: {
  effectId?: string;
  layer: EcomCopyOverlayLayer;
  extras: ImageEditorTextLayerExtras;
  fontPx: number;
}) {
  if (effectId && effectId !== "none") return <TextEffectSample effectId={effectId} fontPx={fontPx} />;
  const active =
    (layer.strokeWidth ?? 0) > 0 ||
    (layer.shadowBlur ?? 0) > 0 ||
    (layer.glowBlur ?? 0) > 0 ||
    Boolean(layer.textBgEnabled) ||
    (extras.fillOpacity ?? 100) < 100 ||
    (layer.color ?? "#ffffff").toLowerCase() !== "#ffffff";
  if (!active) return <TextEffectSample fontPx={fontPx} />;
  const adjust = imageEditorTextAdjustStyle(layer, extras, fontPx / Math.max(12, layer.fontSize));
  return (
    <span
      className="font-black leading-none"
      style={{
        fontSize: fontPx,
        fontFamily: '"Arial Black", "PingFang SC", "Microsoft YaHei", sans-serif',
        ...adjust.fill,
      }}
    >
      A
    </span>
  );
}

export function TextEffectSample({
  effectId,
  fontPx,
  className,
}: {
  effectId?: string;
  fontPx: number;
  className?: string;
}) {
  const style = imageEditorTextEffectStyle(effectId, fontPx);
  const face = { fontSize: fontPx, fontFamily: '"Arial Black", "PingFang SC", "Microsoft YaHei", sans-serif' };
  if (!style) {
    return (
      <span className={cn("font-black leading-none text-[#111111]", className)} style={face}>
        A
      </span>
    );
  }
  return (
    <span className={cn("relative inline-block font-black leading-none", className)} style={face}>
      {style.underlayShadow ? (
        <span aria-hidden className="absolute left-0 top-0" style={{ color: "transparent", textShadow: style.underlayShadow }}>
          A
        </span>
      ) : null}
      <span className="relative" style={style.fill}>
        A
      </span>
    </span>
  );
}
