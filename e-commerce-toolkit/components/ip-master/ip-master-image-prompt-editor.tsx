"use client";

import type { IpMasterImagePrompt } from "@/lib/ip-master-template-types";

type Props = {
  value: IpMasterImagePrompt;
  onChange: (next: IpMasterImagePrompt) => void;
  disabled?: boolean;
};

export function IpMasterImagePromptEditor({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
        生图提示词（生成基准图时使用）
      </p>
      <div>
        <label className="text-[11px] font-medium text-[#1d1d1f]">正向</label>
        <textarea
          className="mt-1 min-h-[100px] w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-xs leading-relaxed"
          value={value.positive}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, positive: e.target.value })}
        />
      </div>
      <div>
        <label className="text-[11px] font-medium text-[#1d1d1f]">反向（可选）</label>
        <textarea
          className="mt-1 min-h-[56px] w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-xs leading-relaxed"
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
