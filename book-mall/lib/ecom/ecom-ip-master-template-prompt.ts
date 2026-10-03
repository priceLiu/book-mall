import { buildOfficialFlexibleFeaturesPromptBlock } from "@/lib/ecom/ecom-ip-master-flexible-official";
import type { IpMasterInputMode } from "@/lib/ecom/ecom-ip-master-input-presets";
import type { IpMasterRegenerateTarget } from "@/lib/ecom/ecom-ip-master-template-schema";

export function buildIpMasterTemplateGenerateSystemPrompt(opts: {
  inputMode: IpMasterInputMode;
  regenerateTarget?: IpMasterRegenerateTarget;
}): string {
  const priority =
    opts.inputMode === "1"
      ? "以图片识图为准；文字仅补充。"
      : opts.inputMode === "2"
        ? "仅文字描述；无法确认的视觉细节写入 pendingItems，禁止编造。"
        : opts.inputMode === "3"
          ? "文字描述优先于识图；冲突以文字锁定刚性锚点。"
          : "文字最高；若有基准图仅作视觉载体。";

  const target = opts.regenerateTarget ?? "both";
  const targetHint =
    target === "imagePrompt"
      ? "本次仅更新 imagePrompt（生图正/反向提示词），structuredTemplate 须与用户提供的当前稿完全一致。"
      : target === "structured"
        ? "本次仅更新 structuredTemplate 各字段，imagePrompt 须与用户提供的当前稿完全一致。"
        : "同时输出 imagePrompt 与 structuredTemplate。";

  return `你是 IP 母版草稿生成器。${priority}

用户输入是「大白话」；你要产出：
1) imagePrompt：用于生成标准正面基准立绘的正向/反向提示词（中文，可执行，无 Markdown）；
2) structuredTemplate：刚性/柔性/软约束等结构化 IP 模板（供下游约束与生图片段）。

${targetHint}

若消息中含「当前用户已编辑草稿」，你必须在其基础上微调/补全，禁止无视用户修改整篇重写。

输出必须是单个 JSON 对象（不要代码围栏外的文字）：
{
  "imagePrompt": { "positive": string, "negative": string 可空 },
  "structuredTemplate": {
    "schemaVersion": 1,
    "ipMeta": { ipId, ipName, version, createTime, baseImageUrl, styleSummary },
    "rigidFeatures": [{ featureName, description, weight }],
    "flexibleFeatures": [{ featureName, description }],
    "softConstraint": string,
    "exceptionRule": string 可空,
    "characterSummary": string 可空,
    "pendingItems": string[] 可空
  }
}

规则：
- rigidFeatures.description 是自然语言生图约束片段；weight 0.5~1。
- 无法从 Brief/图确认的细项写入 pendingItems；禁止无依据编造刚性锚点。
- version 草稿用 "V0.1"；ipName/styleSummary 忠实用户大白话。

${buildOfficialFlexibleFeaturesPromptBlock()}`;
}
