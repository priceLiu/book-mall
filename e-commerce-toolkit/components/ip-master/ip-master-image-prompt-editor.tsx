"use client";

import type { IpMasterImagePrompt } from "@/lib/ip-master-template-types";

type Props = {
  value: IpMasterImagePrompt;
  onChange: (next: IpMasterImagePrompt) => void;
  disabled?: boolean;
};

export function IpMasterImagePromptEditor({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-[var(--ecom-divider)] bg-[#fafafa] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--ecom-muted)]">
        生图提示词（生成基准图时使用）
      </p>
      <div>
        <label className="text-[11px] font-medium text-[var(--ecom-ink)]">正向</label>
        <textarea
          className="mt-1 min-h-[100px] w-full rounded-lg border border-[var(--ecom-border-soft)] bg-white px-3 py-2 text-xs leading-relaxed"
          value={value.positive}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, positive: e.target.value })}
        />
      </div>
      <div>
        <label className="text-[11px] font-medium text-[var(--ecom-ink)]">反向（可选）</label>
        <textarea
          className="mt-1 min-h-[56px] w-full rounded-lg border border-[var(--ecom-border-soft)] bg-white px-3 py-2 text-xs leading-relaxed"
          value={value.negative ?? ""}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...value, negative: e.target.value.trim() || undefined })
          }
        />
      </div>
    </div>
  );
}
