import { assertStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import type { CanvasChatContentPart } from "@/lib/canvas/providers/types";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  buildDetailPagePrompt,
  buildMainImagePrompt,
} from "@/lib/ecom/ecom-product-design-image";
import { getEcomPlatformSpec } from "@/lib/ecom/ecom-platform-spec";
import {
  emptyProductDesign,
  filterProductDesignReferencesByRole,
  hasProductDesignProductRef,
  mergeProductDesign,
  type ImageGenPlan,
  type ImageGenPlanItem,
  type ProductContext,
  type ProductDesign,
  type ProductDesignDetailPage,
  type ProductDesignMainImage,
  type ProductDesignReference,
} from "@/lib/ecom/ecom-product-design-types";
import {
  getProductDesignProject,
  updateProductDesignProject,
} from "@/lib/ecom/ecom-product-design-service";
import {
  buildSemanticMentionRefs,
  refLegendLines,
} from "@/lib/ecom/ecom-product-design-mention-tokens";
import {
  drainEcomGwChat,
  refsForVisionAnalysis,
  type ProductDesignVisionTarget,
} from "@/lib/ecom/ecom-product-design-vision";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import {
  ECOM_DETAIL_PAGE_ACTION,
  ECOM_DETAIL_PAGE_TOOL_KEY,
  ECOM_MAIN_IMAGE_ACTION,
  ECOM_MAIN_IMAGE_TOOL_KEY,
} from "@/lib/ecom/ecom-product-design-types";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";

export type ImageGenPlanTarget = "main" | "detail";

const MAIN_DECOMPOSE_SYSTEM = `你是电商主图策划与 AI 生图 Prompt 专家。用户会提供商品实拍、可选的主图风格参考，以及可选的文字意图。
请识别商品信息，并拆解为 N 张主图（N 由你根据参考图/平台规范决定，通常 4–9 张），每张职责不同、姿势/场景/构图有差异。

必须只输出一个 JSON 对象（不要 markdown 围栏），字段：
{
  "productContext": {
    "productName": "商品名",
    "productCategory": "品类",
    "sellingPoints": ["卖点1", "卖点2"],
    "description": "一句话描述",
    "visualTone": "视觉调性",
    "targetUserGroup": "目标人群"
  },
  "sharedVisualBrief": "整套主图共享的风格/光影/场景约束（可选）",
  "items": [
    {
      "index": 1,
      "title": "如：正面全身",
      "purpose": "本张主图职责",
      "prompt": "给生图模型的完整中文指令，须含画幅气质、场景、光影、模特姿势、构图、商品锁定、文案层级占位说明"
    }
  ]
}
items 长度即主图张数，index 从 1 递增，每条 prompt 须可独立用于单张出图。

商品锁定（最高优先级）：商品实拍里的商品才是本次要卖的商品。风格参考只提供排版、光影、场景与模特气质，
其中出现的商品与本次无关。每条 prompt 都要写明商品的颜色/版型/材质以商品实拍为准，并注明「不得替换为风格参考中的款式」。`;

const DETAIL_DECOMPOSE_SYSTEM = `你是电商详情页策划与 AI 生图 Prompt 专家。用户会提供商品实拍、详情页风格参考长图，以及可选的文字意图。
请识别商品信息，并将参考详情拆解为 N 屏（N 由参考图模块数决定，通常 5–12 屏），每屏一主题。

必须只输出一个 JSON 对象（不要 markdown 围栏），字段：
{
  "productContext": {
    "productName": "商品名",
    "productCategory": "品类",
    "sellingPoints": ["卖点1"],
    "description": "一句话描述",
    "visualTone": "视觉调性"
  },
  "sharedVisualBrief": "整套详情页共享的版式/色调/模块节奏（可选）",
  "items": [
    {
      "index": 1,
      "title": "屏标题",
      "purpose": "本屏使命",
      "prompt": "给生图模型的完整中文指令，须含单屏海报排版、主标题/正文要点、商品呈现方式、与整套视觉统一约束"
    }
  ]
}
items 长度即详情屏数，index 从 1 递增。

商品锁定（最高优先级）：商品实拍里的商品才是本次要卖的商品。详情页风格参考只提供版式、模块节奏与调性，
其中出现的商品与本次无关。每条 prompt 都要写明商品的颜色/版型/材质以商品实拍为准，并注明「不得替换为风格参考中的款式」。`;

function refLegendNote(
  refs: ProductDesignReference[],
  target: "main" | "detail",
): string {
  if (refs.length === 0) return "";
  const lines = refLegendLines(refs, target);
  return [
    "参考图清单（prompt 里请用 @产品实拍N / @参考图N / @模特N，或兼容旧 @图片N）：",
    ...lines,
    "硬性要求：每条 prompt 都必须把商品锁定到 @产品实拍1（或对应商品实拍 token），明确写出商品的颜色/版型/材质以其为准；严禁把风格/模特参考里的商品当成本次商品。",
  ].join("\n");
}

function parseDecomposeJson(text: string): {
  productContext?: ProductContext;
  sharedVisualBrief?: string;
  items: ImageGenPlanItem[];
} {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("拆解未返回有效 JSON");
  }
  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items: ImageGenPlanItem[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const row = rawItems[i];
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const prompt = typeof r.prompt === "string" ? r.prompt.trim() : "";
    const title =
      typeof r.title === "string" && r.title.trim()
        ? r.title.trim()
        : `第 ${i + 1} 张`;
    if (!prompt) continue;
    items.push({
      index: typeof r.index === "number" && r.index > 0 ? r.index : i + 1,
      title,
      purpose: typeof r.purpose === "string" ? r.purpose.trim() : undefined,
      prompt,
    });
  }
  if (items.length === 0) throw new Error("拆解结果为空，请检查参考图后重试");

  items.sort((a, b) => a.index - b.index);
  items.forEach((item, i) => {
    item.index = i + 1;
  });

  let productContext: ProductContext | undefined;
  if (parsed.productContext && typeof parsed.productContext === "object") {
    const pc = parsed.productContext as Record<string, unknown>;
    productContext = {
      productName: typeof pc.productName === "string" ? pc.productName.trim() : undefined,
      productCategory:
        typeof pc.productCategory === "string" ? pc.productCategory.trim() : undefined,
      sellingPoints: Array.isArray(pc.sellingPoints)
        ? pc.sellingPoints.map(String).filter(Boolean)
        : undefined,
      description: typeof pc.description === "string" ? pc.description.trim() : undefined,
      visualTone: typeof pc.visualTone === "string" ? pc.visualTone.trim() : undefined,
      targetUserGroup:
        typeof pc.targetUserGroup === "string" ? pc.targetUserGroup.trim() : undefined,
    };
  }

  const sharedVisualBrief =
    typeof parsed.sharedVisualBrief === "string"
      ? parsed.sharedVisualBrief.trim()
      : undefined;

  return { productContext, sharedVisualBrief, items };
}

function strField(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  return undefined;
}

function productContextFromBrief(
  project: Awaited<ReturnType<typeof getProductDesignProject>>,
): ProductContext | undefined {
  if (!project) return undefined;
  const b = project.brief;
  if (!b) return undefined;
  const mainPain = b.mainPainPoint;
  const coreAdv = b.productCoreAdvantage;
  return {
    productName: strField(b.productName),
    productCategory: strField(b.productCategory),
    sellingPoints: Array.isArray(mainPain)
      ? mainPain.map(String).filter(Boolean)
      : coreAdv
        ? Array.isArray(coreAdv)
          ? coreAdv.map(String).filter(Boolean)
          : [String(coreAdv)]
        : undefined,
    description: strField(b.productName),
    visualTone: project.design?.analysis?.visualTone?.trim() || undefined,
    targetUserGroup: strField(b.targetUserGroup),
  };
}

function reindexPlanItems(items: ImageGenPlanItem[]): ImageGenPlanItem[] {
  return items.map((item, i) => ({ ...item, index: i + 1 }));
}

/** 用户显式改过 Prompt（保存值与库内 genPrompt 不同）时打上 promptEdited */
function nextPromptEdited(
  item: ImageGenPlanItem,
  old: { genPrompt?: string; promptEdited?: boolean } | undefined,
  markEdits: boolean,
): boolean | undefined {
  if (!markEdits) return old?.promptEdited;
  const changed = (old?.genPrompt?.trim() ?? "") !== item.prompt.trim();
  return changed ? true : old?.promptEdited;
}

function materializeMainImages(
  plan: ImageGenPlan,
  prev: ProductDesignMainImage[],
  markEdits: boolean,
): ProductDesignMainImage[] {
  return plan.items.map((item) => {
    const old = prev.find((m) => m.index === item.index);
    const copy = item.copySnapshot as ProductDesignMainImage | undefined;
    return {
      index: item.index,
      purpose: item.purpose || old?.purpose || `主图 ${item.index}`,
      layers: copy?.layers ??
        old?.layers ?? {
          title: item.title,
          bullets: [],
        },
      emphasis: copy?.emphasis ?? old?.emphasis ?? { bold: [], color: [] },
      genPrompt: item.prompt,
      promptEdited: nextPromptEdited(item, old, markEdits),
      imageUrl: old?.imageUrl,
      assetId: old?.assetId,
      ratio: old?.ratio,
    };
  });
}

function materializeDetailPages(
  plan: ImageGenPlan,
  prev: ProductDesignDetailPage[],
  markEdits: boolean,
): ProductDesignDetailPage[] {
  return plan.items.map((item) => {
    const old = prev.find((d) => d.index === item.index);
    const copy = item.copySnapshot as ProductDesignDetailPage | undefined;
    return {
      index: item.index,
      purpose: item.purpose || old?.purpose || `详情第 ${item.index} 屏`,
      title: copy?.title ?? old?.title ?? item.title,
      body: copy?.body ?? old?.body ?? [],
      keyInfo: copy?.keyInfo ?? old?.keyInfo,
      closingLine: copy?.closingLine ?? old?.closingLine,
      layoutHint: copy?.layoutHint ?? old?.layoutHint,
      genPrompt: item.prompt,
      promptEdited: nextPromptEdited(item, old, markEdits),
      imageUrl: old?.imageUrl,
      assetId: old?.assetId,
      ratio: old?.ratio,
    };
  });
}

/**
 * 重新拆解 / 重推草稿时，把用户手改过的 Prompt 写回新计划，
 * 让计划与 design 始终一致（中间区读的是 plan.items）。
 */
function keepEditedPrompts(
  plan: ImageGenPlan,
  design: ProductDesign,
  target: ImageGenPlanTarget,
): { plan: ImageGenPlan; keptCount: number } {
  const prev: Array<{ index: number; genPrompt?: string; promptEdited?: boolean }> =
    target === "main" ? design.mainImages : design.detailPages;
  let keptCount = 0;
  const items = plan.items.map((item) => {
    const old = prev.find((s) => s.index === item.index);
    if (old?.promptEdited && old.genPrompt?.trim()) {
      keptCount += 1;
      return { ...item, prompt: old.genPrompt };
    }
    return item;
  });
  return { plan: { ...plan, items }, keptCount };
}

function designPatchFromPlan(
  plan: ImageGenPlan,
  design: ProductDesign,
  target: ImageGenPlanTarget,
  opts?: { markEdits?: boolean },
): Partial<ProductDesign> {
  const markEdits = Boolean(opts?.markEdits);
  return {
    imageGenPlans: { [target]: plan },
    ...(target === "main"
      ? { mainImages: materializeMainImages(plan, design.mainImages, markEdits) }
      : { detailPages: materializeDetailPages(plan, design.detailPages, markEdits) }),
  };
}

function countSettingsFromPlan(
  plan: ImageGenPlan,
  target: ImageGenPlanTarget,
): Record<string, number> {
  return target === "main"
    ? { mainImageCount: plan.items.length }
    : { detailPageCount: plan.items.length };
}

export async function decomposeImageGenPlan(opts: {
  userId: string;
  projectId: string;
  target: ImageGenPlanTarget;
  modelKey?: string;
  intentPrompt?: string;
  source?: "reference-decompose" | "reference-intent";
}): Promise<{ plan: ImageGenPlan; project: NonNullable<Awaited<ReturnType<typeof getProductDesignProject>>> }> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const project = await getProductDesignProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  if (!hasProductDesignProductRef(project.references)) {
    throw new Error("请先上传至少 1 张产品实拍图");
  }

  const modelKey =
    opts.modelKey?.trim() ||
    project.settings.visionModelKey?.trim() ||
    ECOM_DEFAULT_VISION_MODEL;
  assertStoryLlmVisionModel(modelKey, "Prompt 拆解");

  const target = opts.target;
  const styleRole = target === "main" ? "main-style" : "detail-style";
  const styleRefs = filterProductDesignReferencesByRole(project.references, [styleRole]);
  const productRefs = filterProductDesignReferencesByRole(project.references, ["product"]);
  const intent = opts.intentPrompt?.trim() || "";
  const customPrompt =
    target === "main"
      ? project.settings.mainImageCustomPrompt?.trim()
      : project.settings.detailPageCustomPrompt?.trim();
  const hasIntent = Boolean(intent || customPrompt);
  const isIntentSource = opts.source === "reference-intent";

  // 详情「识别拆解」须有 detail-style；主图风格参考可选（有产品实拍即可）
  if (target === "detail" && !isIntentSource && !hasIntent && styleRefs.length === 0) {
    throw new Error("请先上传至少 1 张详情页参考图（detail-style）");
  }

  const refs = refsForVisionAnalysis(
    project.references,
    target as ProductDesignVisionTarget,
    modelKey,
  );
  const imageUrls = refs.map((r) => r.ossUrl);
  const spec = getEcomPlatformSpec(project.platform);

  const styleNote =
    target === "main" && styleRefs.length === 0
      ? "未上传主图风格参考（main-style），请根据商品实拍与平台规范推导主图系列方案与差异姿势。"
      : styleRefs.length === 0
        ? "未上传风格参考，请结合商品与平台规范推导。"
        : `已上传 ${styleRefs.length} 张风格参考、${productRefs.length} 张商品实拍。`;

  const userParts: CanvasChatContentPart[] = [
    ...imageUrls.map(
      (url): CanvasChatContentPart => ({
        type: "image_url",
        image_url: { url },
      }),
    ),
    {
      type: "text",
      text: [
        `平台：${spec.label}`,
        `任务：拆解${target === "main" ? "主图" : "详情页"}生图 Prompt 计划。`,
        styleNote,
        intent ? `用户意图（须融入每条 prompt）：\n${intent}` : "",
        customPrompt && !intent ? `用户自定义 Prompt（须融入每条 prompt）：\n${customPrompt}` : "",
        project.brief?.productName ? `产品名：${String(project.brief.productName)}` : "",
        refLegendNote(refs, target),
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];

  const toolKey =
    target === "main"
      ? `${ECOM_MAIN_IMAGE_TOOL_KEY}__${ECOM_MAIN_IMAGE_ACTION}`
      : `${ECOM_DETAIL_PAGE_TOOL_KEY}__${ECOM_DETAIL_PAGE_ACTION}`;

  const raw = await drainEcomGwChat(opts.userId, {
    modelKey,
    messages: [
      {
        role: "system",
        content: target === "main" ? MAIN_DECOMPOSE_SYSTEM : DETAIL_DECOMPOSE_SYSTEM,
      },
      {
        role: "user",
        content: userParts.length === 1 && userParts[0]?.type === "text"
          ? userParts[0].text
          : userParts,
      },
    ],
    clientPage: ecomClientPage(opts.userId, opts.projectId, toolKey),
  });

  const parsed = parseDecomposeJson(raw);
  const source =
    opts.source ??
    (intent || customPrompt ? "reference-intent" : "reference-decompose");

  const baseDesign = project.design ?? emptyProductDesign();
  const { plan } = keepEditedPrompts(
    {
      target,
      source,
      status: "draft",
      productContext: parsed.productContext ?? productContextFromBrief(project),
      sharedVisualBrief: parsed.sharedVisualBrief,
      items: parsed.items,
    },
    baseDesign,
    target,
  );

  const designPatch = designPatchFromPlan(plan, baseDesign, target);

  const updated = await updateProductDesignProject(opts.userId, opts.projectId, {
    designPatch,
    settings: {
      visionModelKey: modelKey,
      ...countSettingsFromPlan(plan, target),
    },
  });

  return { plan, project: updated ?? { ...project, design: mergeProductDesign(baseDesign, designPatch) } };
}

export async function deriveImageGenPlan(opts: {
  userId: string;
  projectId: string;
  target: ImageGenPlanTarget;
}): Promise<{ plan: ImageGenPlan; project: NonNullable<Awaited<ReturnType<typeof getProductDesignProject>>> }> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const project = await getProductDesignProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  const design = project.design;
  if (!design) throw new Error("请先让助手产出文案");

  const spec = getEcomPlatformSpec(project.platform);
  const ratio =
    opts.target === "main"
      ? project.resolved.mainImageRatio
      : project.resolved.detailPageRatio;
  const visualBrief =
    opts.target === "main"
      ? design.visualBrief?.main?.derivedPrompt
      : design.visualBrief?.detail?.derivedPrompt;

  const productRefs = filterProductDesignReferencesByRole(project.references, ["product"]);
  const styleRole = opts.target === "main" ? "main-style" : "detail-style";
  const styleRefs = filterProductDesignReferencesByRole(project.references, [styleRole]);
  const hasRefs = productRefs.length + styleRefs.length > 0;

  let items: ImageGenPlanItem[];

  if (opts.target === "main") {
    if (design.mainImages.length === 0) throw new Error("还没有主图文案，请先完成 Step4");
    items = design.mainImages.map((item) => ({
      index: item.index,
      title: item.layers?.title || `主图 ${item.index}`,
      purpose: item.purpose,
      prompt: buildMainImagePrompt({
        item,
        design,
        platformLabel: spec.label,
        ratio,
        hasRefs,
        visualBrief: visualBrief ?? design.imageGenPlans?.main?.sharedVisualBrief,
      }),
      copySnapshot: item as unknown as Record<string, unknown>,
    }));
  } else {
    if (design.detailPages.length === 0) throw new Error("还没有详情屏文案，请先完成 Step8");
    const baselineImageUrl = design.mainImages.find((m) => m.imageUrl)?.imageUrl;
    items = design.detailPages.map((item) => ({
      index: item.index,
      title: item.title,
      purpose: item.purpose,
      prompt: buildDetailPagePrompt({
        item,
        design,
        platformLabel: spec.label,
        ratio,
        hasRefs,
        baselineImageUrl,
        visualBrief: visualBrief ?? design.imageGenPlans?.detail?.sharedVisualBrief,
      }),
      copySnapshot: item as unknown as Record<string, unknown>,
    }));
  }

  const { plan } = keepEditedPrompts(
    {
      target: opts.target,
      source: "interactive",
      status: "draft",
      productContext: productContextFromBrief(project),
      sharedVisualBrief: visualBrief,
      items,
    },
    design,
    opts.target,
  );

  const designPatch = designPatchFromPlan(plan, design, opts.target);

  await updateProductDesignProject(opts.userId, opts.projectId, {
    designPatch,
    settings: countSettingsFromPlan(plan, opts.target),
  });

  const updated = await getProductDesignProject(opts.userId, opts.projectId);
  if (!updated) throw new Error("项目不存在");
  return { plan, project: updated };
}

export async function patchImageGenPlan(opts: {
  userId: string;
  projectId: string;
  target: ImageGenPlanTarget;
  productContext?: ProductContext;
  sharedVisualBrief?: string;
  items?: ImageGenPlanItem[];
}): Promise<{ plan: ImageGenPlan; project: NonNullable<Awaited<ReturnType<typeof getProductDesignProject>>> }> {
  const project = await getProductDesignProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  const design = project.design;
  if (!design) throw new Error("设计稿不存在");

  let existing = design.imageGenPlans?.[opts.target];
  if (!existing) {
    const slots = opts.target === "main" ? design.mainImages : design.detailPages;
    if (slots.length === 0) {
      throw new Error("还没有 Prompt 计划，请先拆解或生成草稿");
    }
    existing = {
      target: opts.target,
      source: "interactive",
      status: "draft",
      productContext: productContextFromBrief(project),
      items: slots.map((slot) => {
        if (opts.target === "main") {
          const m = slot as ProductDesignMainImage;
          return {
            index: m.index,
            title: m.layers?.title || `主图 ${m.index}`,
            purpose: m.purpose,
            prompt: m.genPrompt?.trim() ?? "",
          };
        }
        const d = slot as ProductDesignDetailPage;
        return {
          index: d.index,
          title: d.title || `详情 ${d.index}`,
          purpose: d.purpose,
          prompt: d.genPrompt?.trim() ?? "",
        };
      }),
    };
  }

  let items = opts.items ?? existing.items;
  items = reindexPlanItems(
    items.map((item) => ({
      ...item,
      title: item.title?.trim() || `第 ${item.index} 张`,
      prompt: item.prompt?.trim() ?? "",
    })),
  );
  if (items.length === 0) throw new Error("至少需要 1 个出图槽位");

  const plan: ImageGenPlan = {
    ...existing,
    status: "draft",
    productContext: opts.productContext ?? existing.productContext,
    sharedVisualBrief:
      opts.sharedVisualBrief !== undefined
        ? opts.sharedVisualBrief
        : existing.sharedVisualBrief,
    items,
  };

  // 显式保存：与库内 genPrompt 不同的条目标记为用户编辑，重新拆解时保留
  const designPatch = designPatchFromPlan(plan, design, opts.target, { markEdits: true });

  await updateProductDesignProject(opts.userId, opts.projectId, {
    designPatch,
    settings: countSettingsFromPlan(plan, opts.target),
  });

  const updated = await getProductDesignProject(opts.userId, opts.projectId);
  if (!updated) throw new Error("项目不存在");
  return { plan, project: updated };
}

export async function confirmImageGenPlan(opts: {
  userId: string;
  projectId: string;
  target: ImageGenPlanTarget;
}): Promise<{ plan: ImageGenPlan; project: NonNullable<Awaited<ReturnType<typeof getProductDesignProject>>> }> {
  const project = await getProductDesignProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  const design = project.design;
  if (!design) throw new Error("设计稿不存在");

  const existing = design.imageGenPlans?.[opts.target];
  if (!existing) throw new Error("还没有 Prompt 计划，请先拆解或生成草稿");
  if (existing.items.length === 0) throw new Error("Prompt 计划为空");

  const plan: ImageGenPlan = { ...existing, status: "confirmed" };

  const designPatch: Partial<ProductDesign> = {
    imageGenPlans: { [opts.target]: plan },
  };

  if (opts.target === "main") {
    designPatch.mainImages = materializeMainImages(plan, design.mainImages, false);
  } else {
    designPatch.detailPages = materializeDetailPages(plan, design.detailPages, false);
  }

  const settingsPatch: Record<string, number> =
    opts.target === "main"
      ? { mainImageCount: plan.items.length }
      : { detailPageCount: plan.items.length };

  await updateProductDesignProject(opts.userId, opts.projectId, {
    designPatch,
    settings: settingsPatch,
  });

  const updated = await getProductDesignProject(opts.userId, opts.projectId);
  if (!updated) throw new Error("项目不存在");
  return { plan, project: updated };
}
