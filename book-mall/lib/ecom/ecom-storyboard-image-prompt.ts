import {
  type CharacterPresetKey,
  resolveCharacterPresetAppearance,
} from "@/lib/ecom/ecom-storyboard-character-presets";
import {
  mergeSceneIntoImagePrompt,
  resolvePanelSceneText,
} from "@/lib/ecom/ecom-storyboard-scene-prompt";
import { getStoryboardSceneRefs } from "@/lib/ecom/ecom-storyboard-refs";
import type { StoryboardReference, StoryboardSheet } from "@/lib/ecom/ecom-storyboard-types";
import { getStoryboardCharacterRefs } from "@/lib/ecom/ecom-storyboard-refs";
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
  /** 全片场景锚点（服装 customScene / 策划 scenarioExpansion） */
  globalSceneAnchor?: string;
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

/** 参数收集占位项，不能写入生图 Prompt */
const STORYBOARD_PRODUCT_PARAM_PLACEHOLDERS = new Set([
  "沿用产品名作卖点",
  "无额外产品信息",
  "输入卖点",
]);

function isStoryboardPlaceholderProductText(value?: string | null): boolean {
  const s = value?.trim();
  if (!s) return true;
  if (STORYBOARD_PRODUCT_PARAM_PLACEHOLDERS.has(s)) return true;
  return CHAT_PRODUCT_NAME_FILTERS.some((x) => s.includes(x)) || s.startsWith("方案");
}

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
  bags: {
    style: "Chinese e-commerce handbag and bag UGC micro-drama",
    lighting: "urban lifestyle or boutique display lighting matching carry scene",
    sceneRefHint: "场景光线、背携/展示环境与道具风格须与参考一致",
    characterHint: "stylish commuter or lifestyle creator showcasing bag",
  },
  digital_3c: {
    style: "Chinese e-commerce 3C digital gadget UGC micro-drama, tech aesthetic",
    lighting: "modern desk setup, screen glow, unboxing flat lay or lifestyle tech scene",
    sceneRefHint: "场景光线、数码展示环境与道具风格须与参考一致",
    characterHint: "optional hands-on demo presenter or product-only hero shot",
  },
};

function normalizeCategory(key?: string): string {
  const k = key?.trim().toLowerCase();
  if (k && k in CATEGORY_VISUAL) return k;
  return "general";
}

function isFashionApparelContext(ctx?: StoryboardImagePromptContext): boolean {
  return normalizeCategory(ctx?.productCategory) === "fashion";
}

function isBagsContext(ctx?: StoryboardImagePromptContext): boolean {
  return normalizeCategory(ctx?.productCategory) === "bags";
}

function isDigital3cContext(ctx?: StoryboardImagePromptContext): boolean {
  return normalizeCategory(ctx?.productCategory) === "digital_3c";
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
  if (fromCtx && !isStoryboardPlaceholderProductText(fromCtx)) return fromCtx;
  const title = sheet.overview.title?.trim();
  if (title && !isStoryboardPlaceholderProductText(title)) return title;
  const logline = sheet.overview.logline?.trim();
  if (logline && !isStoryboardPlaceholderProductText(logline)) return logline;
  return "主推产品";
}

/** 从项目 meta / deliverable / chat 组装生图上下文（book-mall 侧） */
export function buildStoryboardImagePromptContext(project: {
  settings?: { aspectRatio?: string } | null;
  meta?: {
    deliverable?: {
      productName?: string;
      vertical?: string;
      params?: Record<string, string>;
      cast?: Array<{ name: string; role: string; appearance?: string }>;
      creativeBrief?: { scenarioExpansion?: string };
      dimensions?: { customScene?: string };
    };
    workflow?: {
      vertical?: string;
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
    !rawSellpoint.startsWith("参数已确认") &&
    !isStoryboardPlaceholderProductText(rawSellpoint)
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

  const fashionVertical =
    wf?.vertical === "fashion_apparel" ||
    deliverable?.vertical === "fashion_apparel";
  const bagsVertical = wf?.vertical === "bags" || deliverable?.vertical === "bags";
  const digital3cVertical =
    wf?.vertical === "digital_3c" || deliverable?.vertical === "digital_3c";

  return {
    productCategory: fashionVertical
      ? "fashion"
      : bagsVertical
        ? "bags"
        : digital3cVertical
          ? "digital_3c"
          : (wf?.productCategory ?? params?.品类),
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
    globalSceneAnchor:
      deliverable?.dimensions?.customScene?.trim() ||
      deliverable?.creativeBrief?.scenarioExpansion?.trim() ||
      undefined,
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

/** 与 wan2.7 多图 content 顺序一致：产品 → 角色 → 场景（须与实际上传 URL 列表对齐） */
export function buildStoryboardPanelRefGuideForUrls(
  refUrls: string[],
  refs: StoryboardReference[],
  ctx?: StoryboardImagePromptContext,
): string {
  const visual = categoryVisual(ctx);
  const urlToRole = new Map<string, StoryboardReference["role"]>();
  for (const ref of refs) {
    const url = ref.ossUrl?.trim();
    if (url && /^https?:\/\//.test(url)) {
      urlToRole.set(url, ref.role);
    }
  }

  const parts: string[] = [];
  refUrls.forEach((rawUrl, i) => {
    const url = rawUrl.trim();
    const role = urlToRole.get(url) ?? "other";
    const n = i + 1;
    if (role === "product") {
      parts.push(
        isFashionApparelContext(ctx)
          ? `图${n}为服装产品参考，模特须穿着与该参考图完全一致的款式、颜色、面料与细节，禁止擅自改色或换款`
          : isBagsContext(ctx)
            ? `图${n}为包包产品参考，包型、颜色、五金与材质须与参考图完全一致，禁止擅自改色或换款`
            : `图${n}为产品包装参考，画面中须自然露出该产品，包装形态、Logo、配色与材质须与参考图一致`,
      );
    } else if (role === "character") {
      parts.push(
        isFashionApparelContext(ctx)
          ? `图${n}为角色参考，人物面部、发型、体型须与参考图一致；服装款式与颜色以图1产品参考为准，勿照搬本图服装`
          : isBagsContext(ctx)
            ? `图${n}为角色参考，人物面部、发型、体型须与参考图一致；背携包包须与图1产品参考一致，勿换款改色`
            : `图${n}为角色参考，人物面部、发型、体型与服装须与参考图完全一致`,
      );
    } else {
      parts.push(`图${n}为场景参考，${visual.sceneRefHint}`);
    }
  });
  return parts.join("；");
}

/** @deprecated 请使用 buildStoryboardPanelRefGuideForUrls，与 slice 后的 refUrls 对齐 */
export function buildStoryboardPanelRefGuide(
  refs: StoryboardReference[],
  ctx?: StoryboardImagePromptContext,
): string {
  const products = refs.filter((r) => r.role === "product");
  const characters = refs.filter((r) => r.role === "character");
  const scenes = refs.filter((r) => r.role === "scene" || r.role === "other");
  const urls = [
    ...products.map((r) => r.ossUrl.trim()),
    ...characters.map((r) => r.ossUrl.trim()),
    ...scenes.map((r) => r.ossUrl.trim()),
  ].filter((u) => u && /^https?:\/\//.test(u));
  return buildStoryboardPanelRefGuideForUrls(urls, refs, ctx);
}

export function appendStoryboardImagePromptSuffix(opts: {
  basePrompt: string;
  aspectRatio?: "16:9" | "9:16";
  sendsProductRef?: boolean;
  refGuide?: string;
  refCount?: number;
  productCategory?: string;
}): string {
  const aspectZh = opts.aspectRatio === "16:9" ? "横版 16:9" : "竖版 9:16";
  const fashion = isFashionApparelContext({ productCategory: opts.productCategory });
  const bags = isBagsContext({ productCategory: opts.productCategory });
  const digital3c = isDigital3cContext({ productCategory: opts.productCategory });
  const parts: string[] = [opts.basePrompt.trim()];
  if (
    opts.sendsProductRef &&
    !opts.basePrompt.includes("参考图") &&
    !opts.basePrompt.includes("图像编辑")
  ) {
    parts.unshift(
      fashion
        ? "根据参考图进行图像编辑：模特穿着须与产品参考图一致，按以下描述生成画面。"
        : bags
          ? "根据参考图进行图像编辑：背携/展示包包须与产品参考图一致，按以下描述生成画面。"
          : digital3c
            ? "根据参考图进行图像编辑：数码产品外观须与产品参考图一致，按以下描述生成画面。"
            : "根据参考图进行图像编辑：保持产品包装与参考图一致，按以下描述生成画面。",
    );
  }
  if (
    (fashion || bags || digital3c) &&
    opts.sendsProductRef &&
    !opts.basePrompt.includes("改色")
  ) {
    parts.push(
      fashion
        ? "若文字描述中的服装颜色/款式与参考图1不一致，一律以参考图1为准，禁止擅自改色或换款。"
        : bags
          ? "若文字描述中的包型/颜色与参考图1不一致，一律以参考图1为准，禁止擅自改色或换款。"
          : "若文字描述中的产品外观/颜色与参考图1不一致，一律以参考图1为准，禁止擅自改色或换款。",
    );
  }
  if (!opts.basePrompt.includes(aspectZh) && !opts.basePrompt.includes("画幅")) {
    parts.push(`${aspectZh} 画幅。`);
  }
  if (!opts.basePrompt.includes("严禁") && !opts.basePrompt.includes("禁止")) {
    parts.push(STORYBOARD_NO_DIALOGUE_IN_IMAGE);
  }
  return parts.filter(Boolean).join("");
}

/** 优先 panel.imagePrompt（v2），否则模板拼装（legacy） */
export function resolveStoryboardPanelImagePrompt(
  panel: StoryboardSheet["panels"][0],
  sheet: StoryboardSheet,
  refs: StoryboardReference[],
  ctx?: StoryboardImagePromptContext,
  refUrls?: string[],
  refGuide?: string,
): string {
  const productRefUrl = refs.find(
    (r) => r.role === "product" && r.ossUrl?.trim().startsWith("http"),
  )?.ossUrl?.trim();
  const refCount = refUrls?.length ?? 0;
  const sendsProductRef = Boolean(
    productRefUrl &&
      (refUrls?.length ? refUrls.some((u) => u.trim() === productRefUrl) : true),
  );

  if (panel.imagePrompt?.trim()) {
    const sceneText = resolvePanelSceneText(panel, refs, ctx);
    const merged = mergeSceneIntoImagePrompt(panel.imagePrompt.trim(), sceneText);
    return appendStoryboardImagePromptSuffix({
      basePrompt: merged,
      aspectRatio: ctx?.aspectRatio,
      sendsProductRef,
      refGuide,
      refCount,
      productCategory: ctx?.productCategory,
    });
  }

  return buildStoryboardPanelImagePrompt(panel, sheet, refs, ctx, refUrls, refGuide);
}

export function buildStoryboardPanelImagePrompt(
  panel: StoryboardSheet["panels"][0],
  sheet: StoryboardSheet,
  refs: StoryboardReference[],
  ctx?: StoryboardImagePromptContext,
  refUrls?: string[],
  refGuide?: string,
): string {
  const productRefUrl = refs.find(
    (r) => r.role === "product" && r.ossUrl?.trim().startsWith("http"),
  )?.ossUrl?.trim();
  const sendsProductRef = Boolean(
    productRefUrl &&
      (refUrls?.length ? refUrls.some((u) => u.trim() === productRefUrl) : true),
  );

  const productLabel = resolveProductLabel(sheet, ctx);
  const exposure = exposureHint(ctx?.exposure);
  const exposureZh =
    exposure.includes("centered prominently")
      ? "产品居中突出、包装清晰可辨"
      : exposure.includes("subtly visible")
        ? "产品自然融入画面、弱露出"
        : "产品自然融入场景";
  const aspectZh = ctx?.aspectRatio === "16:9" ? "横版 16:9" : "竖版 9:16";
  const fashion = isFashionApparelContext(ctx);
  const isFashionWear =
    fashion &&
    sendsProductRef &&
    (panel.productInteraction === "wear" ||
      panel.productVisibility === "hero" ||
      !panel.productInteraction);
  const charLine =
    ctx?.characterAppearance?.trim() && !isFashionWear
      ? `同一人物全片一致：${ctx.characterAppearance.trim()}。`
      : isFashionWear && ctx?.characterAppearance?.trim()
        ? `同一人物全片一致（面部发型体型与设定一致，主推款外观以参考图1为准）：${ctx.characterAppearance.trim()}。`
        : "";
  const presetLine =
    !getStoryboardSceneRefs(refs).length && ctx?.scenePresetImageHint?.trim()
      ? `环境预设（${ctx.scenePresetLabel ?? ctx.scenePresetKey}）：${ctx.scenePresetImageHint.trim()}。`
      : "";
  const sceneText = resolvePanelSceneText(panel, refs, ctx);
  const moodLine = panel.dialogue?.trim()
    ? `表演情绪（勿渲染为画面文字）：${panel.dialogue.trim()}。`
    : "";
  const productRefLine = sendsProductRef
    ? fashion
      ? "须严格还原参考图1的服装款式、颜色、面料、剪裁与细节，禁止替换为其他颜色或款式。"
      : "须严格还原参考图1的产品包装（外形、标签、配色、材质），禁止替换为无关商品。"
    : "";
  const characterRefUrls = new Set(
    getStoryboardCharacterRefs(refs).map((r) => r.ossUrl.trim()),
  );
  const characterRefIndex =
    refUrls?.findIndex((u) => characterRefUrls.has(u.trim())) ?? -1;
  const characterRefLine =
    characterRefIndex >= 0
      ? fashion && sendsProductRef
        ? `人物面部、发型、体型须与参考图${characterRefIndex + 1}一致；穿着的服装款式、颜色与细节须严格以参考图1产品图为准，禁止换脸或换人。`
        : `人物面部、发型、体型与服装须与参考图${characterRefIndex + 1}完全一致，禁止换脸或换人。`
      : "";
  const editPrefix = sendsProductRef
    ? fashion
      ? "根据参考图进行图像编辑：模特穿着须与产品参考图一致，按以下分镜描述生成画面。"
      : "根据参考图进行图像编辑：保持产品包装与参考图一致，按以下分镜描述生成画面。"
    : "";

  const built = [
    editPrefix,
    "电商短视频分镜静帧，写实摄影，UGC 质感，",
    charLine,
    characterRefLine,
    presetLine,
    `镜头 ${panel.index}，${panel.shotType}，运镜 ${panel.camera ?? "固定"}。`,
    `场景与背景须严格符合：${sceneText}。`,
    `人物动作：${panel.action}。`,
    `情绪：${panel.emotion ?? "自然"}。`,
    moodLine,
    `主推产品：${productLabel}，${exposureZh}。`,
    productRefLine,
    `${aspectZh} 画幅。`,
    "构图干净，无水印，无边框，",
    "禁止擅自改成厨房、家清或无关场景（除非场景描述如此）。",
    STORYBOARD_NO_DIALOGUE_IN_IMAGE,
  ]
    .filter(Boolean)
    .join("");

  return built;
}

/** 分镜多图参考：refGuide 须与 multimodal 图序对齐，一并写入文本以锁定角色/产品指代 */
export function buildStoryboardPanelInvokePrompt(opts: {
  refGuide: string;
  panelPrompt: string;
  refCount: number;
}): string {
  const guide = opts.refGuide.trim();
  if (!guide) return opts.panelPrompt;
  return `${guide}\n\n${opts.panelPrompt}`;
}

export function buildCharacterRefPrompt(
  sheet: StoryboardSheet,
  ctx?: StoryboardImagePromptContext,
): string {
  const appearance = ctx?.characterAppearance?.trim() || resolveCharacterAppearance(sheet, ctx);
  const fashion = isFashionApparelContext(ctx);
  return [
    fashion
      ? "Fashion e-commerce portrait reference, front-facing half-body, model wearing the exact garment from product reference image — same style, color, fabric and details,"
      : "Portrait reference photo for short video character, front-facing half-body,",
    appearance,
    `${resolveProductLabel(sheet, ctx)} product ad context, natural lighting,`,
    aspectLabel(ctx?.aspectRatio ?? "9:16"),
    "photorealistic, neutral soft background, friendly natural expression,",
    "this exact person must appear identically in all subsequent storyboard frames",
  ].join(" ");
}
