"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  IpMasterHelpHover,
  IpMasterInputModeHelpTable,
} from "@/components/ip-master/ip-master-help-hover";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import {
  IP_MASTER_BENCHMARK_NEGATIVE_PROMPT,
  IP_MASTER_BENCHMARK_POSITIVE_PROMPT,
  IP_MASTER_INPUT_MODE_OPTIONS,
  parseIpMasterInputMode,
  type IpMasterInputMode,
} from "@/lib/ip-master-input-presets";
import type { IpMasterProject } from "@/lib/ip-master-types";
import { IP_MASTER_BRIEF_PLACEHOLDER } from "@/lib/ip-master-template-types";
import { IP_MASTER_DEFAULT_BRIEF } from "@/lib/ip-master-input-presets";
import { cn } from "@/lib/utils";

type Props = {
  project: IpMasterProject;
  inputMode: IpMasterInputMode;
  onInputModeChange: (mode: IpMasterInputMode) => void;
  briefText: string;
  onBriefChange: (text: string) => void;
  onRefUpload: (file: File) => Promise<void>;
  onGenerateBenchmark: () => Promise<void>;
  refBusy?: boolean;
  benchmarkGenBusy?: boolean;
  uploadProgress?: number | null;
  generateTemplateBusy?: boolean;
  onGenerateTemplate?: () => void;
};

export function IpMasterInputStep({
  project,
  inputMode,
  onInputModeChange,
  briefText,
  onBriefChange,
  onRefUpload,
  onGenerateBenchmark,
  refBusy,
  benchmarkGenBusy,
  uploadProgress,
  generateTemplateBusy,
  onGenerateTemplate,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [briefDraft, setBriefDraft] = useState(briefText || IP_MASTER_DEFAULT_BRIEF);

  useEffect(() => {
    setBriefDraft(briefText || IP_MASTER_DEFAULT_BRIEF);
  }, [briefText, project.id]);

  const allowUpload = inputMode === "1" || inputMode === "3";
  const allowBrief = inputMode !== "1";
  const busy = Boolean(refBusy || benchmarkGenBusy || generateTemplateBusy);

  return (
    <div className="mb-6 space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
          输入模式
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {IP_MASTER_INPUT_MODE_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className={cn(
                "flex cursor-pointer gap-2 rounded-xl border px-3 py-2.5 text-sm transition",
                inputMode === opt.id
                  ? "border-[#0071e3] bg-[#f0f6ff]"
                  : "border-[#e8e8ed] bg-white hover:border-[#d2d2d7]",
              )}
            >
              <input
                type="radio"
                name="ip-master-input-mode"
                className="mt-1"
                checked={inputMode === opt.id}
                disabled={busy}
                onChange={() => onInputModeChange(opt.id)}
              />
              <span>
                <span className="font-medium text-[#1d1d1f]">{opt.label}</span>
                <span className="mt-0.5 block text-xs text-[#6e6e73]">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {allowUpload ? (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
              角色基准图
            </span>
            <div className="flex items-center gap-2">
              {inputMode === "3" ? (
                <>
                  <EcomButtonSecondary
                    type="button"
                    size="sm"
                    disabled={busy}
                    className="h-7 gap-1 px-2 text-[10px]"
                    onClick={() => void onGenerateBenchmark()}
                  >
                    {benchmarkGenBusy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    没图，辅助生成
                  </EcomButtonSecondary>
                  <IpMasterHelpHover ariaLabel="AI 生成基准图提示词" wide={false}>
                    <p className="mb-2 font-medium text-violet-200">正向提示词</p>
                    <p className="mb-3 whitespace-pre-wrap text-white/90">
                      {IP_MASTER_BENCHMARK_POSITIVE_PROMPT}
                    </p>
                    <p className="mb-2 font-medium text-violet-200">反向提示词</p>
                    <p className="whitespace-pre-wrap text-white/90">
                      {IP_MASTER_BENCHMARK_NEGATIVE_PROMPT}
                    </p>
                  </IpMasterHelpHover>
                </>
              ) : null}
              <span className="text-[10px] text-[#86868b]">{IMAGE_UPLOAD_DROP_HINT}</span>
            </div>
          </div>
          <EcomRefUploadCard
            title="基准图"
            items={project.references.map((r) => ({
              id: r.id,
              ossUrl: r.ossUrl,
              label: r.label,
            }))}
            emptyHint={
              inputMode === "1"
                ? "上传 1 张 IP 的标准正视图（底图，必须正面前脸视角）"
                : "上传 1 张已定稿基准立绘（可与 BRIEF 组合）"
            }
            removeLabel="删除"
            busy={busy}
            generating={benchmarkGenBusy}
            generatingLabel="AI 生成基准图中…"
            showUploadProgress={typeof uploadProgress === "number" || benchmarkGenBusy}
            uploadProgress={benchmarkGenBusy ? null : uploadProgress}
            uploadProgressLabel={benchmarkGenBusy ? "AI 生成基准图中，请稍候…" : undefined}
            inputRef={inputRef}
            onOpenFilePicker={() => inputRef.current?.click()}
            onUploadFiles={(files) => {
              const f = files[0];
              if (f) void onRefUpload(f);
            }}
          />
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onRefUpload(f);
              e.target.value = "";
            }}
          />
        </div>
      ) : inputMode === "4" ? (
        <p className="rounded-lg bg-[#f5f5f7] px-3 py-2 text-xs text-[#6e6e73]">
          模式 4 先填大白话并生成模板；在「校对」页确认生图提示词后再点「生成基准图」。
        </p>
      ) : (
        <p className="rounded-lg bg-[#f5f5f7] px-3 py-2 text-xs text-[#6e6e73]">
          当前模式不需要上传基准图；解析将仅依据 BRIEF 文字。
        </p>
      )}

      {allowBrief ? (
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
            文字描述（大白话即可）
          </label>
          <p className="mt-1 text-[11px] text-[#86868b]">
            不用写刚性/柔性格式；系统默认可改。生成时由大模型整理为标准结构化模板。
          </p>
          <textarea
            className="mt-2 min-h-[120px] w-full rounded-xl border border-[#d2d2d7] px-3 py-2 text-sm leading-relaxed"
            value={briefDraft}
            disabled={busy}
            placeholder={IP_MASTER_BRIEF_PLACEHOLDER}
            onChange={(e) => setBriefDraft(e.target.value)}
            onBlur={() => onBriefChange(briefDraft)}
          />
        </div>
      ) : (
        <p className="rounded-lg bg-[#f5f5f7] px-3 py-2 text-xs text-[#6e6e73]">
          模式 1 可不填 Brief；解析将以基准图识图结果为主。
        </p>
      )}

      {onGenerateTemplate ? (
        <EcomButtonPrimary
          type="button"
          className="w-full max-w-[33vw] min-w-[12rem]"
          disabled={busy}
          onClick={() => void onGenerateTemplate()}
        >
          {generateTemplateBusy ? "生成中…" : "生成结构化 IP 模板（含生图提示词）"}
        </EcomButtonPrimary>
      ) : null}
    </div>
  );
}
