import type { StoryboardSheet } from "@/lib/ecom/ecom-storyboard-types";
import {
  bailianR2vMaxRefs,
  isHappyhorseBailianR2vModel,
  isWan27BailianR2vModel,
} from "@/lib/canvas/bailian-r2v-body";
import type {
  StoryboardVideoInvokeRules,
  StoryboardVideoRefSlot,
} from "@/lib/ecom/ecom-storyboard-video-ref-rules";

type StoryboardPanel = StoryboardSheet["panels"][number];

/** 各百炼 R2V 模型实际接收的参考图上限（须与 buildBailianR2vRequestBody 切片一致） */
export function bailianR2vRefCap(modelKey: string): number {
  return bailianR2vMaxRefs(modelKey);
}

/** 按模型调入方案生成参考图说明（百炼用 [Image N]，火山用 first_frame/reference_image） */
export function buildStoryboardVideoRefGuideFromPlan(
  slots: StoryboardVideoRefSlot[],
  rules: StoryboardVideoInvokeRules,
): string {
  if (!slots.length) return "";

  const lines: string[] = [`[REFERENCE PLAN · ${rules.strategy}]`, rules.strategyNote];

  if (rules.provider === "bailian") {
    const imageRefs = slots
      .map((s, i) => `[Image ${i + 1}] ${s.label}`)
      .join("；");
    lines.push(imageRefs);
    lines.push(
      "Prompt 中的 [Image N] 与传入 media/reference_urls 数组顺序严格一致。产品/角色参考优先于分镜通用外观。",
    );
    return lines.join("\n");
  }

  let idx = 1;
  for (const s of slots) {
    if (s.role === "full_sheet" && rules.hasFirstFrameRole) {
      lines.push(
        `Image ${idx} (first_frame): ${s.label} — follow shot layout and pacing.`,
      );
    } else if (s.role === "panel" && !rules.hasFirstFrameRole && idx === 1) {
      lines.push(`Image ${idx} (primary): ${s.label}.`);
    } else {
      lines.push(`Image ${idx} (reference_image): ${s.label}.`);
    }
    idx += 1;
  }
  lines.push(
    "CRITICAL: Product and character references override generic appearance in storyboard frames.",
  );
  return lines.join("\n");
}

function bailianRefTag(index: number, modelKey: string): string {
  return isWan27BailianR2vModel(modelKey) ? `图${index}` : `[Image ${index}]`;
}

function slotRefIndex(
  slots: StoryboardVideoRefSlot[],
  role: StoryboardVideoRefSlot["role"],
): number {
  const i = slots.findIndex((s) => s.role === role);
  return i >= 0 ? i + 1 : 0;
}

function bailianSlotRefPhrase(
  slot: StoryboardVideoRefSlot,
  index: number,
  modelKey: string,
): string {
  const tag = bailianRefTag(index, modelKey);
  if (slot.role === "full_sheet") {
    return `${tag}为分镜画面宫格（各镜头图横向/网格拼接，无文字表格），仅提供镜头顺序、景别与节奏参考；不得采用其中的产品包装、人物相貌或场景背景`;
  }
  if (slot.role === "product") {
    return `${tag}为产品官方包装参考，全片产品瓶身、标签、配色、形状必须以${tag}为唯一标准`;
  }
  if (slot.role === "character") {
    return `${tag}为人物/角色参考，全片人物五官、发型、服装须与${tag}一致`;
  }
  if (slot.role === "scene") {
    return `${tag}为场景/环境参考，全片室内/户外背景、陈设、光线氛围须与${tag}一致`;
  }
  return `${tag}：${slot.label}`;
}

/** 百炼多宫格故事板成片：中文分镜脚本 + 图1/[Image 1] 指代（对齐官方范式） */
function buildBailianStoryboardGridVideoPrompt(
  sheet: StoryboardSheet,
  brief: { productHighlight?: string; style?: string } | undefined,
  slots: StoryboardVideoRefSlot[],
  rules: StoryboardVideoInvokeRules,
): string {
  const modelKey = rules.modelKey;
  const refDesc = slots
    .map((s, i) => bailianSlotRefPhrase(s, i + 1, modelKey))
    .join("；");
  const productIdx = slotRefIndex(slots, "product");
  const sceneIdx = slotRefIndex(slots, "scene");
  const characterIdx = slotRefIndex(slots, "character");
  const productTag = productIdx > 0 ? bailianRefTag(productIdx, modelKey) : "";
  const sceneTag = sceneIdx > 0 ? bailianRefTag(sceneIdx, modelKey) : "";
  const characterTag =
    characterIdx > 0 ? bailianRefTag(characterIdx, modelKey) : "";

  const highlight =
    sheet.overview.productHighlight?.trim() ||
    brief?.productHighlight?.trim();
  const shotScript = sheet.panels
    .map((p, i) => {
      const parts = [`${i + 1}. ${p.shotType}`];
      if (sceneTag) {
        parts.push(`背景环境须与${sceneTag}一致`);
      } else if (p.scene?.trim()) {
        parts.push(p.scene.trim());
      }
      if (p.action?.trim()) parts.push(p.action.trim());
      if (productTag) {
        parts.push(`出镜产品外观须与${productTag}一致`);
      }
      if (characterTag && sheet.cast.length) {
        parts.push(`人物须与${characterTag}一致`);
      }
      if (p.dialogue?.trim()) parts.push(`口播：${p.dialogue.trim()}`);
      if (p.camera?.trim()) parts.push(`镜头：${p.camera.trim()}`);
      return parts.join("，");
    })
    .join(" ");
  const duration = sheet.totalDurationHintSec ?? 15;
  const identityFirst = isHappyhorseBailianR2vModel(modelKey);
  const lines = [
    `参考：${refDesc}。`,
    identityFirst
      ? "重要：产品/角色/场景参考图的优先级高于分镜故事板；故事板仅作节奏与构图，不得覆盖身份参考。"
      : "重要：产品包装以产品参考图为准，场景环境以场景参考图为准；分镜故事板仅作节奏与构图，不得覆盖身份参考。",
    `标题：${sheet.overview.title}。`,
    sheet.overview.logline?.trim()
      ? `梗概：${sheet.overview.logline.trim()}。`
      : "",
    highlight ? `卖点：${highlight}。` : "",
    brief?.style?.trim() ? `视觉风格：${brief.style.trim()}。` : "",
    `分镜脚本：${shotScript}`,
    `生成一条连贯的电商带货微剧情短视频，画面干净无文字水印，总时长约${duration}秒。`,
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildEcomStoryboardVideoPrompt(
  sheet: StoryboardSheet,
  brief?: { productHighlight?: string; style?: string },
  _references?: unknown,
  opts?: {
    refSlots?: StoryboardVideoRefSlot[];
    refRules?: StoryboardVideoInvokeRules;
  },
): string {
  if (
    opts?.refRules?.strategy === "bailian_storyboard_grid" &&
    opts.refSlots?.length
  ) {
    return buildBailianStoryboardGridVideoPrompt(
      sheet,
      brief,
      opts.refSlots,
      opts.refRules,
    );
  }

  const lines: string[] = [
    "Generate a single cohesive e-commerce micro-drama product video following this storyboard sheet exactly.",
    `Title: ${sheet.overview.title}`,
    `Logline: ${sheet.overview.logline}`,
  ];
  const highlight =
    sheet.overview.productHighlight?.trim() ||
    brief?.productHighlight?.trim();
  if (highlight) {
    lines.push(`Product highlight: ${highlight}`);
  }
  if (brief?.style?.trim()) {
    lines.push(`Visual style: ${brief.style.trim()}`);
  }
  if (sheet.cast.length) {
    lines.push("Cast:");
    for (const c of sheet.cast) {
      lines.push(`- ${c.name} (${c.role})`);
    }
  }
  lines.push("Shots (in order):");
  for (const p of sheet.panels) {
    const parts = [
      `#${p.index} ${p.shotType}`,
      `Scene: ${p.scene}`,
      `Action: ${p.action}`,
    ];
    if (p.dialogue?.trim()) parts.push(`Dialogue: ${p.dialogue.trim()}`);
    if (p.camera?.trim()) parts.push(`Camera: ${p.camera.trim()}`);
    if (p.durationHintSec) parts.push(`~${p.durationHintSec}s`);
    if (p.videoPromptEn?.trim()) parts.push(`Prompt: ${p.videoPromptEn.trim()}`);
    lines.push(parts.join(" | "));
  }
  if (sheet.totalDurationHintSec) {
    lines.push(`Target total duration: ~${sheet.totalDurationHintSec} seconds.`);
  }
  lines.push(
    "CRITICAL: Match uploaded product packshot and character reference exactly in every shot. Do not swap product SKU or change actor identity. Smooth transitions. Commercial UGC quality.",
  );
  if (opts?.refSlots?.length && opts.refRules) {
    lines.push(buildStoryboardVideoRefGuideFromPlan(opts.refSlots, opts.refRules));
  }
  return lines.join("\n");
}

export function buildEcomStoryboardPanelVideoPrompt(
  panel: StoryboardPanel,
  sheet: StoryboardSheet,
  brief?: { productHighlight?: string; style?: string },
  opts?: {
    refSlots?: StoryboardVideoRefSlot[];
    refRules?: StoryboardVideoInvokeRules;
  },
): string {
  const highlight =
    sheet.overview.productHighlight?.trim() ||
    brief?.productHighlight?.trim();
  const lines = [
    "Generate a single storyboard shot clip for e-commerce micro-drama product video.",
    `Title: ${sheet.overview.title}`,
    highlight ? `Product highlight: ${highlight}` : "",
    `Shot #${panel.index} | ${panel.shotType}`,
    `Scene: ${panel.scene}`,
    `Action: ${panel.action}`,
    panel.emotion ? `Emotion: ${panel.emotion}` : "",
    panel.camera ? `Camera: ${panel.camera}` : "",
    panel.dialogue?.trim() ? `Dialogue: ${panel.dialogue.trim()}` : "",
    panel.durationHintSec
      ? `Target duration: ~${panel.durationHintSec} seconds.`
      : "Target duration: ~3 seconds.",
    "CRITICAL: Match product packshot and character reference from reference_image inputs. Commercial UGC quality.",
  ].filter(Boolean);
  if (opts?.refSlots?.length && opts.refRules) {
    lines.push(buildStoryboardVideoRefGuideFromPlan(opts.refSlots, opts.refRules));
  }
  return lines.join("\n");
}
