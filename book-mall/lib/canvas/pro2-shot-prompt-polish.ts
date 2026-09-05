/**
 * Pro2 Pass 2 · 分镜图/分镜视频提示词润色（按镜 LLM）
 * book-mall/lib/canvas/pro2-shot-prompt-polish.ts 须保持同步
 */
import type {
  Pro2ProductionScript,
  Pro2ProductionScriptPatch,
} from "./data/pro2-production-script-schema";
import {
  PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION,
  resolvePro2ShotFrameImagePrompt,
} from "./data/pro2-production-script-schema";
import {
  PRO2_PASS2_FRAME_IMAGE_GOLDEN,
  PRO2_PASS2_VIDEO_GOLDEN,
  STORY_PRO2_JSON_FIELD_RULES,
  STORY_PRO2_VIDEO_PROMPT_RULES,
} from "./data/pro2-production-pack-standard";
import { expandWizardMentionsForPrompt, collectShotNarrativeText } from "./pro2-shot-entity-reconcile";
import {
  describePro2ProductionScriptParseFailure,
  extractPro2ProductionScriptPatchRaw,
} from "./pro2-production-script-structured";

export type ShotPromptPolishMode = "both" | "frame" | "video";

/** Hub shotPromptPolishQueue 键 · frame/video 分轨避免并发覆盖 */
export function shotPromptPolishQueueKey(
  rowKey: string,
  mode?: ShotPromptPolishMode,
): string {
  const row = rowKey.trim();
  if (!row) return row;
  if (mode === "frame" || mode === "video") return `${row}:${mode}`;
  return row;
}

export function resolveShotPromptPolishQueuePrompt(
  queue: Record<string, string> | undefined,
  rowKey: string,
  polishMode?: ShotPromptPolishMode,
): string | undefined {
  if (!queue) return undefined;
  const keyed = queue[shotPromptPolishQueueKey(rowKey, polishMode)]?.trim();
  if (keyed) return keyed;
  return queue[rowKey]?.trim() || undefined;
}

/** Pass 1 导演信息是否足以发起润色（prompt 字段可空） */
export function isShotReadyForPromptPolish(
  shot: NonNullable<Pro2ProductionScript["shots"]>[number],
): boolean {
  const corpus = [
    collectShotNarrativeText(shot),
    shot.shotSize ?? "",
    shot.audioNote ?? "",
  ]
    .join("\n")
    .replace(/—/g, "")
    .trim();
  return corpus.length >= 4;
}

export type BuildShotPromptPolishOpts = {
  prevShotIndex?: number;
  mode?: ShotPromptPolishMode;
  /** Hub outlineMd · 故事背景摘要 */
  outlineMd?: string;
};

const PRO2_SHOT_PROMPT_POLISH_SYSTEM_BASE = `你是影视专业版 2.0 的分镜提示词导演。根据 Pass 1 导演表、视觉风格总纲与资产辞典，为单镜输出最终中文提示词。

## 禁止
- 改编 Pass 1 导演事实（景别/运镜/对白/时长）
- 改编 analysis 中的摄影事实（切点/机位/焦段/调度/时间码）
- 整段复制 analysis.analysisDraftPrompt 作为最终 Prompt（仅可作参考）
- 输出 markdown 说明或 GFM 表
- 英文提示词或 [Negative: …] 英文反向

${STORY_PRO2_JSON_FIELD_RULES}`;

function buildShotPromptPolishSystemPrompt(mode: ShotPromptPolishMode): string {
  const frameBlock = `## 分镜图 frameImagePrompt
单段中文，顺序：景别→场景→角色→动作→道具→光影→镜头→氛围→[视觉风格：…]。不得输出英文段落。
出现角色/场景/道具时须使用资产辞典 **canonical name**（与 Pass1 sceneId/characterIds/propIds 一致）；保存后系统会自动转为 @ 引用。

金标准范例（结构须对齐，内容须依本镜改写）：
${PRO2_PASS2_FRAME_IMAGE_GOLDEN}`;

  const videoBlock = `## 分镜视频 videoPrompt
中文多段模板，须含章节：出场角色、背景场景、参考图使用规则、前一镜（若有）、分段描述、输出约束、视觉风格。全文中文。
出场角色/背景场景等须使用资产辞典 **canonical name**；保存后系统会自动转为 @ 引用。

${STORY_PRO2_VIDEO_PROMPT_RULES}

金标准范例（结构须对齐，内容须依本镜改写）：
${PRO2_PASS2_VIDEO_GOLDEN}`;

  let outputFormat = "";
  if (mode === "frame") {
    outputFormat = `仅输出 \`\`\`pro2-production-script\` JSON 围栏，结构：
{
  "schemaVersion": 2,
  "tier": "pro",
  "step": "shot_prompts",
  "patch": {
    "shots": [
      {
        "index": <镜号>,
        "frameImagePrompt": "<单段中文分镜图提示词>"
      }
    ]
  }
}`;
  } else if (mode === "video") {
    outputFormat = `仅输出 \`\`\`pro2-production-script\` JSON 围栏，结构：
{
  "schemaVersion": 2,
  "tier": "pro",
  "step": "shot_prompts",
  "patch": {
    "shots": [
      {
        "index": <镜号>,
        "videoPrompt": "<中文多段模板分镜视频提示词>"
      }
    ]
  }
}`;
  } else {
    outputFormat = `仅输出 \`\`\`pro2-production-script\` JSON 围栏，结构：
{
  "schemaVersion": 2,
  "tier": "pro",
  "step": "shot_prompts",
  "patch": {
    "shots": [
      {
        "index": <镜号>,
        "frameImagePrompt": "<单段中文分镜图提示词>",
        "videoPrompt": "<中文多段模板分镜视频提示词>"
      }
    ]
  }
}`;
  }

  const fieldBlocks =
    mode === "frame"
      ? frameBlock
      : mode === "video"
        ? videoBlock
        : `${frameBlock}\n\n${videoBlock}`;

  return `${PRO2_SHOT_PROMPT_POLISH_SYSTEM_BASE}

## 输出格式（唯一合法回复）
${outputFormat}

${fieldBlocks}`;
}

export const PRO2_SHOT_PROMPT_POLISH_SYSTEM =
  buildShotPromptPolishSystemPrompt("both");

export type ShotPromptPolishBundle = {
  systemPrompt: string;
  userPrompt: string;
  shotIndex: number;
  mode: ShotPromptPolishMode;
  patchEnvelope: Pro2ProductionScriptPatch;
};

function shotByIndex(
  script: Pro2ProductionScript,
  index: number,
): Pro2ProductionScript["shots"] extends (infer S)[] | undefined ? S | undefined : never {
  return script.shots?.find((s) => s.index === index);
}

function formatAssetBlock(title: string, lines: string[]): string {
  const body = lines.filter(Boolean).join("\n");
  return body ? `### ${title}\n${body}` : "";
}

function buildVisualStyleSection(script: Pro2ProductionScript): string {
  const vs = script.visualStyle;
  if (!vs) return "";
  const lines = [
    vs.worldBackground?.trim() ? `故事背景：${vs.worldBackground.trim()}` : "",
    vs.era?.trim() ? `年代/环境：${vs.era.trim()}` : "",
    vs.globalColorTone?.trim() ? `全剧色调：${vs.globalColorTone.trim()}` : "",
    vs.pictureStyle?.trim() ? `画面风格：${vs.pictureStyle.trim()}` : "",
    vs.cinematography?.trim() ? `摄影风格：${vs.cinematography.trim()}` : "",
    vs.lighting?.trim() ? `光影基调：${vs.lighting.trim()}` : "",
    vs.styleAnchor?.trim() ? `风格锚定：${vs.styleAnchor.trim()}` : "",
  ].filter(Boolean);
  return lines.length ? lines.join("\n") : "";
}

const OUTLINE_EXCERPT_MAX = 800;

function buildOutlineExcerpt(outlineMd?: string): string {
  const md = outlineMd?.trim();
  if (!md) return "";
  if (md.length <= OUTLINE_EXCERPT_MAX) return md;
  return `${md.slice(0, OUTLINE_EXCERPT_MAX)}…`;
}

function buildDictionarySection(script: Pro2ProductionScript): string {
  const parts: string[] = [];
  for (const c of script.characters ?? []) {
    parts.push(
      formatAssetBlock(`角色 · ${c.name}`, [
        c.description?.trim() ? `描述：${c.description.trim()}` : "",
        c.appearance?.trim() ? `外观：${c.appearance.trim()}` : "",
        c.clothing?.trim() ? `服装：${c.clothing.trim()}` : "",
        c.traits?.trim() ? `特征：${c.traits.trim()}` : "",
        c.compositionSpec?.trim() ? `构图规范：${c.compositionSpec.trim()}` : "",
        c.visualStyleTag?.trim() ? `[视觉风格：${c.visualStyleTag.trim()}]` : "",
      ]),
    );
  }
  for (const s of script.scenes ?? []) {
    parts.push(
      formatAssetBlock(`场景 · ${s.name}`, [
        s.description?.trim() ? `描述：${s.description.trim()}` : "",
        s.environmentTimeMood?.trim()
          ? `环境/时间/气氛：${s.environmentTimeMood.trim()}`
          : "",
        s.foreground?.trim() ? `前背景：${s.foreground.trim()}` : "",
        s.atmosphere?.trim() ? `氛围：${s.atmosphere.trim()}` : "",
        s.compositionSpec?.trim() ? `构图规范：${s.compositionSpec.trim()}` : "",
        s.visualStyleTag?.trim() ? `[视觉风格：${s.visualStyleTag.trim()}]` : "",
      ]),
    );
  }
  for (const p of script.props ?? []) {
    parts.push(
      formatAssetBlock(`道具 · ${p.name}`, [
        p.description?.trim() ? `描述：${p.description.trim()}` : "",
        p.traits?.trim() ? `特征：${p.traits.trim()}` : "",
        p.compositionSpec?.trim() ? `构图规范：${p.compositionSpec.trim()}` : "",
        p.visualStyleTag?.trim() ? `[视觉风格：${p.visualStyleTag.trim()}]` : "",
      ]),
    );
  }
  return parts.filter(Boolean).join("\n\n");
}

function formatShotAnalysisLines(
  shot: NonNullable<Pro2ProductionScript["shots"]>[number],
): string[] {
  const a = shot.analysis;
  if (!a) return [];
  const lines: string[] = ["## analysis（须遵守，禁止改编摄影事实）"];
  if (a.timing) {
    lines.push(
      `时段：${a.timing.startTimeSec}–${a.timing.endTimeSec}s`,
    );
  }
  if (a.cut?.transition || a.cut?.detail) {
    lines.push(
      `切点：${[a.cut.transition, a.cut.detail].filter(Boolean).join(" · ")}`,
    );
  }
  if (a.cinematography) {
    lines.push(
      `摄影：${[
        a.cinematography.cameraAngle,
        a.cinematography.focalLength,
        a.cinematography.composition,
      ]
        .filter(Boolean)
        .join(" · ")}`,
    );
  }
  if (a.blocking) {
    lines.push(
      `调度：${[
        a.blocking.subjectBlocking,
        a.blocking.sightDirection,
        a.blocking.foreMidBackLayer,
        a.blocking.sceneEnvironment,
      ]
        .filter(Boolean)
        .join(" · ")}`,
    );
  }
  if (a.look) {
    lines.push(
      `布光/影调：${[a.look.lightingSetup, a.look.toneContrast].filter(Boolean).join(" · ")}`,
    );
  }
  if (a.analysisDraftPrompt?.trim()) {
    lines.push(
      `分析草稿 Prompt（仅参考，禁止整段复制）：${a.analysisDraftPrompt.trim()}`,
    );
  }
  return lines.length > 1 ? lines : [];
}

function formatPass1ShotBlock(
  shot: NonNullable<Pro2ProductionScript["shots"]>[number],
  script: Pro2ProductionScript,
): string {
  const sceneName =
    script.scenes?.find((s) => s.id === shot.sceneId)?.name ?? shot.sceneId ?? "";
  const propNames =
    shot.propIds
      ?.map((id) => script.props?.find((p) => p.id === id)?.name ?? id)
      .filter(Boolean)
      .join("、") ?? "";
  const frameDraft = resolvePro2ShotFrameImagePrompt(shot);
  const videoDraft = shot.videoPrompt?.trim();
  return [
    `镜号：${shot.index}`,
    shot.shotSize?.trim() ? `景别：${shot.shotSize.trim()}` : "",
    shot.lighting?.trim()
      ? `光影：${expandWizardMentionsForPrompt(shot.lighting.trim(), script)}`
      : "",
    shot.cameraMove?.trim()
      ? `运镜：${expandWizardMentionsForPrompt(shot.cameraMove.trim(), script)}`
      : "",
    shot.sceneDescription?.trim()
      ? `画面描述：${expandWizardMentionsForPrompt(shot.sceneDescription.trim(), script)}`
      : "",
    sceneName ? `场景：${sceneName}` : "",
    propNames ? `道具：${propNames}` : "",
    shot.dialogue?.trim()
      ? `对白：${expandWizardMentionsForPrompt(shot.dialogue.trim(), script)}`
      : "",
    shot.durationSec ? `时长(秒)：${shot.durationSec}` : "",
    shot.sfxNote?.trim() ? `音效：${shot.sfxNote.trim()}` : "",
    shot.audioNote?.trim() ? `口型/配音：${shot.audioNote.trim()}` : "",
    frameDraft
      ? `已有分镜图提示词（可覆盖）：${expandWizardMentionsForPrompt(frameDraft, script)}`
      : "",
    videoDraft
      ? `已有视频提示词（可覆盖）：${expandWizardMentionsForPrompt(videoDraft, script)}`
      : "",
    ...formatShotAnalysisLines(shot),
  ]
    .filter(Boolean)
    .join("\n");
}

function taskLineForMode(mode: ShotPromptPolishMode, shotIndex: number): string {
  if (mode === "frame") {
    return `为镜 ${shotIndex} 生成 frameImagePrompt（中文分镜图提示词）。`;
  }
  if (mode === "video") {
    return `为镜 ${shotIndex} 生成 videoPrompt（中文分镜视频提示词）。`;
  }
  return `为镜 ${shotIndex} 生成 frameImagePrompt 与 videoPrompt（中文）。`;
}

/** 组装单镜 Pass 2 LLM 输入与期望 patch 骨架 */
export function buildShotPromptPolishBundle(
  shotIndex: number,
  script: Pro2ProductionScript,
  opts?: BuildShotPromptPolishOpts,
): ShotPromptPolishBundle | null {
  const mode = opts?.mode ?? "both";
  const shot = shotByIndex(script, shotIndex);
  if (!shot) return null;
  const prevIndex = opts?.prevShotIndex;
  const prev =
    prevIndex != null && prevIndex > 0 ? shotByIndex(script, prevIndex) : undefined;
  const dictionary = buildDictionarySection(script);
  const visualStyle = buildVisualStyleSection(script);
  const outlineExcerpt = buildOutlineExcerpt(opts?.outlineMd);

  const userParts = ["## 任务", taskLineForMode(mode, shotIndex), ""];
  if (visualStyle) {
    userParts.push("## 视觉风格总纲", visualStyle, "");
  }
  if (outlineExcerpt) {
    userParts.push("## 故事大纲摘要", outlineExcerpt, "");
  }
  userParts.push("## Pass 1 · 本镜导演表", formatPass1ShotBlock(shot, script));
  if (prev) {
    userParts.push(
      "",
      "## 前一镜（视频连贯参考）",
      formatPass1ShotBlock(prev, script),
    );
  }
  if (dictionary) {
    userParts.push("", "## 资产辞典", dictionary);
  }

  const schemaVersion =
    script.schemaVersion === 1 ? 1 : PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION;
  const patchEnvelope: Pro2ProductionScriptPatch = {
    schemaVersion,
    tier: "pro",
    step: "shot_prompts",
    patch: {
      shots: [
        {
          index: shotIndex,
          sceneDescription: "—",
          dialogue: "—",
          audioNote: "",
        },
      ],
    },
  };
  return {
    systemPrompt: buildShotPromptPolishSystemPrompt(mode),
    userPrompt: userParts.join("\n"),
    shotIndex,
    mode,
    patchEnvelope,
  };
}

export type ExtractShotPromptPolishResult =
  | {
      ok: true;
      frameImagePrompt?: string;
      videoPrompt?: string;
    }
  | { ok: false; error: string };

/** 从 LLM 输出提取单镜 prompt 字段 */
export function extractShotPromptPolishFromText(
  text: string | null | undefined,
  shotIndex: number,
  mode: ShotPromptPolishMode = "both",
): ExtractShotPromptPolishResult {
  if (!text?.trim()) {
    return { ok: false, error: "模型未返回内容" };
  }
  const patch = extractPro2ProductionScriptPatchRaw(text);
  if (!patch?.patch?.shots?.length) {
    return {
      ok: false,
      error:
        describePro2ProductionScriptParseFailure(text) ??
        "未找到合法 shot_prompts patch",
    };
  }
  const hit = patch.patch.shots.find((s) => s.index === shotIndex);
  if (!hit) {
    return { ok: false, error: `patch 中未找到镜 ${shotIndex}` };
  }
  const frameImagePrompt =
    hit.frameImagePrompt?.trim() || hit.imagePrompt?.trim() || undefined;
  const videoPrompt = hit.videoPrompt?.trim() || undefined;
  if (mode === "frame" && !frameImagePrompt) {
    return { ok: false, error: "缺少 frameImagePrompt" };
  }
  if (mode === "video" && !videoPrompt) {
    return { ok: false, error: "缺少 videoPrompt" };
  }
  if (mode === "both" && !frameImagePrompt && !videoPrompt) {
    return { ok: false, error: "缺少 frameImagePrompt / videoPrompt" };
  }
  return {
    ok: true,
    frameImagePrompt: mode === "video" ? undefined : frameImagePrompt,
    videoPrompt: mode === "frame" ? undefined : videoPrompt,
  };
}
