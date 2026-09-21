"use client";

import {
  arrayToLines,
  HIT_GLOBAL_STYLE_FIELDS,
  HIT_GLOBAL_STYLE_LABELS,
  linesToArray,
  patchGlobalStyle,
  patchMarketInsight,
} from "@/lib/detail-page-suite-hit-paradigm-labels";
import type { HitTemplate } from "@/lib/detail-page-suite-hit-types";

type Props = {
  template: HitTemplate;
  busy?: boolean;
  onChange: (next: HitTemplate) => void;
};

export function DetailPageSuiteHitParadigmPanel({ template, busy, onChange }: Props) {
  const insight = template.market_insight;
  const style = template.global_style;

  function patchTemplate(patch: Partial<HitTemplate>) {
    onChange({ ...template, ...patch });
  }

  return (
    <div className="mb-3 space-y-3">
      <div className="rounded-lg border border-[#e8e8ed] bg-[#fafafa] p-3">
        <p className="text-xs font-semibold text-[#1d1d1f]">爆款洞察（参考详情逻辑，非竞品原句）</p>
        <p className="mt-0.5 text-[10px] text-[#86868b]">
          卖点维度与痛点来自拆解；可编辑后保存，将影响「生成原创文案与 Prompt」。
        </p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <label className="block text-[11px] text-[#424245]">
            爆款卖点维度（每行一条）
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-md border border-[#d2d2d7] bg-white px-2 py-1.5 text-xs"
              disabled={busy}
              value={arrayToLines(insight?.hot_selling_dimensions)}
              placeholder="例如：面料抗风、版型显瘦"
              onChange={(e) =>
                patchTemplate({
                  market_insight: patchMarketInsight(insight, {
                    hot_selling_dimensions: linesToArray(e.target.value),
                  }),
                })
              }
            />
          </label>
          <label className="block text-[11px] text-[#424245]">
            类目用户痛点（每行一条）
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-md border border-[#d2d2d7] bg-white px-2 py-1.5 text-xs"
              disabled={busy}
              value={arrayToLines(insight?.user_pain_points)}
              placeholder="例如：冬天灌冷风、容易起球"
              onChange={(e) =>
                patchTemplate({
                  market_insight: patchMarketInsight(insight, {
                    user_pain_points: linesToArray(e.target.value),
                  }),
                })
              }
            />
          </label>
          <label className="block text-[11px] text-[#424245] md:col-span-2">
            叙事顺序
            <input
              className="mt-1 w-full rounded-md border border-[#d2d2d7] bg-white px-2 py-1.5 text-xs"
              disabled={busy}
              value={insight?.narrative_sequence ?? ""}
              placeholder="先颜值 → 再面料 → 再穿着体验"
              onChange={(e) =>
                patchTemplate({
                  market_insight: patchMarketInsight(insight, {
                    narrative_sequence: e.target.value,
                  }),
                })
              }
            />
          </label>
          <label className="block text-[11px] text-[#424245]">
            文案口吻
            <input
              className="mt-1 w-full rounded-md border border-[#d2d2d7] bg-white px-2 py-1.5 text-xs"
              disabled={busy}
              value={insight?.copy_style ?? template.global_copy_style ?? ""}
              placeholder="简洁硬核 / 温柔种草"
              onChange={(e) => {
                const v = e.target.value;
                patchTemplate({
                  global_copy_style: v,
                  market_insight: patchMarketInsight(insight, { copy_style: v }),
                });
              }}
            />
          </label>
          <label className="block text-[11px] text-[#424245] md:col-span-2">
            核心文案功能（各模块抽象钩子，非原文；每行一条）
            <textarea
              className="mt-1 min-h-[56px] w-full rounded-md border border-[#d2d2d7] bg-white px-2 py-1.5 text-xs"
              disabled={busy}
              value={arrayToLines(insight?.module_copy_functions)}
              placeholder="首屏：季节痛点+利益承诺"
              onChange={(e) =>
                patchTemplate({
                  market_insight: patchMarketInsight(insight, {
                    module_copy_functions: linesToArray(e.target.value),
                  }),
                })
              }
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-[#e8e8ed] bg-[#fafafa] p-3">
        <p className="text-xs font-semibold text-[#1d1d1f]">视觉场景氛围（七维，用于重写出图场景段）</p>
        <p className="mt-0.5 text-[10px] text-[#86868b]">
          从竞品长图提炼的环境参数；生成 Prompt 时大模型会据此 + 新品重写全新场景描述。
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {HIT_GLOBAL_STYLE_FIELDS.map((key) => (
            <label key={key} className="block text-[11px] text-[#424245]">
              {HIT_GLOBAL_STYLE_LABELS[key]}
              <input
                className="mt-1 w-full rounded-md border border-[#d2d2d7] bg-white px-2 py-1.5 text-xs"
                disabled={busy}
                value={style?.[key] ?? ""}
                onChange={(e) =>
                  patchTemplate({
                    global_style: patchGlobalStyle(style, key, e.target.value),
                  })
                }
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
