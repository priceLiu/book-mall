"use client";

import { ChevronDown, ChevronUp, Plus, RotateCcw, Trash2 } from "lucide-react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { DetailPageSuiteHitParadigmPanel } from "@/components/detail-page-suite/detail-page-suite-hit-paradigm-panel";
import {
  onHitComponentTypeChange,
  sanitizeHitComponent,
  sanitizeHitTemplateDraft,
} from "@/lib/detail-page-suite-hit-template-client";
import {
  HIT_COMPONENT_LABELS,
  HIT_COMPONENT_TYPES,
  HIT_LAYOUT_LABELS,
  HIT_LAYOUTS,
  HIT_REPEAT_COUNT_MAX,
  type HitComponent,
  type HitComponentType,
  type HitLayout,
  type HitTemplate,
} from "@/lib/detail-page-suite-hit-types";

type Props = {
  template: HitTemplate;
  busy?: boolean;
  onChange: (next: HitTemplate) => void;
  onReset?: () => void;
  onRewrite?: () => void;
  rewriteBusy?: boolean;
};

function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const next = [...list];
  const target = index + dir;
  if (target < 0 || target >= next.length) return list;
  const tmp = next[index]!;
  next[index] = next[target]!;
  next[target] = tmp;
  return next;
}

function defaultComponent(type: HitComponentType): HitComponent {
  return {
    id: `hit_${type}_${Date.now().toString(36)}`,
    type,
    layout: type === "spec_table" ? "table" : type === "full_banner" ? "full_image" : "image_text_top_bottom",
    repeat_count: 1,
    user_editable_count: true,
    text_slot: {
      max_char: type === "full_banner" ? 16 : 36,
      text_type: type === "full_banner" ? "banner钩子" : "卖点利益",
    },
    image_slot: {
      composition: type === "detail_closeup" ? "特写" : "半身",
      need_scene_bg: type === "scene_image" || type === "full_banner",
    },
  };
}

export function DetailPageSuiteHitComponentEditor({
  template,
  busy,
  onChange,
  onReset,
  onRewrite,
  rewriteBusy,
}: Props) {
  function patchList(list: HitComponent[]) {
    onChange(sanitizeHitTemplateDraft({ ...template, component_list: list }));
  }

  function patchComponent(index: number, patch: Partial<HitComponent>) {
    patchList(
      template.component_list.map((c, i) => {
        if (i !== index) return c;
        if (patch.type && patch.type !== c.type) {
          return onHitComponentTypeChange({ ...c, ...patch }, patch.type);
        }
        return sanitizeHitTemplateDraft({
          ...template,
          component_list: [{ ...c, ...patch }],
        }).component_list[0]!;
      }),
    );
  }

  return (
    <div className="border-b border-[#e8e8ed] bg-white px-5 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#1d1d1f]">
            爆款结构（{template.component_list.length} 个卡位）
          </h2>
          <p className="mt-0.5 text-[11px] text-[#86868b]">
            {template.template_name}
            {template.category_tag?.length ? ` · ${template.category_tag.join(" / ")}` : ""}
            {" · 画布 "}
            {template.canvas_width ?? 750}px
            {template.global_copy_style ? ` · ${template.global_copy_style}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onReset ? (
            <EcomButtonSecondary size="sm" type="button" disabled={busy} onClick={onReset}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              重置为 AI 结构
            </EcomButtonSecondary>
          ) : null}
          <EcomButtonSecondary
            size="sm"
            type="button"
            disabled={busy}
            onClick={() => patchList([...template.component_list, defaultComponent("feature_card")])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            新增卡位
          </EcomButtonSecondary>
          {onRewrite ? (
            <EcomButtonPrimary
              size="sm"
              type="button"
              disabled={busy || template.component_list.length === 0}
              onClick={onRewrite}
            >
              {rewriteBusy ? "生成中…" : "生成原创文案与 Prompt"}
            </EcomButtonPrimary>
          ) : null}
        </div>
      </div>

      <DetailPageSuiteHitParadigmPanel
        template={template}
        busy={busy}
        onChange={(next) => onChange(sanitizeHitTemplateDraft(next))}
      />

      <ul className="space-y-2">
        {template.component_list.map((comp, index) => {
          const max = HIT_REPEAT_COUNT_MAX;
          const editableCount = comp.user_editable_count !== false;
          return (
            <li
              key={comp.id}
              className="rounded-lg border border-[#e8e8ed] bg-[#fafafa] p-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-6 text-[#86868b]">{index + 1}</span>
                <select
                  className="rounded-md border border-[#d2d2d7] bg-white px-2 py-1"
                  disabled={busy}
                  value={comp.type}
                  onChange={(e) => {
                    const type = e.target.value as HitComponentType;
                    patchComponent(index, {
                      type,
                      user_editable_count: true,
                      repeat_count: sanitizeHitComponent({ ...comp, type }).repeat_count,
                    });
                  }}
                >
                  {HIT_COMPONENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {HIT_COMPONENT_LABELS[t]}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-md border border-[#d2d2d7] bg-white px-2 py-1"
                  disabled={busy}
                  value={comp.layout}
                  onChange={(e) =>
                    patchComponent(index, { layout: e.target.value as HitLayout })
                  }
                >
                  {HIT_LAYOUTS.map((l) => (
                    <option key={l} value={l}>
                      {HIT_LAYOUT_LABELS[l]}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-[#6e6e73]">
                  数量
                  <input
                    type="number"
                    min={1}
                    max={max}
                    className="w-14 rounded-md border border-[#d2d2d7] bg-white px-1 py-1"
                    disabled={busy || !editableCount}
                    value={comp.repeat_count}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) return;
                      patchComponent(index, {
                        repeat_count: Math.min(max, Math.max(1, Math.round(n))),
                      });
                    }}
                  />
                </label>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded-md border border-[#d2d2d7] p-1 disabled:opacity-40"
                    disabled={busy || index === 0}
                    onClick={() => patchList(moveItem(template.component_list, index, -1))}
                    aria-label="上移"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-[#d2d2d7] p-1 disabled:opacity-40"
                    disabled={busy || index === template.component_list.length - 1}
                    onClick={() => patchList(moveItem(template.component_list, index, 1))}
                    aria-label="下移"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-[#d2d2d7] p-1 text-red-600 disabled:opacity-40"
                    disabled={busy || template.component_list.length <= 1}
                    onClick={() =>
                      patchList(template.component_list.filter((_, i) => i !== index))
                    }
                    aria-label="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {comp.note ? <p className="mt-1 text-[#6e6e73]">{comp.note}</p> : null}
              <p className="mt-1 text-[#86868b]">
                {comp.text_slot?.text_type ? `文案：${comp.text_slot.text_type}` : "文案插槽"}
                {comp.text_slot?.max_char ? ` ≤${comp.text_slot.max_char}字` : ""}
                {comp.image_slot?.composition ? ` · 构图 ${comp.image_slot.composition}` : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
