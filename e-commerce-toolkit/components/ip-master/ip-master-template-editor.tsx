"use client";

import { Plus, Trash2 } from "lucide-react";

import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { IP_MASTER_OFFICIAL_FLEXIBLE_FEATURES } from "@/lib/ip-master-flexible-official";
import type {
  IpMasterFlexibleFeature,
  IpMasterRigidFeature,
  IpMasterTemplate,
} from "@/lib/ip-master-template-types";

type Props = {
  template: IpMasterTemplate;
  onChange: (next: IpMasterTemplate) => void;
  disabled?: boolean;
};

export function IpMasterTemplateEditor({ template, onChange, disabled }: Props) {
  const setMeta = (patch: Partial<IpMasterTemplate["ipMeta"]>) => {
    onChange({ ...template, ipMeta: { ...template.ipMeta, ...patch } });
  };

  const updateRigid = (index: number, patch: Partial<IpMasterRigidFeature>) => {
    const next = [...template.rigidFeatures];
    next[index] = { ...next[index]!, ...patch };
    onChange({ ...template, rigidFeatures: next });
  };

  const updateFlexOfficial = (index: number, description: string) => {
    const next = [...template.flexibleFeatures];
    const def = IP_MASTER_OFFICIAL_FLEXIBLE_FEATURES[index];
    if (!def) return;
    next[index] = { featureName: def.featureName, description };
    onChange({ ...template, flexibleFeatures: next });
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-[#6e6e73]">
          IP 名称
          <input
            className="mt-1 w-full rounded-lg border border-[#d2d2d7] px-2.5 py-2 text-sm"
            value={template.ipMeta.ipName}
            disabled={disabled}
            onChange={(e) => setMeta({ ipName: e.target.value })}
          />
        </label>
        <label className="block text-xs font-medium text-[#6e6e73] sm:col-span-2">
          风格一句话
          <input
            className="mt-1 w-full rounded-lg border border-[#d2d2d7] px-2.5 py-2 text-sm"
            value={template.ipMeta.styleSummary ?? ""}
            disabled={disabled}
            onChange={(e) => setMeta({ styleSummary: e.target.value })}
          />
        </label>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6e6e73]">
            刚性特征
          </h3>
          <EcomButtonSecondary
            type="button"
            size="sm"
            disabled={disabled}
            className="h-7 gap-1 px-2 text-[10px]"
            onClick={() =>
              onChange({
                ...template,
                rigidFeatures: [
                  ...template.rigidFeatures,
                  { featureName: "新锚点", description: "", weight: 0.85 },
                ],
              })
            }
          >
            <Plus className="h-3 w-3" />
            添加
          </EcomButtonSecondary>
        </div>
        <ul className="space-y-2">
          {template.rigidFeatures.map((f, i) => (
            <li key={i} className="rounded-lg border border-[#e8e8ed] p-2">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input
                  className="w-28 rounded-lg border border-[#d2d2d7] px-2 py-1.5 text-sm"
                  value={f.featureName}
                  disabled={disabled}
                  onChange={(e) => updateRigid(i, { featureName: e.target.value })}
                />
                <label className="flex items-center gap-1 text-xs text-[#6e6e73]">
                  权重
                  <input
                    type="number"
                    min={0.5}
                    max={1}
                    step={0.05}
                    className="w-16 rounded-lg border border-[#d2d2d7] px-2 py-1 text-sm"
                    value={f.weight}
                    disabled={disabled}
                    onChange={(e) =>
                      updateRigid(i, { weight: Number(e.target.value) || 0.85 })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="ml-auto rounded-lg p-2 text-[#86868b] hover:bg-[#f5f5f7]"
                  disabled={disabled}
                  aria-label="删除"
                  onClick={() =>
                    onChange({
                      ...template,
                      rigidFeatures: template.rigidFeatures.filter((_, j) => j !== i),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <textarea
                className="min-h-[72px] w-full rounded-lg border border-[#d2d2d7] px-2 py-1.5 text-sm"
                placeholder="生图正向 prompt 描述"
                value={f.description}
                disabled={disabled}
                onChange={(e) => updateRigid(i, { description: e.target.value })}
              />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#6e6e73]">
          柔性特征（官方 6 项）
        </h3>
        <p className="mb-3 text-[11px] leading-relaxed text-[#86868b]">
          由大模型根据 Brief / 基准图自动填充具象内容（色值、变体、线条规范等）；可在此校对。
        </p>
        <ul className="space-y-3">
          {IP_MASTER_OFFICIAL_FLEXIBLE_FEATURES.map((def, i) => {
            const row: IpMasterFlexibleFeature = template.flexibleFeatures[i] ?? {
              featureName: def.featureName,
              description: "",
            };
            return (
              <li
                key={def.featureName}
                className="rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-3"
              >
                <p className="text-sm font-medium text-[#1d1d1f]">{def.featureName}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#6e6e73]">
                  {def.fieldGuide}
                </p>
                <textarea
                  className="mt-2 min-h-[88px] w-full rounded-lg border border-[#d2d2d7] bg-white px-2.5 py-2 text-sm leading-relaxed"
                  placeholder={`填写示例：${def.fillExample.slice(0, 120)}…`}
                  value={row.description}
                  disabled={disabled}
                  onChange={(e) => updateFlexOfficial(i, e.target.value)}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <label className="block text-xs font-medium text-[#6e6e73]">
        柔性全局软约束
        <textarea
          className="mt-1 min-h-[80px] w-full rounded-lg border border-[#d2d2d7] px-2.5 py-2 text-sm"
          value={template.softConstraint}
          disabled={disabled}
          onChange={(e) => onChange({ ...template, softConstraint: e.target.value })}
        />
      </label>
      <label className="block text-xs font-medium text-[#6e6e73]">
        特例放行（可选）
        <textarea
          className="mt-1 min-h-[60px] w-full rounded-lg border border-[#d2d2d7] px-2.5 py-2 text-sm"
          value={template.exceptionRule ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...template, exceptionRule: e.target.value })}
        />
      </label>
      <label className="block text-xs font-medium text-[#6e6e73]">
        人设摘要（可选）
        <textarea
          className="mt-1 min-h-[60px] w-full rounded-lg border border-[#d2d2d7] px-2.5 py-2 text-sm"
          value={template.characterSummary ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...template, characterSummary: e.target.value })}
        />
      </label>
    </div>
  );
}
