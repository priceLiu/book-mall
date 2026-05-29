"use client";

import type { CanvasParamSchema } from "@/lib/canvas-providers-api";
import { onCanvasFormWheel } from "@/lib/canvas/canvas-form-wheel";
import { RF_FORM_CONTROL, RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";

export type DynamicParamFormProps = {
  schema: CanvasParamSchema | null | undefined;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** compact=节点内折叠；panel=弹层大面板（分段按钮 / 滑条） */
  variant?: "compact" | "panel";
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

  if (variant === "panel") {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {schema.map((item) => (
            <PanelField
              key={item.key}
              item={item}
              cur={value[item.key]}
              onPatch={(v) => onChange({ ...value, [item.key]: v })}
            />
          ))}
        </div>
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
}: {
  item: CanvasParamSchema[number];
  cur: unknown;
  onPatch: (v: unknown) => void;
}) {
  if (item.type === "select") {
    const val = String(cur ?? item.defaultValue ?? item.options[0]?.value ?? "");
    const spanFull = item.options.length > 4;
    return (
      <div className={spanFull ? "sm:col-span-2" : undefined}>
        <label className="block text-[12px] text-white/60">{item.label}</label>
        <div className="mt-2 inline-flex max-w-full flex-wrap overflow-hidden rounded-lg border border-white/15">
          {item.options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onPatch(o.value)}
              className={[
                "px-3 py-1.5 text-[13px] transition",
                val === o.value
                  ? "bg-white text-black"
                  : "text-white/85 hover:bg-white/5",
              ].join(" ")}
            >
              {o.label}
            </button>
          ))}
        </div>
        {item.help ? (
          <p className="mt-1 text-[10px] text-white/45">{item.help}</p>
        ) : null}
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
      const unit = item.label.includes("token") ? "" : "";
      return (
        <div className="sm:col-span-2">
          <label className="block text-[12px] text-white/60">
            {item.label}
            {item.min != null && item.max != null
              ? `（${item.min}~${item.max}）`
              : null}
          </label>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min={item.min}
              max={item.max}
              step={step}
              value={num}
              onChange={(e) => onPatch(Number(e.target.value))}
              className={`${RF_NODE_SCROLL} flex-1 accent-[var(--canvas-accent,#a78bfa)]`}
            />
            <span className="min-w-[3.5rem] rounded-md border border-white/15 px-2 py-1 text-center text-[12px] text-white/85">
              {num}
              {unit}
            </span>
          </div>
          {item.help ? (
            <p className="mt-1 text-[10px] text-white/45">{item.help}</p>
          ) : null}
        </div>
      );
    }

    return (
      <div>
        <label className="block text-[12px] text-white/60">{item.label}</label>
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
          className={`${RF_NODE_SCROLL} mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-[13px] text-white focus:border-[var(--canvas-accent)]/60 focus:outline-none`}
        />
        {item.help ? (
          <p className="mt-1 text-[10px] text-white/45">{item.help}</p>
        ) : null}
      </div>
    );
  }

  if (item.type === "boolean") {
    const checked = cur === undefined ? !!item.defaultValue : !!cur;
    return (
      <label className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 p-3 text-[12px] sm:col-span-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onPatch(e.target.checked)}
          className={`${RF_NODE_SCROLL} mt-0.5 accent-[var(--canvas-accent,#a78bfa)]`}
        />
        <span>
          <span className="font-medium text-white">{item.label}</span>
          {item.help ? (
            <span className="ml-1 text-white/50">{item.help}</span>
          ) : null}
        </span>
      </label>
    );
  }

  if (item.type === "textarea") {
    return (
      <div className="sm:col-span-2">
        <label className="block text-[12px] text-white/60">{item.label}</label>
        <textarea
          rows={3}
          value={typeof cur === "string" ? cur : item.defaultValue ?? ""}
          placeholder={item.placeholder}
          onChange={(e) => onPatch(e.target.value)}
          onWheel={onCanvasFormWheel}
          className={`${RF_FORM_CONTROL} mt-2 max-h-40 overflow-y-auto resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white focus:border-[var(--canvas-accent)]/60 focus:outline-none`}
        />
        {item.help ? (
          <p className="mt-1 text-[10px] text-white/45">{item.help}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <label className="block text-[12px] text-white/60">{item.label}</label>
      <input
        type="text"
        value={typeof cur === "string" ? cur : item.defaultValue ?? ""}
        placeholder={item.placeholder}
        onChange={(e) => onPatch(e.target.value)}
        className={`${RF_NODE_SCROLL} mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-[13px] text-white focus:border-[var(--canvas-accent)]/60 focus:outline-none`}
      />
      {item.help ? (
        <p className="mt-1 text-[10px] text-white/45">{item.help}</p>
      ) : null}
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
    return (
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-[var(--canvas-muted)]">
          {item.label}
        </span>
        <select
          value={String(cur ?? item.defaultValue ?? "")}
          onChange={(e) => onPatch(e.target.value)}
          onWheel={onCanvasFormWheel}
          className={`${RF_FORM_CONTROL} mt-0.5 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white focus:border-[var(--canvas-accent)]/60 focus:outline-none`}
        >
          {item.options.map((o) => (
            <option key={o.value} value={o.value}>
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
          className={`${RF_NODE_SCROLL} mt-0.5 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white focus:border-[var(--canvas-accent)]/60 focus:outline-none`}
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
          className={`${RF_FORM_CONTROL} mt-0.5 max-h-32 w-full resize-none overflow-y-auto rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white focus:border-[var(--canvas-accent)]/60 focus:outline-none`}
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
        className={`${RF_NODE_SCROLL} mt-0.5 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white focus:border-[var(--canvas-accent)]/60 focus:outline-none`}
      />
    </label>
  );
}
