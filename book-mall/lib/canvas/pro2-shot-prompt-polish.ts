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

export const PRO2_SHOT_PROMPT_POLISH_SYSTEM = `你是影视专业版 2.0 的分镜提示词导演。根据 Pass 1 导演表与资产辞典，为单镜输出最终中文提示词。

## 输出格式（唯一合法回复）
仅输出 \`\`\`pro2-production-script\` JSON 围栏，结构：
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
}

## 分镜图 frameImagePrompt
单段中文，顺序：景别→场景→角色→动作→道具→光影→镜头→氛围→[视觉风格：…]。不得输出英文段落。

金标准范例（结构须对齐，内容须依本镜改写）：
${PRO2_PASS2_FRAME_IMAGE_GOLDEN}

## 分镜视频 videoPrompt
中文多段模板，须含章节：出场角色、背景场景、参考图使用规则、前一镜（若有）、分段描述、输出约束、视觉风格。全文中文。

${STORY_PRO2_VIDEO_PROMPT_RULES}

金标准范例（结构须对齐，内容须依本镜改写）：
${PRO2_PASS2_VIDEO_GOLDEN}

## 禁止
- 改编 Pass 1 导演事实（景别/运镜/对白/时长）
- 输出 markdown 说明或 GFM 表
- 英文提示词或 [Negative: …] 英文反向

${STORY_PRO2_JSON_FIELD_RULES}`;

export type ShotPromptPolishBundle = {
  systemPrompt: string;
  userPrompt: string;
  shotIndex: number;
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
  return [
    `镜号：${shot.index}`,
    shot.shotSize?.trim() ? `景别：${shot.shotSize.trim()}` : "",
    shot.lighting?.trim() ? `光影：${shot.lighting.trim()}` : "",
    shot.cameraMove?.trim() ? `运镜：${shot.cameraMove.trim()}` : "",
    shot.sceneDescription?.trim() ? `画面描述：${shot.sceneDescription.trim()}` : "",
    sceneName ? `场景：${sceneName}` : "",
    propNames ? `道具：${propNames}` : "",
    shot.dialogue?.trim() ? `对白：${shot.dialogue.trim()}` : "",
    shot.durationSec ? `时长(秒)：${shot.durationSec}` : "",
    shot.sfxNote?.trim() ? `音效：${shot.sfxNote.trim()}` : "",
    shot.audioNote?.trim() ? `口型/配音：${shot.audioNote.trim()}` : "",
    resolvePro2ShotFrameImagePrompt(shot)
      ? `已有分镜图提示词（可覆盖）：${resolvePro2ShotFrameImagePrompt(shot)}`
      : "",
    shot.videoPrompt?.trim()
      ? `已有视频提示词（可覆盖）：${shot.videoPrompt.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** 组装单镜 Pass 2 LLM 输入与期望 patch 骨架 */
export function buildShotPromptPolishBundle(
  shotIndex: number,
  script: Pro2ProductionScript,
  prevShotIndex?: number,
): ShotPromptPolishBundle | null {
  const shot = shotByIndex(script, shotIndex);
  if (!shot) return null;
  const prev =
    prevShotIndex != null && prevShotIndex > 0
      ? shotByIndex(script, prevShotIndex)
      : undefined;
  const dictionary = buildDictionarySection(script);
  const userParts = [
    "## 任务",
    `为镜 ${shotIndex} 生成 frameImagePrompt 与 videoPrompt（中文）。`,
    "",
    "## Pass 1 · 本镜导演表",
    formatPass1ShotBlock(shot, script),
  ];
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
      shots: [{ index: shotIndex }],
    },
  };
  return {
    systemPrompt: PRO2_SHOT_PROMPT_POLISH_SYSTEM,
    userPrompt: userParts.join("\n"),
    shotIndex,
    patchEnvelope,
  };
}
