"use client";

import type { CanvasParamSchema } from "@/lib/canvas-providers-api";
import { onCanvasFormWheel } from "@/lib/canvas/canvas-form-wheel";
import { RF_FORM_CONTROL, RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import { libtvDockSegmentButtonClass } from "@/components/canvas/libtv-dock-picker-chrome";
import { cn } from "@/lib/utils";

export type DynamicParamFormProps = {
  schema: CanvasParamSchema | null | undefined;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** compact=节点内折叠；panel=弹层大面板；dock=浮动 Dock 参数 Popover（紧凑、无亮白描边） */
  variant?: "compact" | "panel" | "dock";
};

/**
 * 按 paramsSchema 动态渲染参数表单。
 * - compact：节点内小表单
 * - panel：弹层风格（参照 story 视频生成：分段选择 / 滑条 / 复选框区）
 */
export function DynamicParamForm({
  schema,
  value,
  onChange,
  variant = "compact",
}: DynamicParamFormProps) {
  if (!schema || schema.length === 0) {
    return (
      <p
        className={
          variant === "panel"
            ? "text-[12px] text-white/50"
            : "text-[11px] text-[var(--canvas-muted)]"
        }
      >
        当前模型无可调参数
      </p>
    );
  }

  if (variant === "panel" || variant === "dock") {
    const isDock = variant === "dock";
    return (
      <div className={isDock ? "space-y-2.5" : "space-y-5"}>
        {schema.map((item) => (
          <PanelField
            key={item.key}
            item={item}
            cur={value[item.key]}
            onPatch={(v) => onChange({ ...value, [item.key]: v })}
            dock={isDock}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {schema.map((item) => (
        <CompactField
          key={item.key}
          item={item}
          cur={value[item.key]}
          onPatch={(v) => onChange({ ...value, [item.key]: v })}
        />
      ))}
    </div>
  );
}

/** 从 schema + defaultParams 合并出完整初始 params */
export function buildModelParams(
  model: {
    paramsSchema?: CanvasParamSchema | null;
    defaultParams?: Record<string, unknown> | null;
  },
  existing?: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(model.defaultParams ?? {}) };
  for (const item of model.paramsSchema ?? []) {
    if (
      "defaultValue" in item &&
      item.defaultValue !== undefined &&
      out[item.key] === undefined
    ) {
      out[item.key] = item.defaultValue;
    }
  }
  if (existing) {
    for (const item of model.paramsSchema ?? []) {
      if (existing[item.key] !== undefined) {
        out[item.key] = existing[item.key];
      }
    }
  }
  return out;
}

/* ── panel 风格（弹层） ── */

function PanelField({
  item,
  cur,
  onPatch,
  dock = false,
}: {
  item: CanvasParamSchema[number];
  cur: unknown;
  onPatch: (v: unknown) => void;
  dock?: boolean;
}) {
  if (item.type === "select") {
    const val = String(cur ?? item.defaultValue ?? item.options[0]?.value ?? "");
    return (
      <div>
        <p
          className={
            dock
              ? "mb-1.5 text-[12px] text-white/50"
              : "mb-2 text-[13px] text-white/85"
          }
        >
          {item.label}
        </p>
        <div
          className={
            dock
              ? "grid grid-cols-3 gap-1.5"
              : "flex flex-wrap gap-2"
          }
          role="group"
          aria-label={item.label}
        >
          {item.options.map((o) => {
            const active = val === o.value;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={active}
                onClick={() => onPatch(o.value)}
                className={
                  dock
                    ? libtvDockSegmentButtonClass(active, { compact: true })
                    : [
                        "min-w-[4.5rem] rounded-lg border px-4 py-2 text-[13px] font-medium transition",
                        active
                          ? "border-transparent bg-white/[0.10] text-white"
                          : "border-transparent bg-white/[0.04] text-white/65 hover:bg-white/[0.07] hover:text-white/85",
                      ].join(" ")
                }
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (item.type === "number") {
    const hasRange =
      typeof item.min === "number" && typeof item.max === "number";
    const num =
      typeof cur === "number"
        ? cur
        : typeof item.defaultValue === "number"
          ? item.defaultValue
          : item.min ?? 0;

    if (hasRange) {
      const step = item.step ?? 1;
      const suffix = item.label.includes("时长") ? "s" : "";
      return (
        <div>
          <p
            className={
              dock
                ? "mb-1.5 text-[12px] text-white/50"
                : "mb-2 text-[13px] text-white/85"
            }
          >
            {item.label}
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={item.min}
              max={item.max}
              step={step}
              value={num}
              onChange={(e) => onPatch(Number(e.target.value))}
              className={`${RF_NODE_SCROLL} h-1.5 flex-1 cursor-pointer accent-white`}
            />
            <span
              className={
                dock
                  ? "min-w-[2.5rem] text-right text-[12px] tabular-nums text-white/75"
                  : "min-w-[2.5rem] text-right text-[13px] font-medium text-white"
              }
            >
              {num}
              {suffix}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div>
        <p className="mb-2 text-[13px] text-white/85">{item.label}</p>
        <input
          type="number"
          min={item.min}
          max={item.max}
          step={item.step}
          value={num}
          onChange={(e) => {
            const v = e.target.value === "" ? undefined : Number(e.target.value);
            onPatch(v);
          }}
          className={`${RF_NODE_SCROLL} w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[13px] text-white focus:border-white/35 focus:outline-none`}
        />
      </div>
    );
  }

  if (item.type === "boolean") {
    const checked = cur === undefined ? !!item.defaultValue : !!cur;
    return (
      <div>
        <p
          className={
            dock
              ? "mb-1.5 text-[12px] text-white/50"
              : "mb-2 text-[13px] text-white/85"
          }
        >
          {item.label}
        </p>
        <div className="flex gap-2" role="group" aria-label={item.label}>
          {[
            { id: true, label: "开启" },
            { id: false, label: "关闭" },
          ].map((opt) => {
            const active = checked === opt.id;
            return (
              <button
                key={String(opt.id)}
                type="button"
                aria-pressed={active}
                onClick={() => onPatch(opt.id)}
                className={
                  dock
                    ? cn("flex-1", libtvDockSegmentButtonClass(active, { compact: true }))
                    : [
                        "flex-1 rounded-lg border px-4 py-2 text-[13px] font-medium transition",
                        active
                          ? "border-transparent bg-white/[0.10] text-white"
                          : "border-transparent bg-white/[0.04] text-white/65 hover:bg-white/[0.07] hover:text-white/85",
                      ].join(" ")
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (item.type === "textarea") {
    return (
      <div>
        <p className="mb-2 text-[13px] text-white/85">{item.label}</p>
        <textarea
          rows={3}
          value={typeof cur === "string" ? cur : item.defaultValue ?? ""}
          placeholder={item.placeholder}
          onChange={(e) => onPatch(e.target.value)}
          onWheel={onCanvasFormWheel}
          className={`${RF_FORM_CONTROL} max-h-40 w-full resize-y overflow-y-auto rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[13px] text-white focus:border-white/35 focus:outline-none`}
        />
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-[13px] text-white/85">{item.label}</p>
      <input
        type="text"
        value={typeof cur === "string" ? cur : item.defaultValue ?? ""}
        placeholder={item.placeholder}
        onChange={(e) => onPatch(e.target.value)}
        className={`${RF_NODE_SCROLL} w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[13px] text-white focus:border-white/35 focus:outline-none`}
      />
    </div>
  );
}

/* ── compact 风格（节点内） ── */

function CompactField({
  item,
  cur,
  onPatch,
}: {
  item: CanvasParamSchema[number];
  cur: unknown;
  onPatch: (v: unknown) => void;
}) {
  if (item.type === "select") {
    const val = String(cur ?? item.defaultValue ?? item.options[0]?.value ?? "");
    if (item.options.length <= 4) {
      return (
        <label className="col-span-2 block">
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/70">
            {item.label}
          </span>
          <div
            className="mt-1 flex w-full gap-0.5 rounded-md border border-white/15 bg-black/40 p-0.5"
            role="group"
            aria-label={item.label}
          >
            {item.options.map((o) => {
              const active = val === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onPatch(o.value)}
                  className={[
                    "min-h-[28px] flex-1 rounded px-2 py-1 text-[11px] font-semibold transition",
                    active
                      ? "bg-white/[0.12] text-white"
                      : "text-white/75 hover:bg-white/10",
                  ].join(" ")}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </label>
      );
    }
    return (
      <label className="block">
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/70">
          {item.label}
        </span>
        <select
          value={val}
          onChange={(e) => onPatch(e.target.value)}
          onWheel={onCanvasFormWheel}
          className={`${RF_FORM_CONTROL} mt-0.5 w-full rounded-md border border-white/15 bg-black/50 px-2 py-1.5 text-[11px] font-medium text-white focus:border-white/35 focus:outline-none`}
        >
          {item.options.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#1a1a24] text-white">
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (item.type === "number") {
    return (
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-[var(--canvas-muted)]">
          {item.label}
        </span>
        <input
          type="number"
          min={item.min}
          max={item.max}
          step={item.step}
          value={typeof cur === "number" ? cur : item.defaultValue ?? ""}
          onChange={(e) => {
            const v = e.target.value === "" ? undefined : Number(e.target.value);
            onPatch(v);
          }}
          className={`${RF_NODE_SCROLL} mt-0.5 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white focus:border-white/35 focus:outline-none`}
        />
      </label>
    );
  }
  if (item.type === "boolean") {
    const checked = cur === undefined ? !!item.defaultValue : !!cur;
    return (
      <label className="col-span-2 flex items-center gap-2 text-[11px] text-white/80">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onPatch(e.target.checked)}
          className={RF_NODE_SCROLL}
        />
        <span>{item.label}</span>
      </label>
    );
  }
  if (item.type === "textarea") {
    return (
      <label className="col-span-2 block">
        <span className="text-[10px] uppercase tracking-wider text-[var(--canvas-muted)]">
          {item.label}
        </span>
        <textarea
          rows={2}
          value={typeof cur === "string" ? cur : item.defaultValue ?? ""}
          placeholder={item.placeholder}
          onChange={(e) => onPatch(e.target.value)}
          onWheel={onCanvasFormWheel}
          className={`${RF_FORM_CONTROL} mt-0.5 max-h-32 w-full resize-none overflow-y-auto rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white focus:border-white/35 focus:outline-none`}
        />
      </label>
    );
  }
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-[var(--canvas-muted)]">
        {item.label}
      </span>
      <input
        type="text"
        value={typeof cur === "string" ? cur : item.defaultValue ?? ""}
        placeholder={item.placeholder}
        onChange={(e) => onPatch(e.target.value)}
        className={`${RF_NODE_SCROLL} mt-0.5 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white focus:border-white/35 focus:outline-none`}
      />
    </label>
  );
}
