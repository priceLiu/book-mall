import {
  type CharacterPresetKey,
  resolveCharacterPresetAppearance,
} from "@/lib/ecom/ecom-storyboard-character-presets";
import type { StoryboardReference, StoryboardSheet } from "@/lib/ecom/ecom-storyboard-types";
import {
  resolveScenePresetImageHint,
  resolveScenePresetLabel,
} from "@/lib/ecom/ecom-storyboard-scene-presets";

/** 分镜静帧禁止渲染口播/对白为画面文字 */
export const STORYBOARD_NO_DIALOGUE_IN_IMAGE =
  "严禁在画面中出现任何对白字幕、台词文字、气泡对话框、口播文案叠字或横幅标语；口播内容仅作表演指导，不得渲染为可见文字";

export type StoryboardImagePromptContext = {
  productCategory?: string;
  productName?: string;
  productHighlight?: string;
  videoStyle?: string;
  exposure?: string;
  scenePresetKey?: string;
  scenePresetLabel?: string;
  scenePresetImageHint?: string;
  aspectRatio?: "16:9" | "9:16";
  /** 全片须为同一人物：来自 LLM cast、系统预设或品类默认 */
  characterAppearance?: string;
  characterPresetKey?: string;
};

const CHAT_PRODUCT_NAME_FILTERS = [
  "按默认方案A",
  "快速生成",
  "自定义参数",
  "参数已确认",
  "输入卖点",
  "家清日化",
  "美妆护肤",
  "3C数码",
  "食品饮料",
  "服饰鞋包",
  "其他通用",
];

type CategoryVisual = {
  style: string;
  lighting: string;
  sceneRefHint: string;
  characterHint: string;
};

const CATEGORY_VISUAL: Record<string, CategoryVisual> = {
  fashion: {
    style: "Chinese e-commerce fashion apparel and accessories UGC micro-drama",
    lighting: "wardrobe mirror, bedroom dressing area or urban lifestyle lighting matching scene",
    sceneRefHint: "场景光线、穿搭/试衣环境与道具风格须与参考一致",
    characterHint: "stylish urban commuter or lifestyle UGC creator",
  },
  beauty: {
    style: "Chinese e-commerce beauty skincare UGC micro-drama",
    lighting: "soft vanity or bright bathroom mirror lighting, clean skincare aesthetic",
    sceneRefHint: "场景光线、梳妆/护肤环境与道具风格须与参考一致",
    characterHint: "polished skincare UGC creator, natural makeup",
  },
  digital: {
    style: "Chinese e-commerce 3C digital gadget UGC micro-drama",
    lighting: "modern office desk or commute tech-review lighting",
    sceneRefHint: "场景光线、数码测评环境与道具风格须与参考一致",
    characterHint: "tech reviewer UGC style, modern casual",
  },
  food: {
    style: "Chinese e-commerce food beverage UGC micro-drama",
    lighting: "warm kitchen or dining table food photography lighting",
    sceneRefHint: "场景光线、餐饮环境与道具风格须与参考一致",
    characterHint: "food tasting UGC creator, appetizing setting",
  },
  home_clean: {
    style: "Chinese e-commerce home cleaning product UGC micro-drama",
    lighting: "bright home kitchen or bathroom cleaning scene lighting",
    sceneRefHint: "场景光线、家清环境与道具风格须与参考一致",
    characterHint: "friendly homemaker UGC style, clean home setting",
  },
  general: {
    style: "Chinese e-commerce product UGC micro-drama",
    lighting: "natural indoor UGC lighting matching the scene description",
    sceneRefHint: "场景光线、环境与道具风格须与参考一致",
    characterHint: "friendly Chinese UGC creator, natural expression",
  },
};

function normalizeCategory(key?: string): string {
  const k = key?.trim().toLowerCase();
  if (k && k in CATEGORY_VISUAL) return k;
  return "general";
}

function categoryVisual(ctx?: StoryboardImagePromptContext): CategoryVisual {
  return CATEGORY_VISUAL[normalizeCategory(ctx?.productCategory)]!;
}

function aspectLabel(ratio?: "16:9" | "9:16"): string {
  return ratio === "16:9" ? "horizontal 16:9 frame" : "vertical 9:16 frame";
}

function videoStyleHint(style?: string): string {
  if (!style?.trim()) return "authentic casual UGC handheld feel";
  if (style.includes("专业质感")) return "professional commercial lighting, polished UGC aesthetic";
  if (style.includes("快节奏")) return "dynamic fast-paced composition, energetic cuts";
  if (style.includes("治愈慢节奏")) return "soft slow-paced cozy atmosphere";
  return "authentic casual UGC handheld feel";
}

function exposureHint(exposure?: string): string {
  if (!exposure?.trim()) return "";
  if (exposure.includes("强特写") || exposure.includes("中心突出") || exposure.includes("教学式"))
    return "product centered prominently in frame, clear packshot visibility";
  if (exposure.includes("弱露出")) return "product subtly visible in scene, not dominating frame";
  return "product naturally integrated into scene";
}

function resolveProductLabel(
  sheet: StoryboardSheet,
  ctx?: StoryboardImagePromptContext,
): string {
  const fromCtx =
    ctx?.productHighlight?.trim() ||
    ctx?.productName?.trim() ||
    sheet.overview.productHighlight?.trim();
  if (fromCtx && !fromCtx.startsWith("方案")) return fromCtx;
  const title = sheet.overview.title?.trim();
  if (title && !title.startsWith("方案")) return title;
  return sheet.overview.logline?.trim() || "featured product";
}

/** 从项目 meta / deliverable / chat 组装生图上下文（book-mall 侧） */
export function buildStoryboardImagePromptContext(project: {
  settings?: { aspectRatio?: string } | null;
  meta?: {
    deliverable?: {
      productName?: string;
      params?: Record<string, string>;
      cast?: Array<{ name: string; role: string; appearance?: string }>;
    };
    workflow?: {
      productCategory?: string;
      collectedParams?: Record<string, string>;
      scenePreset?: string;
      scenePresetCustom?: string;
      characterPresetKey?: string;
    };
  } | null;
  chatHistory?: { role: string; content: string }[];
} | null): StoryboardImagePromptContext {
  const wf = project?.meta?.workflow;
  const deliverable = project?.meta?.deliverable;
  const params = { ...deliverable?.params, ...wf?.collectedParams };

  let productName = deliverable?.productName?.trim();
  if (!productName && project?.chatHistory?.length) {
    const firstUser = project.chatHistory.find(
      (m) =>
        m.role === "user" &&
        m.content.trim() &&
        !CHAT_PRODUCT_NAME_FILTERS.some((x) => m.content.includes(x)) &&
        !m.content.startsWith("参数已确认"),
    );
    productName = firstUser?.content.trim().slice(0, 120);
  }

  const rawSellpoint = params?.产品信息?.trim();
  const productHighlight =
    rawSellpoint &&
    rawSellpoint.length < 200 &&
    !rawSellpoint.includes("storyboard-deliverable") &&
    !rawSellpoint.startsWith("参数已确认")
      ? rawSellpoint
      : undefined;

  const aspect =
    project?.settings?.aspectRatio === "16:9" ||
    project?.settings?.aspectRatio === "9:16"
      ? project.settings.aspectRatio
      : undefined;

  const scenePresetKey = wf?.scenePreset?.trim();
  const scenePresetCustom = wf?.scenePresetCustom?.trim();
  const characterPresetKey = wf?.characterPresetKey?.trim();
  const ugcPersona = params?.["人物UGC人设"]?.trim();
  let characterAppearance: string | undefined;
  if (characterPresetKey === "female_ugc" || characterPresetKey === "male_ugc") {
    characterAppearance = resolveCharacterPresetAppearance(
      characterPresetKey as CharacterPresetKey,
      ugcPersona,
    );
  } else {
    const fromDeliverableCast = deliverable?.cast?.find((c) => c.appearance?.trim());
    if (fromDeliverableCast?.appearance?.trim()) {
      characterAppearance = fromDeliverableCast.appearance.trim();
    }
  }

  return {
    productCategory: wf?.productCategory ?? params?.品类,
    productName,
    productHighlight: productHighlight ?? productName,
    videoStyle: params?.视频风格?.trim(),
    exposure: params?.产品露出强度?.trim(),
    scenePresetKey,
    scenePresetLabel: resolveScenePresetLabel(scenePresetKey, scenePresetCustom),
    scenePresetImageHint: resolveScenePresetImageHint(scenePresetKey, scenePresetCustom),
    aspectRatio: aspect,
    characterAppearance,
    characterPresetKey,
  };
}

/** 合并 sheet.cast、workflow 预设与品类默认，得到全片人物一致描述 */
export function resolveCharacterAppearance(
  sheet: StoryboardSheet,
  ctx?: StoryboardImagePromptContext,
  workflow?: {
    characterPresetKey?: string;
    collectedParams?: Record<string, string>;
  },
): string {
  const fromCast = sheet.cast
    .map((c) => c.appearance?.trim())
    .find(Boolean);
  if (fromCast) return fromCast;

  const presetKey = workflow?.characterPresetKey?.trim() as CharacterPresetKey | undefined;
  if (presetKey === "female_ugc" || presetKey === "male_ugc") {
    return resolveCharacterPresetAppearance(
      presetKey,
      workflow?.collectedParams?.["人物UGC人设"],
    );
  }

  if (ctx?.characterAppearance?.trim()) return ctx.characterAppearance.trim();

  if (sheet.cast.length > 0) {
    return sheet.cast.map((c) => `${c.name} (${c.role})`).join(", ");
  }

  return categoryVisual(ctx).characterHint;
}

function characterConsistencyHint(ctx?: StoryboardImagePromptContext): string {
  const appearance = ctx?.characterAppearance?.trim();
  if (!appearance) return "";
  return `SAME actor in every shot — identical face, hairstyle, skin tone and outfit: ${appearance}`;
}

export function buildStoryboardCompositeImagePrompt(
  sheet: StoryboardSheet,
  refs: StoryboardReference[],
  aspectRatio: "16:9" | "9:16",
  ctx?: StoryboardImagePromptContext,
): string {
  const visual = categoryVisual(ctx);
  const panelLines = sheet.panels
    .map(
      (p) =>
        `Panel ${p.index} (${p.timeline ?? ""}): ${p.shotType}, camera ${p.camera ?? "fixed"}, scene: ${p.scene}, action: ${p.action}, mood: ${p.emotion ?? "natural"}`,
    )
    .join("; ");

  const productRef = refs.find((r) => r.role === "product");
  const charRef = refs.find((r) => r.role === "character");

  const refHint = [
    productRef ? "include product reference styling from uploaded product image" : "",
    charRef
      ? "match character appearance from uploaded character reference exactly"
      : characterConsistencyHint(ctx),
  ]
    .filter(Boolean)
    .join(", ");

  return [
    `Professional e-commerce video storyboard sheet, ${aspectRatio} layout,`,
    `${sheet.panels.length} sequential storyboard panels in a clean grid with borders and shot labels,`,
    `${visual.style}, photorealistic,`,
    `title: ${sheet.overview.title}, logline: ${sheet.overview.logline},`,
    `product: ${resolveProductLabel(sheet, ctx)},`,
    panelLines,
    refHint,
    "high detail, consistent lighting, no watermark",
    "background must match each panel scene description, never default to unrelated kitchen",
    STORYBOARD_NO_DIALOGUE_IN_IMAGE,
  ]
    .filter(Boolean)
    .join(" ");
}

/** 与 wan2.7 多图 content 顺序一致：产品 → 角色 → 场景 */
export function buildStoryboardPanelRefGuide(
  refs: StoryboardReference[],
  ctx?: StoryboardImagePromptContext,
): string {
  const visual = categoryVisual(ctx);
  const products = refs.filter((r) => r.role === "product");
  const characters = refs.filter((r) => r.role === "character");
  const scenes = refs.filter((r) => r.role === "scene" || r.role === "other");

  let idx = 1;
  const parts: string[] = [];
  if (products.length) {
    parts.push(`图${idx}为产品包装参考，画面中须自然露出该产品`);
    idx += products.length;
  }
  for (let i = 0; i < characters.length; i++) {
    parts.push(
      `图${idx + i}为角色参考${characters.length > 1 ? i + 1 : ""}，人物面部、发型、体型与服装须与参考图一致`,
    );
  }
  idx += characters.length;
  for (let i = 0; i < scenes.length; i++) {
    parts.push(`图${idx + i}为场景参考，${visual.sceneRefHint}`);
  }
  return parts.join("；");
}

export function buildStoryboardPanelImagePrompt(
  panel: StoryboardSheet["panels"][0],
  sheet: StoryboardSheet,
  _refs: StoryboardReference[],
  ctx?: StoryboardImagePromptContext,
): string {
  const visual = categoryVisual(ctx);
  const voiceoverHint = panel.dialogue?.trim()
    ? `表演情绪参考（勿渲染为画面文字）：${panel.dialogue.trim()}`
    : "";
  const exposure = exposureHint(ctx?.exposure);
  const styleHint = videoStyleHint(ctx?.videoStyle);
  const presetHint = ctx?.scenePresetImageHint
    ? `preset environment (${ctx.scenePresetLabel ?? ctx.scenePresetKey}): ${ctx.scenePresetImageHint}, all shots must use this environment unless panel scene explicitly differs`
    : "";

  const charConsistency = characterConsistencyHint(ctx);

  return [
    "Single photorealistic storyboard frame for Chinese e-commerce UGC micro-drama,",
    visual.style + ",",
    styleHint + ",",
    charConsistency,
    presetHint,
    `shot ${panel.index}, ${panel.shotType}, camera ${panel.camera ?? "static"},`,
    `scene (background and location must match exactly): ${panel.scene},`,
    `action: ${panel.action},`,
    `emotion: ${panel.emotion ?? "natural"},`,
    voiceoverHint,
    `product: ${resolveProductLabel(sheet, ctx)},`,
    exposure,
    aspectLabel(ctx?.aspectRatio),
    visual.lighting + ",",
    "clean composition, no watermark, no panel borders,",
    "do not invent kitchen or cleaning scene unless scene description says so",
    STORYBOARD_NO_DIALOGUE_IN_IMAGE,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildCharacterRefPrompt(
  sheet: StoryboardSheet,
  ctx?: StoryboardImagePromptContext,
): string {
  const appearance = ctx?.characterAppearance?.trim() || resolveCharacterAppearance(sheet, ctx);
  return [
    "Portrait reference photo for short video character, front-facing half-body,",
    appearance,
    `${resolveProductLabel(sheet, ctx)} product ad context, natural lighting,`,
    aspectLabel(ctx?.aspectRatio ?? "9:16"),
    "photorealistic, neutral soft background, friendly natural expression,",
    "this exact person must appear identically in all subsequent storyboard frames",
  ].join(" ");
}
