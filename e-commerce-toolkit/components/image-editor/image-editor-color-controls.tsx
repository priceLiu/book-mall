"use client";

import { Ban, ChevronLeft, ChevronRight, Eraser, Pipette, Plus, ShoppingBag, Sparkles, Watch, Wrench } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import type { ColorAdjust, ColorAdjustStroke } from "@/lib/image-editor-color-adjust";
import { cn } from "@/lib/utils";

type GradePick = {
  id: string;
  label: string;
  preview?: string;
};

type SliderSpec = {
  key: keyof ColorAdjust;
  label: string;
  min: number;
  max: number;
  gradient: string;
};

const BASIC_SLIDERS: SliderSpec[] = [
  { key: "fill", label: "智能补光", min: -100, max: 100, gradient: "linear-gradient(90deg, #1e3a8a, #3b82f6)" },
  { key: "brightness", label: "亮度", min: -100, max: 100, gradient: "linear-gradient(90deg, #161616, #8a8a8a, #f4f4f4)" },
  { key: "contrast", label: "对比度", min: -100, max: 100, gradient: "linear-gradient(90deg, #6b7280, #e5e7eb, #6b7280)" },
  { key: "saturate", label: "饱和度", min: -100, max: 100, gradient: "linear-gradient(90deg, #2f6f4e, #d6de6a, #e07a3d, #b42318)" },
  { key: "clarity", label: "清晰度", min: -100, max: 100, gradient: "linear-gradient(90deg, #4b5563, #9ca3af, #e5e7eb)" },
  { key: "sharpen", label: "锐化", min: 0, max: 100, gradient: "linear-gradient(90deg, #1e3a8a, #60a5fa)" },
];

const ADVANCED_TABS = [
  { id: "light", label: "光效" },
  { id: "color", label: "色彩" },
  { id: "detail", label: "细节" },
  { id: "split", label: "色调分离" },
  { id: "hsl", label: "HSL" },
] as const;

const ADVANCED_SLIDERS: Record<"light" | "color" | "detail", SliderSpec[]> = {
  light: [
    { key: "highlight", label: "高光", min: -100, max: 100, gradient: "linear-gradient(90deg, #1c1c1c, #d4d4d4)" },
    { key: "shadow", label: "暗部", min: -100, max: 100, gradient: "linear-gradient(90deg, #1c1c1c, #a3a3a3)" },
    { key: "fade", label: "褪色", min: -100, max: 100, gradient: "linear-gradient(90deg, #1e3a8a, #60a5fa)" },
  ],
  color: [
    { key: "temperature", label: "色温", min: -100, max: 100, gradient: "linear-gradient(90deg, #2563eb, #f4f4f5, #f59e0b)" },
    { key: "tint", label: "色调", min: -100, max: 100, gradient: "linear-gradient(90deg, #16a34a, #f4f4f5, #d946ef)" },
  ],
  detail: [
    { key: "vignette", label: "暗角", min: -100, max: 100, gradient: "linear-gradient(90deg, #2a2a2a, #c4c4c4)" },
    { key: "grain", label: "颗粒", min: 0, max: 100, gradient: "linear-gradient(90deg, #141414, #3a3a3a)" },
    { key: "disperse", label: "色散", min: 0, max: 100, gradient: "linear-gradient(90deg, #1a1208, #3d6b28, #1a6a88, #2438a8, #7a1868)" },
  ],
};

const SPLIT_COLORS: Array<{ label: string; rgb: [number, number, number] }> = [
  { label: "红", rgb: [214, 54, 54] },
  { label: "橙", rgb: [242, 146, 42] },
  { label: "黄", rgb: [236, 214, 64] },
  { label: "绿", rgb: [62, 196, 78] },
  { label: "蓝", rgb: [62, 112, 228] },
  { label: "紫", rgb: [154, 78, 220] },
];

const HSL_CHIPS: Array<{ label: string; color: string }> = [
  { label: "红", color: "#d8c6b4" },
  { label: "黄", color: "#c6c66c" },
  { label: "紫", color: "#9c8aaa" },
  { label: "橙", color: "#b08a68" },
  { label: "绿", color: "#6a6828" },
  { label: "蓝", color: "#3f3226" },
];

const HSL_SLIDERS: Array<{ axis: 0 | 1 | 2; label: string; gradient: string }> = [
  { axis: 0, label: "色相", gradient: "linear-gradient(90deg, #ef4444, #eab308, #22c55e, #22d3ee, #3b82f6, #ec4899, #ef4444)" },
  { axis: 1, label: "饱和度", gradient: "linear-gradient(90deg, #7c6b9a, #6f8f4a, #a89058, #b45a48)" },
  { axis: 2, label: "明度", gradient: "linear-gradient(90deg, #1c1c1c, #bdbdbd)" },
];

const SPLIT_SAT_SLIDER: SliderSpec = {
  key: "splitHighlightSat",
  label: "饱和度",
  min: 0,
  max: 100,
  gradient: "linear-gradient(90deg, #2a9a9a, #7dba4a, #e6c84a, #e07a3a, #c4476a)",
};

const BASIC_KEYS: Array<keyof ColorAdjust> = ["fill", "brightness", "contrast", "saturate", "clarity", "sharpen"];

function emptyHslBands(): Array<[number, number, number]> {
  return [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
}

function resetAdvancedTab(draft: ColorAdjust, tab: (typeof ADVANCED_TABS)[number]["id"]): ColorAdjust {
  const next = { ...draft };
  if (tab === "light") {
    delete next.highlight;
    delete next.shadow;
    delete next.fade;
  } else if (tab === "color") {
    delete next.temperature;
    delete next.tint;
  } else if (tab === "detail") {
    delete next.vignette;
    delete next.grain;
    delete next.disperse;
  } else if (tab === "split") {
    delete next.splitHighlight;
    delete next.splitShadow;
    delete next.splitHighlightSat;
    delete next.splitShadowSat;
    delete next.splitHighlightRgb;
    delete next.splitShadowRgb;
  } else {
    delete next.hue;
    delete next.hslSat;
    delete next.hslLight;
    delete next.hslBands;
  }
  return next;
}

function sameRgb(a: [number, number, number] | undefined, b: [number, number, number]): boolean {
  return !!a && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

const FILTER_BASE: GradePick[] = [
  { id: "natural", label: "自然", preview: "contrast(1.06) saturate(0.88)" },
  { id: "dehaze", label: "去雾", preview: "brightness(1.04) contrast(1.24) saturate(1.12)" },
  { id: "sharpen", label: "锐化", preview: "contrast(1.18)" },
  { id: "vivid", label: "智能绘色", preview: "contrast(1.12) saturate(1.65)" },
  { id: "aqua", label: "碧波", preview: "hue-rotate(18deg) saturate(1.25) brightness(1.04)" },
  { id: "hyper", label: "全彩", preview: "saturate(1.85) contrast(1.12)" },
];

const FILTER_BASE_MORE: GradePick[] = [
  { id: "clear", label: "清透", preview: "brightness(1.14) contrast(1.04) saturate(0.88)" },
  { id: "texture", label: "质感", preview: "contrast(1.16) saturate(1.08)" },
  { id: "cream", label: "奶油", preview: "brightness(1.06) contrast(0.86) saturate(0.9) sepia(0.16)" },
  { id: "film", label: "胶片", preview: "brightness(1.05) contrast(0.84) saturate(0.72) sepia(0.24)" },
  { id: "cool-white", label: "冷白", preview: "contrast(1.12) saturate(0.9) hue-rotate(8deg)" },
  { id: "muted", label: "低饱和", preview: "saturate(0.45) contrast(1.06)" },
];

const FILTER_NATURAL: GradePick[] = [
  { id: "soft", label: "柔光", preview: "brightness(1.08) contrast(0.78) saturate(0.9)" },
  { id: "warm-food", label: "暖食", preview: "sepia(0.18) saturate(1.2)" },
  { id: "fade", label: "褪色", preview: "brightness(1.08) contrast(0.82) saturate(0.62) sepia(0.18)" },
  { id: "warm", label: "暖白", preview: "sepia(0.12) brightness(1.04)" },
];

const RECOLOR_PICKS: GradePick[] = [
  { id: "bg-light", label: "背景变浅", preview: "brightness(1.12) saturate(0.92)" },
  { id: "bg-dark", label: "背景变深", preview: "brightness(0.72) contrast(1.08)" },
  { id: "product-true", label: "商品色更正", preview: "saturate(0.92) contrast(1.08)" },
  { id: "warm-white", label: "暖白", preview: "sepia(0.14) brightness(1.04)" },
  { id: "cool-white-balance", label: "冷白", preview: "hue-rotate(8deg) saturate(0.94)" },
  { id: "vivid", label: "更饱和", preview: "saturate(1.5) contrast(1.08)" },
];

const PRODUCTS: Array<{ id: string; label: string; icon: typeof ShoppingBag; adjust: ColorAdjust }> = [
  { id: "general", label: "通用商品", icon: ShoppingBag, adjust: { contrast: 18, saturate: 16, clarity: 28 } },
  { id: "hardware", label: "五金制品", icon: Wrench, adjust: { contrast: 26, saturate: 8, clarity: 36, highlight: -12 } },
  { id: "cosmetic", label: "化妆品", icon: Sparkles, adjust: { brightness: 6, saturate: 12, temperature: 8, highlight: 10 } },
  { id: "leather", label: "皮制品", icon: Watch, adjust: { contrast: 20, saturate: 10, temperature: 12, clarity: 42 } },
];

function num(adjust: ColorAdjust, key: keyof ColorAdjust): number {
  const value = adjust[key];
  return typeof value === "number" ? value : 0;
}

function SliderRow({
  spec,
  value,
  disabled,
  onChange,
}: {
  spec: SliderSpec;
  value: number;
  disabled: boolean;
  onChange: (value: number, commit: boolean) => void;
}) {
  const pct = ((value - spec.min) / (spec.max - spec.min)) * 100;
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative h-7 min-w-0 flex-1 overflow-hidden rounded-md" style={{ background: spec.gradient }}>
        <span className="pointer-events-none absolute left-2.5 top-1/2 z-[1] -translate-y-1/2 text-[12px] font-medium text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]">
          {spec.label}
        </span>
        <span
          className="pointer-events-none absolute top-0.5 bottom-0.5 z-[1] w-0.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.28)]"
          style={{ left: `calc(7px + (100% - 14px) * ${pct / 100})` }}
        />
        <input
          type="range"
          min={spec.min}
          max={spec.max}
          value={value}
          disabled={disabled}
          aria-label={spec.label}
          className="absolute inset-0 z-[2] cursor-ew-resize opacity-0 disabled:cursor-not-allowed"
          onChange={(e) => onChange(clampAdjust(Number(e.target.value), spec.min, spec.max), false)}
          onPointerUp={(e) => onChange(clampAdjust(Number((e.target as HTMLInputElement).value), spec.min, spec.max), true)}
          onKeyUp={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              onChange(clampAdjust(Number((e.target as HTMLInputElement).value), spec.min, spec.max), true);
            }
          }}
        />
      </div>
      <ScrubValue spec={spec} value={value} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function clampAdjust(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** 移上去出现左右箭头，按住左右拖时画面跟着变，松手再写入。 */
function ScrubValue({
  spec,
  value,
  disabled,
  onChange,
}: {
  spec: SliderSpec;
  value: number;
  disabled: boolean;
  onChange: (value: number, commit: boolean) => void;
}) {
  const [hot, setHot] = useState(false);
  const drag = useRef<{ x: number; value: number } | null>(null);
  const latest = useRef(value);
  latest.current = value;

  const moveTo = (next: number, commit: boolean) => {
    const clamped = clampAdjust(next, spec.min, spec.max);
    latest.current = clamped;
    onChange(clamped, commit);
  };

  return (
    <span
      role="slider"
      aria-label={`${spec.label}数值`}
      aria-valuemin={spec.min}
      aria-valuemax={spec.max}
      aria-valuenow={value}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      className={cn(
        "relative inline-flex h-7 w-[4.25rem] shrink-0 select-none items-center justify-center rounded-md border bg-white text-[12px] tabular-nums text-[var(--ie-ink)]",
        hot ? "cursor-ew-resize border-[#2f6bff]" : "border-[var(--ie-border-soft)]",
        disabled && "pointer-events-none opacity-50",
      )}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => {
        if (!drag.current) setHot(false);
      }}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0) return;
        drag.current = { x: event.clientX, value: latest.current };
        event.currentTarget.setPointerCapture(event.pointerId);
        setHot(true);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        moveTo(drag.current.value + (event.clientX - drag.current.x) / 2, false);
      }}
      onPointerUp={(event) => {
        if (!drag.current) return;
        const next = drag.current.value + (event.clientX - drag.current.x) / 2;
        drag.current = null;
        moveTo(next, true);
        if (!event.currentTarget.matches(":hover")) setHot(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        moveTo(latest.current + (event.key === "ArrowRight" ? 1 : -1), false);
      }}
      onKeyUp={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") moveTo(latest.current, true);
      }}
    >
      <ChevronLeft className={cn("absolute left-0.5 h-3.5 w-3.5 text-[#2f6bff]", hot ? "opacity-100" : "opacity-0")} aria-hidden />
      {value}
      <ChevronRight className={cn("absolute right-0.5 h-3.5 w-3.5 text-[#2f6bff]", hot ? "opacity-100" : "opacity-0")} aria-hidden />
    </span>
  );
}

function ResetButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="mt-0.5 flex h-8 w-full items-center justify-center gap-1 rounded-md border border-[var(--ie-border)] bg-white text-[12px] text-[var(--ie-ink)] disabled:opacity-50"
      onClick={onClick}
    >
      <span aria-hidden className="text-[13px] leading-none">↻</span>
      重置
    </button>
  );
}

function FilterTile({
  item,
  imageUrl,
  selected,
  disabled,
  onPick,
}: {
  item: GradePick;
  imageUrl: string | null;
  selected: boolean;
  disabled: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "overflow-hidden rounded-lg border bg-white text-left disabled:opacity-50",
        selected ? "border-[var(--ie-ink)]" : "border-[var(--ie-border-soft)]",
      )}
      onClick={() => onPick(item.id)}
    >
      <span className="block aspect-square overflow-hidden bg-[var(--ie-cream-muted)]">
        {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" style={{ filter: item.preview }} /> : null}
      </span>
      <span className="block truncate px-1 py-1 text-center text-[12px] text-[var(--ie-ink)]">{item.label}</span>
    </button>
  );
}

function sampleSwatches(imageUrl: string): Promise<Array<[number, number, number]>> {
  return new Promise((resolve) => {
    const img = new Image();
    let triedPlain = false;
    const draw = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 12;
      canvas.height = 12;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve([]);
        return;
      }
      ctx.drawImage(img, 0, 0, 12, 12);
      try {
        const data = ctx.getImageData(0, 0, 12, 12).data;
        const found: Array<[number, number, number]> = [];
        for (let i = 0; i < data.length; i += 16) {
          const rgb: [number, number, number] = [data[i]!, data[i + 1]!, data[i + 2]!];
          if (found.some((row) => Math.hypot(row[0] - rgb[0], row[1] - rgb[1], row[2] - rgb[2]) < 36)) continue;
          found.push(rgb);
          if (found.length >= 5) break;
        }
        resolve(found);
      } catch {
        resolve([]);
      }
    };
    img.onload = draw;
    img.onerror = () => {
      if (triedPlain) {
        resolve([]);
        return;
      }
      triedPlain = true;
      img.removeAttribute("crossorigin");
      img.src = imageUrl;
    };
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
  });
}

function rgbCss(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export function ImageEditorColorGroupBody({
  group,
  imageUrl,
  disabled,
  selectedId,
  draft,
  onDraft,
  onPick,
  onAdjust,
  onRestore,
  onOpenBasic,
  eraseArmed,
  eraseBrush,
  onEraseArm,
  onEraseBrush,
  onEraseClear,
}: {
  group: "basic" | "advanced" | "filter" | "recolor" | "product";
  imageUrl: string | null;
  disabled: boolean;
  selectedId: string | null;
  draft: ColorAdjust;
  onDraft: (next: ColorAdjust, commit: boolean, label: string) => void;
  onPick: (id: string) => void;
  onAdjust: (adjust: ColorAdjust, label: string) => void;
  onRestore: () => void;
  onOpenBasic: () => void;
  eraseArmed: boolean;
  eraseBrush: number;
  onEraseArm: (armed: boolean) => void;
  onEraseBrush: (size: number) => void;
  onEraseClear: () => void;
}) {
  const [advancedTab, setAdvancedTab] = useState<(typeof ADVANCED_TABS)[number]["id"]>("light");
  const [splitSide, setSplitSide] = useState<"highlight" | "shadow">("highlight");
  const [hslIndex, setHslIndex] = useState(0);
  const [filterMore, setFilterMore] = useState(false);
  const [productMode, setProductMode] = useState<"cut" | "keep">("cut");
  const [productId, setProductId] = useState<string>("general");
  const [swatches, setSwatches] = useState<Array<[number, number, number]>>([]);
  const [source, setSource] = useState<[number, number, number] | null>(null);
  const [target, setTarget] = useState<[number, number, number] | null>(null);
  const [tolerance, setTolerance] = useState(0);
  const sourceInput = useRef<HTMLInputElement>(null);
  const targetInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (group !== "recolor" || !imageUrl) return;
    let cancelled = false;
    void sampleSwatches(imageUrl).then((rows) => {
      if (!cancelled) setSwatches(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [group, imageUrl]);

  const patch = (partial: Partial<ColorAdjust>, commit: boolean, label: string) => {
    const next = { ...draft, ...partial };
    onDraft(next, commit, label);
  };

  if (group === "basic") {
    return (
      <div className="space-y-1 px-3 pb-3">
        {BASIC_SLIDERS.map((spec) => (
          <SliderRow
            key={spec.key}
            spec={spec}
            value={num(draft, spec.key)}
            disabled={disabled || !imageUrl}
            onChange={(value, commit) => patch({ [spec.key]: value }, commit, "基础调色")}
          />
        ))}
        <ResetButton
          disabled={disabled}
          onClick={() => {
            const next = { ...draft };
            for (const key of BASIC_KEYS) delete next[key];
            onDraft(next, true, "基础调色");
          }}
        />
      </div>
    );
  }

  if (group === "advanced") {
    const slidersDisabled = disabled || !imageUrl;
    const splitRgb = splitSide === "highlight" ? draft.splitHighlightRgb : draft.splitShadowRgb;
    const splitSat = splitSide === "highlight" ? num(draft, "splitHighlightSat") : num(draft, "splitShadowSat");
    const splitIndex = Math.max(0, SPLIT_COLORS.findIndex((color) => sameRgb(splitRgb, color.rgb)));
    const hslBand = draft.hslBands?.[hslIndex] ?? [0, 0, 0];
    const writeSplit = (index: number, sat: number, commit: boolean) => {
      const rgb = SPLIT_COLORS[index]?.rgb ?? SPLIT_COLORS[0]!.rgb;
      if (splitSide === "highlight") patch({ splitHighlightRgb: rgb, splitHighlightSat: sat }, commit, "高级调色");
      else patch({ splitShadowRgb: rgb, splitShadowSat: sat }, commit, "高级调色");
    };
    const writeHsl = (axis: 0 | 1 | 2, value: number, commit: boolean) => {
      const bands = draft.hslBands ? draft.hslBands.map((band) => [...band] as [number, number, number]) : emptyHslBands();
      while (bands.length < 6) bands.push([0, 0, 0]);
      bands[hslIndex]![axis] = value;
      patch({ hslBands: bands }, commit, "高级调色");
    };
    return (
      <div className="space-y-1 px-3 pb-3">
        <div className="grid grid-cols-5 gap-0.5 overflow-hidden rounded-lg bg-[var(--ie-cream-muted)] p-1">
          {ADVANCED_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={advancedTab === tab.id}
              className={cn(
                "min-w-0 rounded-md px-0 py-1 text-center text-[12px] whitespace-nowrap",
                advancedTab === tab.id ? "bg-white font-medium text-[var(--ie-ink)] shadow-sm" : "text-[var(--ie-muted)]",
              )}
              onClick={() => setAdvancedTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {advancedTab === "light" || advancedTab === "color" || advancedTab === "detail"
          ? ADVANCED_SLIDERS[advancedTab].map((spec) => (
              <SliderRow
                key={spec.key}
                spec={spec}
                value={num(draft, spec.key)}
                disabled={slidersDisabled}
                onChange={(value, commit) => patch({ [spec.key]: value }, commit, "高级调色")}
              />
            ))
          : null}
        {advancedTab === "split" ? (
          <>
            <div className="grid grid-cols-2 rounded-full bg-[var(--ie-cream-muted)] p-1">
              {(
                [
                  ["highlight", "高光"],
                  ["shadow", "阴影"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={splitSide === id}
                  className={cn(
                    "h-8 rounded-full text-[13px]",
                    splitSide === id ? "bg-white font-medium text-[var(--ie-ink)] shadow-sm" : "text-[var(--ie-muted)]",
                  )}
                  onClick={() => setSplitSide(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-6 gap-2 px-0.5">
              {SPLIT_COLORS.map((color, index) => (
                <button
                  key={color.label}
                  type="button"
                  aria-label={color.label}
                  aria-pressed={splitIndex === index}
                  disabled={slidersDisabled}
                  className={cn(
                    "aspect-square rounded-md disabled:opacity-50",
                    splitIndex === index && "ring-2 ring-[var(--ie-ink)] ring-offset-2",
                  )}
                  style={{ background: `rgb(${color.rgb.join(",")})` }}
                  onClick={() => writeSplit(index, splitSat, splitSat !== 0)}
                />
              ))}
            </div>
            <SliderRow
              spec={SPLIT_SAT_SLIDER}
              value={splitSat}
              disabled={slidersDisabled}
              onChange={(value, commit) => writeSplit(splitIndex, value, commit)}
            />
          </>
        ) : null}
        {advancedTab === "hsl" ? (
          <>
            <div className="grid grid-cols-6 gap-2 px-0.5">
              {HSL_CHIPS.map((chip, index) => (
                <button
                  key={chip.label}
                  type="button"
                  aria-label={chip.label}
                  aria-pressed={hslIndex === index}
                  className={cn(
                    "aspect-square rounded-md",
                    hslIndex === index && "ring-2 ring-[var(--ie-ink)] ring-offset-2",
                  )}
                  style={{ background: chip.color }}
                  onClick={() => setHslIndex(index)}
                />
              ))}
            </div>
            {HSL_SLIDERS.map((spec) => (
              <SliderRow
                key={spec.label}
                spec={{ key: "hue", label: spec.label, min: -100, max: 100, gradient: spec.gradient }}
                value={hslBand[spec.axis] ?? 0}
                disabled={slidersDisabled}
                onChange={(value, commit) => writeHsl(spec.axis, value, commit)}
              />
            ))}
          </>
        ) : null}
        <ResetButton disabled={disabled} onClick={() => onDraft(resetAdvancedTab(draft, advancedTab), true, "高级调色")} />
      </div>
    );
  }

  if (group === "filter") {
    const base = filterMore ? [...FILTER_BASE, ...FILTER_BASE_MORE] : FILTER_BASE;
    return (
      <div className="space-y-3 px-3 pb-3">
        <div>
          <p className="mb-2 text-[13px] font-medium text-[var(--ie-ink)]">常用滤镜</p>
          <button
            type="button"
            disabled={disabled || !imageUrl}
            className="w-[31%] overflow-hidden rounded-lg border border-[var(--ie-border-soft)] bg-white disabled:opacity-50"
            onClick={onRestore}
          >
            <span className="grid aspect-square place-items-center bg-[var(--ie-cream-muted)] text-[var(--ie-muted)]">
              <Ban className="h-7 w-7" aria-hidden />
            </span>
            <span className="block py-1 text-center text-[12px] text-[var(--ie-ink)]">无滤镜</span>
          </button>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-medium text-[var(--ie-ink)]">基础</p>
            <button type="button" className="text-[12px] text-[var(--ie-muted)]" onClick={() => setFilterMore((open) => !open)}>
              {filterMore ? "收起" : "查看更多 >"}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {base.map((item) => (
              <FilterTile key={item.id} item={item} imageUrl={imageUrl} selected={selectedId === item.id} disabled={disabled || !imageUrl} onPick={onPick} />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-medium text-[var(--ie-ink)]">自然</p>
          <div className="grid grid-cols-3 gap-2">
            {FILTER_NATURAL.map((item) => (
              <FilterTile key={item.id} item={item} imageUrl={imageUrl} selected={selectedId === item.id} disabled={disabled || !imageUrl} onPick={onPick} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (group === "recolor") {
    const applyRecolor = (nextSource: [number, number, number] | null, nextTarget: [number, number, number] | null, nextTolerance: number) => {
      if (!nextSource || !nextTarget) return;
      onAdjust(
        {
          recolorSource: nextSource,
          recolorTarget: nextTarget,
          recolorTolerance: nextTolerance,
        },
        "换色",
      );
    };
    return (
      <div className="space-y-3 px-3 pb-3">
        <div>
          <p className="text-[13px] font-medium text-[var(--ie-ink)]">源颜色 <span className="text-[12px] font-normal text-[var(--ie-muted)]">选择图片中的一种颜色</span></p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || !imageUrl}
              aria-label="吸取颜色"
              className="grid h-8 w-8 place-items-center rounded-md border border-[var(--ie-border-soft)] bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] disabled:opacity-50"
              onClick={() => sourceInput.current?.click()}
            >
              <Pipette className="h-3.5 w-3.5 text-white drop-shadow" aria-hidden />
            </button>
            <input
              ref={sourceInput}
              type="color"
              className="sr-only"
              aria-label="源颜色"
              onChange={(e) => {
                const rgb = hexToRgb(e.target.value);
                setSource(rgb);
                applyRecolor(rgb, target, tolerance);
              }}
            />
            {swatches.map((rgb) => (
              <button
                key={rgb.join("-")}
                type="button"
                disabled={disabled}
                aria-label={`源颜色 ${rgbCss(rgb)}`}
                className={cn("h-8 w-8 rounded-md border", source && source.join() === rgb.join() ? "border-[var(--ie-ink)]" : "border-transparent")}
                style={{ background: rgbCss(rgb) }}
                onClick={() => {
                  setSource(rgb);
                  applyRecolor(rgb, target, tolerance);
                }}
              />
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1 flex items-center justify-between text-[12px] text-[var(--ie-ink)]">
            颜色容差
            <span className="rounded-md border border-[var(--ie-border-soft)] px-2 py-0.5">{tolerance}</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={tolerance}
            disabled={disabled || !imageUrl}
            aria-label="颜色容差"
            className="w-full accent-[var(--ie-ink)]"
            onChange={(e) => setTolerance(Number(e.target.value))}
            onPointerUp={(e) => {
              const next = Number((e.target as HTMLInputElement).value);
              setTolerance(next);
              applyRecolor(source, target, next);
            }}
          />
        </label>
        <div>
          <p className="text-[13px] font-medium text-[var(--ie-ink)]">目标颜色 <span className="text-[12px] font-normal text-[var(--ie-muted)]">需要替换成的颜色</span></p>
          <button
            type="button"
            disabled={disabled || !imageUrl}
            className="mt-2 flex h-8 w-full items-center justify-center gap-1 rounded-md border border-[var(--ie-border)] bg-white text-[12px] text-[var(--ie-ink)] disabled:opacity-50"
            style={target ? { background: rgbCss(target) } : undefined}
            onClick={() => targetInput.current?.click()}
          >
            {target ? null : <Plus className="h-4 w-4" aria-hidden />}
            {target ? "已选目标色" : "选择颜色"}
          </button>
          <input
            ref={targetInput}
            type="color"
            className="sr-only"
            aria-label="目标颜色"
            onChange={(e) => {
              const rgb = hexToRgb(e.target.value);
              setTarget(rgb);
              applyRecolor(source, rgb, tolerance);
            }}
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-medium text-[var(--ie-ink)]">擦除 <span className="text-[12px] font-normal text-[var(--ie-muted)]">涂抹要保留原色的区域</span></p>
            <button type="button" className="inline-flex items-center gap-1 text-[12px] text-[var(--ie-ink)]" onClick={onEraseClear}>
              清空
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={eraseArmed}
              aria-label="涂抹保留原色"
              className={cn(
                "grid h-8 w-8 place-items-center rounded-lg border",
                eraseArmed ? "border-[var(--ie-ink)] bg-[var(--ie-ink)] text-[var(--ie-cream)]" : "border-[var(--ie-border-soft)] text-[var(--ie-ink)]",
              )}
              onClick={() => onEraseArm(!eraseArmed)}
            >
              <Eraser className="h-4 w-4" aria-hidden />
            </button>
            <input
              type="range"
              min={8}
              max={80}
              value={eraseBrush}
              aria-label="擦除笔触"
              className="min-w-0 flex-1 accent-[var(--ie-ink)]"
              onChange={(e) => onEraseBrush(Number(e.target.value))}
            />
            <span className="w-8 text-right text-[12px] text-[var(--ie-ink)]">{eraseBrush}</span>
          </div>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-medium text-[var(--ie-ink)]">推荐效果</p>
          <div className="grid grid-cols-3 gap-2">
            {RECOLOR_PICKS.map((item) => (
              <FilterTile key={item.id} item={item} imageUrl={imageUrl} selected={selectedId === item.id} disabled={disabled || !imageUrl} onPick={onPick} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={disabled} className="h-8 rounded-md border border-[var(--ie-border)] bg-white text-[12px] text-[var(--ie-ink)] disabled:opacity-50" onClick={() => { setSource(null); setTarget(null); setTolerance(0); onEraseClear(); onRestore(); }}>
            重置效果
          </button>
          <button type="button" className="h-8 rounded-md border border-[var(--ie-border)] bg-white text-[12px] text-[var(--ie-ink)]" onClick={onOpenBasic}>
            手动调色
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-3 pb-3">
      <div className="grid grid-cols-2 gap-0.5 rounded-full bg-[var(--ie-cream-muted)] p-0.5">
        {([
          ["cut", "抠图精修"],
          ["keep", "保留背景"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "h-7 rounded-full text-[12px]",
              productMode === id ? "bg-white font-medium text-[var(--ie-ink)] shadow-sm" : "text-[var(--ie-muted)]",
            )}
            onClick={() => setProductMode(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-[12px] font-medium text-[var(--ie-ink)]">选择商品</p>
      <div className="space-y-1">
        {PRODUCTS.map((item) => {
          const Icon = item.icon;
          const selected = productId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled || !imageUrl}
              aria-pressed={selected}
              className={cn(
                "flex h-9 w-full items-center gap-2 rounded-lg border px-3 text-left text-[13px] disabled:opacity-50",
                selected ? "border-[var(--ie-ink)] bg-white font-medium text-[var(--ie-ink)]" : "border-transparent bg-[var(--ie-cream-muted)] text-[var(--ie-ink)]",
              )}
              onClick={() => setProductId(item.id)}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={disabled || !imageUrl}
        className="h-8 w-full rounded-md bg-[var(--ecom-btn-fill)] text-[12px] font-medium text-[var(--ecom-btn-on-fill)] hover:bg-[var(--ecom-btn-fill-hover)] disabled:opacity-50"
        onClick={() => {
          const item = PRODUCTS.find((row) => row.id === productId);
          if (!item || !imageUrl) return;
          onAdjust({ ...item.adjust, cleanWhite: productMode === "cut" }, item.label);
        }}
      >
        一键精修
      </button>
    </div>
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

export function RecolorProtectLayer({
  brushSize,
  onStroke,
  onStrokeEnd,
}: {
  brushSize: number;
  onStroke: (stroke: ColorAdjustStroke) => void;
  onStrokeEnd: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width));
      canvas.height = Math.max(1, Math.round(rect.height));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const paint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const r = (brushSize / 2) / rect.width;
    ctx.fillStyle = "rgba(42, 36, 32, 0.28)";
    ctx.beginPath();
    ctx.arc(x * canvas.width, y * canvas.height, r * canvas.width, 0, Math.PI * 2);
    ctx.fill();
    onStroke({ x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)), r: Math.min(0.25, Math.max(0.002, r)) });
  };

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 z-[30] h-full w-full cursor-crosshair touch-none"
      onPointerDown={(event) => {
        drawing.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        paint(event);
      }}
      onPointerMove={(event) => {
        if (drawing.current) paint(event);
      }}
      onPointerUp={() => {
        if (!drawing.current) return;
        drawing.current = false;
        onStrokeEnd();
      }}
      onPointerCancel={() => {
        drawing.current = false;
      }}
    />
  );
}
