/**
 * Pro Vertical · 分 phase 系统提示词
 * @see book-mall/doc/ecom/pro-deliverable-spec-v1.md
 */

import { getProVerticalConfig } from "@/lib/ecom/pro-vertical/registry";
import type { ProVerticalId } from "@/lib/ecom/pro-vertical/types";

export type ProPromptPhase = "sellpoints" | "sellpoints_polish" | "voiceovers" | "storyboards" | "ops" | "general";

function buildCoreBlock(vertical: ProVerticalId): string {
  const config = getProVerticalConfig(vertical);
  if (!config) return "";
  const versionsList = config.storyboardVersions.map((v) => v.title).join("、");
  return `你是【${config.llmRoleName}】，严格遵从${config.rulesDocRef}。

【交付铁律】
- 仅输出 brief 摘要 + \`\`\`pro-deliverable JSON\`\`\`
- **禁止输出 Markdown 表格**（12.1 分镜表、12.3 验收清单由系统从 JSON 渲染）
- schemaVersion 必须为 "pro-v1"，vertical 必须为 "${vertical}"
- 固定 6 镜；单镜时长 3–7 秒（0.5 精度）；全片口播 ≤100 字
- 每镜必填 sellpointIds，覆盖全部核心+视觉卖点

【景别曲线（镜 1–6）】
${config.mirrorRoles.map((m) => `${m.index} ${m.shotScale}`).join(" → ")}（镜6 平稳定格）

【六镜职能】
${config.mirrorRoles.map((m) => `镜${m.index}：${m.role}`).join("\n")}

【五版分镜】
${versionsList}

【卖点分层】
core 2–3 条进台词；visual 3–4 条进镜头特写；aux 进运营素材

【卖点词库参考】
${config.sellpointVocabHint}`;
}

function buildJsonShape(vertical: ProVerticalId, opsOnly: boolean): string {
  if (opsOnly) {
    return `\`\`\`pro-deliverable
{
  "schemaVersion": "pro-v1",
  "vertical": "${vertical}",
  "productName": "产品名",
  "dimensions": { "outputLanguage": "中文" },
  "opsPack": {
    "titles": ["标题1"],
    "coverWords": ["词1"],
    "tags": ["#标签1"],
    "xiaohongshuBody": "正文…",
    "detailBullets": ["卖点1"]
  }
}
\`\`\``;
  }
  return `\`\`\`pro-deliverable
{
  "schemaVersion": "pro-v1",
  "vertical": "${vertical}",
  "productName": "产品名",
  "dimensions": {},
  "sellpoints": [{ "id": "S01", "text": "...", "layer": "core", "source": "ai" }],
  "sellpointsLocked": false,
  "voiceovers": [{ "id": "V01", "type": "痛点救场型", "narrative": "...", "script": "..." }],
  "selectedVoiceoverId": null,
  "storyboardVersions": { "A": { "id": "A", "title": "A版", "panels": [/* 6 镜 */] } },
  "selectedVersion": null,
  "coverageChecklist": [],
  "outputMode": null
}
\`\`\``;
}

export function buildProDeliverableContextBlock(
  deliverable: Record<string, unknown>,
  phase: ProPromptPhase,
): string {
  const payload: Record<string, unknown> = {
    productName: deliverable.productName,
    dimensions: deliverable.dimensions ?? {},
  };
  if (Array.isArray(deliverable.sellpoints) && deliverable.sellpoints.length) {
    payload.sellpoints = deliverable.sellpoints;
    payload.sellpointsLocked = deliverable.sellpointsLocked ?? false;
    if (phase === "sellpoints_polish") {
      payload.userSellpoints = deliverable.sellpoints;
    }
  }
  if (phase === "storyboards" || phase === "ops") {
    if (deliverable.selectedVoiceoverId) {
      payload.selectedVoiceoverId = deliverable.selectedVoiceoverId;
    }
    if (phase === "ops" && deliverable.selectedVersion) {
      payload.selectedVersion = deliverable.selectedVersion;
    }
  }
  return `\n\n【项目已定稿数据 · 必须以此为准】\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
}

export function buildProAssistantSystemPrompt(
  vertical: ProVerticalId,
  phase: ProPromptPhase = "general",
): string {
  const config = getProVerticalConfig(vertical);
  const focusField = "productFocus";
  const phaseBlock: Record<ProPromptPhase, string> = {
    sellpoints: `【当前任务：卖点 AI 生成】
根据七维参数生成 5–8 条卖点，编号 S01–S0N，分层 core/visual/aux。
参考词库：${config?.sellpointVocabHint ?? ""}
用户卖点不足 3 条时补充 supplemented 来源卖点。
输出 JSON 仅含 sellpoints（可选 schemaVersion/vertical，其余字段勿输出）。`,

    sellpoints_polish: `【当前任务：卖点润色（用户已提供原始卖点）】
基于上下文 userSellpoints / sellpoints 清洗、去重、分层、精炼；**保持用户原意**，禁止捏造新品卖点。
用户原条 source=user；AI 补充用 supplemented；不足 3 条可 supplemented。
输出 JSON 仅含 sellpoints（可选 schemaVersion/vertical，其余字段勿输出）。`,

    voiceovers: `【当前任务：6 套口播】
固定 2 套：${config?.voiceoverTypes.slice(0, 2).join("、")}；动态 4 套适配场景。
每套含 type、narrative、script；编号 V01–V06。
输出 JSON 仅含 voiceovers（可选 schemaVersion/vertical，其余字段勿输出）。`,

    storyboards: `【当前任务：A–E 五套分镜】
基于选定口播 + 定稿卖点，生成 storyboardVersions A/B/C/D/E，每版 6 镜。
panels 字段：index, shotScale, durationSec, cameraMove, sceneDesc, scenePrompt, modelAction, ${focusField}, dialogue, toneTexture, sellpointIds, imagePrompt, videoPrompt
同时生成 coverageChecklist（核心+视觉卖点验收）。
输出 JSON 仅含 storyboardVersions、coverageChecklist（可选 schemaVersion/vertical，禁止输出 sellpoints/voiceovers/opsPack）。
E/C 版口播允许 ±15% 微调，其余 100% 忠实。`,

    ops: `【当前任务：运营素材包】
分镜已定稿锁定；禁止输出 storyboardVersions / coverageChecklist / voiceovers / sellpoints。
仅输出 opsPack：titles（10条分层标题）、coverWords、tags、xiaohongshuBody、detailBullets。
输出 JSON 仅含 opsPack（可选 schemaVersion/vertical）。
语言与 dimensions.outputLanguage 一致。`,

    general: `【通用】按用户消息推进；内部 trigger 以 pro-step: 开头时只输出对应 phase JSON。`,
  };

  const jsonShape = buildJsonShape(vertical, phase === "ops");
  return [buildCoreBlock(vertical), phaseBlock[phase], "【JSON 结构参考】", jsonShape].join(
    "\n\n",
  );
}

export function resolveProPromptPhase(lastUserTurn: string): ProPromptPhase {
  if (lastUserTurn.includes("sellpoints-polish")) return "sellpoints_polish";
  if (lastUserTurn.includes("sellpoints")) return "sellpoints";
  if (lastUserTurn.includes("voiceovers")) return "voiceovers";
  if (lastUserTurn.includes("storyboards")) return "storyboards";
  if (lastUserTurn.includes("ops")) return "ops";
  return "general";
}

export function isProInternalLlmTrigger(text: string): boolean {
  const t = text.trim();
  return t.startsWith("pro-step:") || t.startsWith("fashion-step:");
}
