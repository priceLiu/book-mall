/**
 * 服装专业版 V4.4 · 分 phase 系统提示词
 * @see book-mall/doc/ecom/fashion-deliverable-spec-v4.md
 * @see docs/服装电商.md
 */

const FASHION_CORE = `你是【服装AI短视频专业策划师】，严格遵从《服装AI短视频生产规则手册 V4.4》。

【交付铁律】
- 仅输出 brief 摘要 + \`\`\`fashion-deliverable JSON\`\`\`
- **禁止输出 Markdown 表格**（12.1 分镜表、12.3 验收清单由系统从 JSON 渲染）
- 分阶段 trigger 时 **可省略** schemaVersion / vertical（服务端按项目补全）；整包参考结构时须为 "fashion-v4" / "fashion_apparel"
- 固定 6 镜；单镜时长 3–7 秒（0.5 精度）；全片口播 ≤100 字
- 每镜必填 sellpointIds，覆盖全部核心+视觉卖点

【景别曲线（镜 1–6）】
1 全景/中全景 → 2 中全景/中景 → 3 中近景/近景 → 4 近景/特写 → 5 中景 → 6 中全景（平稳定格）

【卖点分层】
core 2–3 条进台词；visual 3–4 条进镜头特写；aux 进运营素材`;

const FASHION_JSON_SHAPE = `\`\`\`fashion-deliverable
{
  "schemaVersion": "fashion-v4",
  "vertical": "fashion_apparel",
  "productName": "产品名",
  "dimensions": { "genderCategory": "女装", "styleCategory": "连衣裙", ... },
  "sellpoints": [{ "id": "S01", "text": "...", "layer": "core", "source": "ai" }],
  "sellpointsLocked": false,
  "voiceovers": [{ "id": "V01", "type": "痛点救场型", "narrative": "...", "script": "..." }],
  "selectedVoiceoverId": null,
  "storyboardVersions": {
    "A": { "id": "A", "title": "A版", "panels": [/* 6 镜 */] }
  },
  "selectedVersion": null,
  "coverageChecklist": [],
  "outputMode": null
}
\`\`\``;

/** ops 阶段：仅 opsPack，避免 LLM 误读完整 deliverable 后重吐分镜 */
const FASHION_OPS_JSON_SHAPE = `\`\`\`fashion-deliverable
{
  "schemaVersion": "fashion-v4",
  "vertical": "fashion_apparel",
  "productName": "产品名",
  "dimensions": { "outputLanguage": "中文" },
  "opsPack": {
    "titles": ["标题1", "标题2", "..."],
    "coverWords": ["词1", "词2"],
    "tags": ["#标签1", "#标签2"],
    "xiaohongshuBody": "小红书正文…",
    "detailBullets": ["卖点1", "卖点2"]
  }
}
\`\`\``;

export type FashionPromptPhase =
  | "sellpoints"
  | "sellpoints_polish"
  | "voiceovers"
  | "storyboards"
  | "ops"
  | "general";

export function buildFashionDeliverableContextBlock(
  deliverable: {
    productName?: string;
    dimensions?: Record<string, unknown>;
    sellpoints?: Array<{ id: string; text: string; layer: string; source: string }>;
    sellpointsLocked?: boolean;
    selectedVoiceoverId?: string | null;
    voiceovers?: Array<{ id: string; type: string; narrative: string; script: string }>;
    selectedVersion?: string | null;
    storyboardVersions?: Partial<
      Record<
        string,
        {
          id?: string;
          title?: string;
          panels?: Array<Record<string, unknown>>;
        }
      >
    >;
  },
  phase: FashionPromptPhase,
): string {
  const payload: Record<string, unknown> = {
    productName: deliverable.productName,
    dimensions: deliverable.dimensions ?? {},
  };
  if (deliverable.sellpoints?.length) {
    payload.sellpoints = deliverable.sellpoints;
    payload.sellpointsLocked = deliverable.sellpointsLocked ?? false;
    if (phase === "sellpoints_polish") {
      payload.userSellpoints = deliverable.sellpoints;
    }
  }
  if (phase === "storyboards" || phase === "ops") {
    if (deliverable.selectedVoiceoverId) {
      payload.selectedVoiceoverId = deliverable.selectedVoiceoverId;
      const vo = deliverable.voiceovers?.find(
        (v) => v.id === deliverable.selectedVoiceoverId,
      );
      if (vo) payload.selectedVoiceover = vo;
    }
    if (phase === "storyboards") {
      const existingVersions = deliverable.storyboardVersions ?? {};
      const versionKeys = Object.keys(existingVersions).filter(
        (k) => existingVersions[k]?.panels?.length || existingVersions[k]?.title,
      );
      if (versionKeys.length > 0) {
        payload.existingStoryboardVersions = existingVersions;
        payload.storyboardRegenerateHint =
          `已有 ${versionKeys.join("、")} 版分镜；请补全缺失的 A–E 版本，保留已有版本的 panels 与 title，勿清空已有版本。`;
      }
    }
  }
  if (phase === "ops" && deliverable.selectedVersion) {
    payload.selectedVersion = deliverable.selectedVersion;
    const version = deliverable.storyboardVersions?.[deliverable.selectedVersion];
    if (version?.panels?.length) {
      payload.storyboardPanels = version.panels;
      if (version.title) payload.storyboardVersionTitle = version.title;
    }
  }
  return `\n\n【项目已定稿数据 · 必须以此为准，勿使用对话历史中的旧版本】\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
}

export function buildFashionAssistantSystemPrompt(
  phase: FashionPromptPhase = "general",
): string {
  const phaseBlock: Record<FashionPromptPhase, string> = {
    sellpoints: `【当前任务：卖点 AI 生成】
根据七维参数生成 5–8 条卖点，编号 S01–S0N，分层 core/visual/aux。
用户卖点不足 3 条时补充 supplemented 来源卖点。
输出 JSON 仅含 sellpoints（可选 schemaVersion/vertical，其余字段勿输出）。`,

    sellpoints_polish: `【当前任务：卖点润色（用户已提供原始卖点）】
基于上下文中的 userSellpoints / sellpoints：
- 清洗、去重、归类、精炼，**保持用户原意**，禁止捏造未提及的新卖点
- 编号 S01–S0N，分层 core/visual/aux
- 用户原条目标记 source=user；仅 AI 补充的用 supplemented
- 不足 3 条时可补充 supplemented，须 brief 说明
输出 JSON 仅含 sellpoints（可选 schemaVersion/vertical，其余字段勿输出）。`,

    voiceovers: `【当前任务：6 套口播】
固定 2 套：痛点救场型、质感种草型；动态 4 套适配场景。
每套含 type、narrative、script；编号 V01–V06。
输出 JSON 仅更新 voiceovers 字段。`,

    storyboards: `【当前任务：A–E 五套分镜】
基于选定口播 + 定稿卖点，生成 storyboardVersions A/B/C/D/E，每版 6 镜。
panels 字段：index, shotScale, durationSec, cameraMove, sceneDesc, scenePrompt, modelAction, garmentFocus, dialogue, toneTexture, sellpointIds, imagePrompt, videoPrompt
scenePrompt：≥40字，生图/生视频共用；只写环境/光线/道具；用户上传场景图时写机位局部差异。
imagePrompt：≥40字，完整静帧（含场景+人物+服装+卖点）。
videoPrompt：≥40字，单镜视频 motion（运镜+动作连续性）。
同时生成 coverageChecklist（核心+视觉卖点验收）。
E/C 版口播允许 ±15% 微调，其余 100% 忠实。`,

    ops: `【当前任务：运营素材包】
分镜已定稿锁定；**禁止**输出 storyboardVersions / coverageChecklist / voiceovers / sellpoints / selectedVersion。
仅输出 brief 摘要 + 下方 JSON；JSON **必须**含完整 opsPack：
- titles：10 条分层标题
- coverWords、tags、xiaohongshuBody、detailBullets
语言与 dimensions.outputLanguage 一致。`,

    general: `【通用】按用户消息推进；内部 trigger 消息以 fashion-step: 开头时只输出对应 phase JSON。`,
  };

  const jsonShape = phase === "ops" ? FASHION_OPS_JSON_SHAPE : FASHION_JSON_SHAPE;
  return [FASHION_CORE, phaseBlock[phase], "【JSON 结构参考】", jsonShape].join("\n\n");
}

export function resolveFashionPromptPhase(lastUserTurn: string): FashionPromptPhase {
  if (lastUserTurn.includes("fashion-step:sellpoints-polish")) return "sellpoints_polish";
  if (lastUserTurn.includes("fashion-step:sellpoints")) return "sellpoints";
  if (lastUserTurn.includes("fashion-step:voiceovers")) return "voiceovers";
  if (lastUserTurn.includes("fashion-step:storyboards")) return "storyboards";
  if (lastUserTurn.includes("fashion-step:ops")) return "ops";
  return "general";
}

export function isFashionInternalLlmTrigger(text: string): boolean {
  return text.trim().startsWith("fashion-step:");
}
