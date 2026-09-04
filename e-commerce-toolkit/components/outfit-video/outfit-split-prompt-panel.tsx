"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { getOutfitFixedPromptSections } from "@/lib/outfit-video-fixed-prompts";
import { outfitSplitUserPromptPreview } from "@/lib/outfit-video-split-prompts";

type GeneratePromptUi = ReturnType<typeof getOutfitFixedPromptSections>["generate"];

function EditablePromptBlock({
  label,
  value,
  onChange,
  disabled,
  rows = 8,
  footnote,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  rows?: number;
  footnote?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-[#6e6e73]">{label}</p>
      <textarea
        value={value}
        disabled={disabled}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="ecom-scrollbar-thin w-full resize-y rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-xs leading-relaxed text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 disabled:opacity-60"
      />
      {footnote ? (
        <p className="text-[10px] leading-relaxed text-[#86868b]">{footnote}</p>
      ) : null}
    </div>
  );
}

type Props = {
  generate: GeneratePromptUi;
  expanded: boolean;
  onToggleExpanded: () => void;
  systemDraft: string;
  userDraft: string;
  jsonPrefix: string;
  runtimeAppendix: string;
  validationErrors?: string[];
  promptBusy?: boolean;
  onSystemChange: (value: string) => void;
  onUserChange: (value: string) => void;
  onResetSystem: () => void;
  onResetUser: () => void;
};

export function OutfitSplitPromptPanel({
  generate,
  expanded,
  onToggleExpanded,
  systemDraft,
  userDraft,
  jsonPrefix,
  runtimeAppendix,
  validationErrors,
  promptBusy,
  onSystemChange,
  onUserChange,
  onResetSystem,
  onResetUser,
}: Props) {
  const [jsonPrefixOpen, setJsonPrefixOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);

  return (
    <div className="space-y-2">
      {!expanded ? (
        <button
          type="button"
          className="w-full truncate rounded-lg bg-[#f5f5f7] px-3 py-2 text-left text-xs leading-relaxed text-[#6e6e73] hover:bg-[#ececee]"
          onClick={onToggleExpanded}
        >
          {outfitSplitUserPromptPreview(120)}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-[#e8e8ed] bg-white p-3 space-y-3">
            <p className="text-[10px] leading-relaxed text-[#86868b]">
              拆解时发给视觉模型 <strong className="font-medium text-[#424245]">2 条消息</strong>
              （System + User，不是拼成一条）。User 末尾由服务端追加物理切镜时间轴与每镜关键帧截图。
            </p>

            {validationErrors && validationErrors.length > 0 ? (
              <div className="rounded-lg border border-[#ffd6d6] bg-[#fff5f5] px-3 py-2 text-[11px] leading-relaxed text-[#c93400]">
                <p className="font-medium">指令校验</p>
                <ul className="mt-1 list-inside list-disc">
                  {validationErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-[#6e6e73]">1 · System 角色（§十 · 可编辑）</p>
                <button
                  type="button"
                  className="text-[11px] text-[#0071e3] hover:underline disabled:opacity-40"
                  disabled={promptBusy}
                  onClick={onResetSystem}
                >
                  恢复默认
                </button>
              </div>
              <EditablePromptBlock
                label=""
                value={systemDraft}
                onChange={onSystemChange}
                disabled={promptBusy}
                rows={10}
              />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-[#6e6e73]">
                  2 · User 指令（预览 · 含交付格式 · 可编辑）
                </p>
                <button
                  type="button"
                  className="text-[11px] text-[#0071e3] hover:underline disabled:opacity-40"
                  disabled={promptBusy}
                  onClick={onResetUser}
                >
                  恢复默认
                </button>
              </div>
              <EditablePromptBlock
                label=""
                value={userDraft}
                onChange={onUserChange}
                disabled={promptBusy}
                rows={8}
                footnote={runtimeAppendix}
              />
            </div>

            <div className="space-y-1">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0071e3]"
                aria-expanded={jsonPrefixOpen}
                onClick={() => setJsonPrefixOpen((v) => !v)}
              >
                附：平台 JSON 围栏前缀（英文 · 自动拼在 System 最前，不可编辑）
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", jsonPrefixOpen && "rotate-180")}
                  aria-hidden
                />
              </button>
              {jsonPrefixOpen ? (
                <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-3 py-2 text-xs leading-relaxed text-[#6e6e73]">
                  {jsonPrefix}
                </pre>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-[#e8e8ed] bg-white">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
              aria-expanded={generateOpen}
              onClick={() => setGenerateOpen((v) => !v)}
            >
              <span className="text-xs font-semibold text-[#1d1d1f]">
                逐镜生成 Prompt · 拆解完成后发给视频模型（Kling 等）
              </span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-[#6e6e73] transition-transform", generateOpen && "rotate-180")}
                aria-hidden
              />
            </button>
            {generateOpen ? (
              <div className="space-y-3 border-t border-[#e8e8ed] px-3 py-3">
                <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-3 py-2 text-xs leading-relaxed text-[#1d1d1f]">
                  {generate.basePositive}
                </pre>
                <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-3 py-2 text-xs leading-relaxed text-[#1d1d1f]">
                  {generate.negative}
                </pre>
                <p className="text-[10px] leading-relaxed text-[#86868b]">
                  逐镜生成时可在下方「片段生成」面板编辑完整正向 Prompt；运镜/动作仅表格展示，不参与拼接。
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
