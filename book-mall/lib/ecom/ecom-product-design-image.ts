import { randomUUID } from "crypto";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { buildKieImageCreateArgs } from "@/lib/canvas/providers/kie";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  ecomRatioToImageSize,
  getEcomPlatformSpec,
  type EcomImageRatio,
} from "@/lib/ecom/ecom-platform-spec";
import {
  filterProductDesignReferencesByRole,
  hasProductDesignProductRef,
  ECOM_DETAIL_PAGE_ACTION,
  ECOM_DETAIL_PAGE_MODULE,
  ECOM_DETAIL_PAGE_TOOL_KEY,
  ECOM_MAIN_IMAGE_ACTION,
  ECOM_MAIN_IMAGE_MODULE,
  ECOM_MAIN_IMAGE_TOOL_KEY,
  type ProductDesign,
  type ProductDesignDetailPage,
  type ProductDesignMainImage,
  type ProductDesignReference,
} from "@/lib/ecom/ecom-product-design-types";
import { getImageGenMaxRefs } from "@/lib/ecom/ecom-product-design-ref-rules";
import { isVisualBriefStale } from "@/lib/ecom/ecom-product-design-vision";
import {
  getProductDesignProject,
  updateProductDesignProject,
} from "@/lib/ecom/ecom-product-design-service";
import { resolveKlingV3Resolution } from "@/lib/ecom/ecom-storyboard-gen-params";
import {
  isStoryboardKieImageModel,
  isStoryboardKlingImageModel,
  isWan26ImageModel,
  resolveStoryboardDashscopeModel,
  resolveStoryboardKieModel,
  resolveStoryboardKlingModel,
} from "@/lib/ecom/ecom-storyboard-image-models";
import { ensureStoryboardRefImagesForWan27 } from "@/lib/ecom/ecom-storyboard-ref-image";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import {
  ecomGwCreateDashscopeJob,
  ecomGwCreateKieJob,
  ecomGwPollDashscope,
  ecomGwPollKie,
} from "@/lib/gateway/ecom-tool-gateway-client";
import { prisma } from "@/lib/prisma";

export type ProductDesignImageTarget = "main" | "detail";

/** 可灵只接受三种比例，取数值上最接近的一档 */
function toKlingAspect(ratio: EcomImageRatio): "16:9" | "9:16" | "1:1" {
  const value = { "1:1": 1, "3:4": 0.75, "4:5": 0.8, "16:9": 16 / 9 }[ratio];
  const candidates: Array<{ key: "16:9" | "9:16" | "1:1"; value: number }> = [
    { key: "16:9", value: 16 / 9 },
    { key: "1:1", value: 1 },
    { key: "9:16", value: 9 / 16 },
  ];
  return candidates.reduce((best, cur) =>
    Math.abs(cur.value - value) < Math.abs(best.value - value) ? cur : best,
  ).key;
}

function isTransientPollError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg === "fetch failed" ||
    msg.includes("网络异常") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT")
  );
}

async function pollDashscopeImage(
  userId: string,
  taskId: string,
  logId: string,
): Promise<string> {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    let polled: Awaited<ReturnType<typeof ecomGwPollDashscope>>;
    try {
      polled = await ecomGwPollDashscope(userId, { taskId, gatewayLogId: logId });
    } catch (e) {
      if (isTransientPollError(e) && i < 59) continue;
      throw e instanceof Error ? e : new Error(String(e));
    }
    if (polled.status === "SUCCEEDED" && polled.outputUrl) return polled.outputUrl;
    if (polled.status === "FAILED") throw new Error(polled.failMessage ?? "生图任务失败");
  }
  throw new Error("生图超时，请稍后重试");
}

async function pollKieImage(
  userId: string,
  taskId: string,
  logId: string,
): Promise<string> {
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const polled = await ecomGwPollKie(userId, { taskId, gatewayLogId: logId });
    if (polled.status === "SUCCEEDED" && polled.outputUrl) return polled.outputUrl;
    if (polled.status === "FAILED") throw new Error(polled.failMessage ?? "生图任务失败");
  }
  throw new Error("生图超时，请稍后重试");
}

async function downloadAndUpload(userId: string, imageUrl: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(imageUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      msg === "fetch failed" ? "下载生成图失败：网络中断，请重试" : `下载生成图失败：${msg}`,
    );
  }
  if (!res.ok) throw new Error(`下载生成图失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return uploadCanvasUserBuffer({ userId, ext: "png", buf, contentType: "image/png" });
}

const SHARED_VISUAL_RULES = [
  "画面总颜色不超过 3 种，强调色只用于标注的关键词",
  "文字排版层级清晰，主标题视觉权重最高，手机端远距离可读",
  "中文排版完整、无错别字、行间距舒适",
  "不添加水印、二维码、平台 Logo 与无关标语",
  "严格使用给定文案，不删减、不改写、不新增语句",
];

function buildMainImagePrompt(opts: {
  item: ProductDesignMainImage;
  design: ProductDesign;
  platformLabel: string;
  ratio: EcomImageRatio;
  hasRefs: boolean;
  productRefCount?: number;
  styleRefCount?: number;
  visualBrief?: string;
}): string {
  const { item, design } = opts;
  const layers = item.layers ?? { title: `主图 ${item.index}`, bullets: [] };
  const emphasis = item.emphasis ?? { bold: [], color: [] };
  const bullets = Array.isArray(layers.bullets) ? layers.bullets : [];
  const lines: string[] = [
    `生成 ${opts.ratio} 比例的电商商品主图，适配【${opts.platformLabel}】平台视觉规范。`,
    `本图定位：${item.purpose || "商品主图"}`,
    "",
  ];
  if (opts.visualBrief?.trim()) {
    lines.push("视觉分析指令（须严格遵循）：", opts.visualBrief.trim(), "");
  }
  if (opts.hasRefs && (opts.productRefCount ?? 0) > 0) {
    lines.push(
      "参考图说明（硬性要求）：",
      `- 参考图第 1–${opts.productRefCount} 张为商品实拍，画面中必须清晰展示该商品本体（穿着或陈列），不得生成纯文字海报而无商品`,
      "- 商品颜色、版型、材质须与商品实拍参考一致，不得替换为其他款式",
      ...(opts.styleRefCount
        ? [
            `- 参考图第 ${(opts.productRefCount ?? 0) + 1} 张起为店铺风格参考，须学习其光线、背景、构图与模特气质`,
          ]
        : []),
      "",
    );
  }
  lines.push("画面文案（按层级从上到下排布）：");
  if (layers.topHint) lines.push(`- 顶部引导小字：${layers.topHint}`);
  lines.push(`- 核心主标题：${layers.title || `主图 ${item.index}`}`);
  if (layers.subtitle) lines.push(`- 副标题：${layers.subtitle}`);
  bullets.forEach((b, i) => lines.push(`- 卖点${i + 1}：${b}`));
  if (layers.delivery) lines.push(`- 交付说明：${layers.delivery}`);
  if (layers.footer) lines.push(`- 底部收口：${layers.footer}`);

  if (emphasis.bold.length) {
    lines.push("", `需放大加粗的关键词：${emphasis.bold.join("、")}`);
  }
  if (emphasis.color.length) {
    lines.push(`需彩色强调的关键词：${emphasis.color.join("、")}`);
  }

  const tone = design.analysis?.visualTone?.trim();
  if (tone) lines.push("", `整体视觉调性：${tone}`);

  lines.push("", "视觉约束：");
  SHARED_VISUAL_RULES.forEach((r) => lines.push(`- ${r}`));
  if (opts.hasRefs) {
    lines.push("- 商品外观、材质、配色须与参考图完全一致，不得臆造造型");
  }
  return lines.join("\n");
}

/** 用户自定义 Prompt + 多张参考图（不依赖 Step4 分层文案） */
function buildReferenceDrivenMainPrompt(opts: {
  item: ProductDesignMainImage;
  platformLabel: string;
  ratio: EcomImageRatio;
  customPrompt: string;
  visualBrief?: string;
  productRefCount: number;
  styleRefCount: number;
}): string {
  const lines: string[] = [
    `生成 ${opts.ratio} 比例电商主图，适配【${opts.platformLabel}】。`,
    `本图：主图 ${opts.item.index} · ${opts.item.purpose || "商品主图"}`,
    "",
    "用户指令（最高优先级）：",
    opts.customPrompt.trim(),
    "",
  ];
  if (opts.visualBrief?.trim()) {
    lines.push("视觉分析补充：", opts.visualBrief.trim(), "");
  }
  if (opts.productRefCount > 0 || opts.styleRefCount > 0) {
    lines.push(
      "参考图约束：",
      ...(opts.styleRefCount > 0
        ? [`- @图片1–${opts.styleRefCount} 为店铺风格参考（与上传区 @ 序号一致）`]
        : []),
      ...(opts.productRefCount > 0
        ? [
            `- @图片${opts.styleRefCount + 1}${opts.productRefCount > 1 ? `–${opts.styleRefCount + opts.productRefCount}` : ""} 为商品实拍，必须清晰呈现商品本体`,
          ]
        : []),
      "- 生图时将商品实拍参考置于模型输入优先位置，风格参考用于学习光线/场景/构图",
    );
  }
  return lines.join("\n");
}

function buildDetailPagePrompt(opts: {
  item: ProductDesignDetailPage;
  design: ProductDesign;
  platformLabel: string;
  ratio: EcomImageRatio;
  hasRefs: boolean;
  baselineImageUrl?: string;
  visualBrief?: string;
}): string {
  const { item } = opts;
  const lines: string[] = [
    `生成 ${opts.ratio} 比例的商品详情页单屏海报（第 ${item.index} 屏），适配【${opts.platformLabel}】平台规范。`,
    `本屏目的：${item.purpose || "说明产品价值"}`,
    "",
  ];
  if (opts.visualBrief?.trim()) {
    lines.push("视觉分析指令（须严格遵循）：", opts.visualBrief.trim(), "");
  }
  lines.push(`主标题：${item.title}`);
  if (item.body.length) {
    lines.push("正文：");
    item.body.forEach((b) => lines.push(`- ${b}`));
  }
  if (item.keyInfo) lines.push(`重点信息：${item.keyInfo}`);
  if (item.closingLine) lines.push(`收束金句：${item.closingLine}`);
  if (item.layoutHint) lines.push(`排版形式：${item.layoutHint}`);

  lines.push("", "视觉锁定规则：");
  if (opts.baselineImageUrl) {
    lines.push("- 以本套主图为视觉基准，100% 沿用其色调、字体层级、卡片边框与图标风格");
  }
  lines.push("- 保持整店视觉一体化，不切换设计语言");
  SHARED_VISUAL_RULES.forEach((r) => lines.push(`- ${r}`));
  lines.push("- 默认不出现人物形象；单屏只讲一件事，信息不堆叠");
  if (opts.hasRefs) {
    lines.push("- 商品外观须与参考图一致");
  }
  return lines.join("\n");
}

async function generateOneImage(opts: {
  userId: string;
  projectId: string;
  modelKey: string;
  prompt: string;
  ratio: EcomImageRatio;
  refImageUrls: string[];
  toolKey: string;
}): Promise<string> {
  const prompt = String(opts.prompt ?? "").trim();
  if (!prompt) {
    throw new Error("生图 Prompt 为空，请先完成视觉分析");
  }
  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(opts.userId, workspaceId, opts.toolKey);

  if (isStoryboardKieImageModel(opts.modelKey)) {
    const { model, input } = buildKieImageCreateArgs({
      modelKey: resolveStoryboardKieModel(opts.modelKey),
      prompt,
      imageUrls: opts.refImageUrls.slice(0, 8),
      params: {
        aspect_ratio: opts.ratio,
        resolution: "2K",
        output_format: "png",
      },
    });
    const { taskId, logId } = await ecomGwCreateKieJob(opts.userId, {
      model,
      input,
      clientPage,
    });
    const vendorUrl = await pollKieImage(opts.userId, taskId, logId);
    return downloadAndUpload(opts.userId, vendorUrl);
  }

  if (isStoryboardKlingImageModel(opts.modelKey)) {
    const refs = await ensureStoryboardRefImagesForWan27({
      userId: opts.userId,
      urls: opts.refImageUrls.slice(0, 10),
    });
    const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
      kind: "kling-v3-image",
      model: resolveStoryboardKlingModel(opts.modelKey),
      content: [...refs.map((url) => ({ image: url })), { text: prompt }],
      aspectRatio: toKlingAspect(opts.ratio),
      resolution: resolveKlingV3Resolution(),
      n: 1,
      clientPage,
    });
    const vendorUrl = await pollDashscopeImage(opts.userId, taskId, logId);
    return downloadAndUpload(opts.userId, vendorUrl);
  }

  const apiModel = resolveStoryboardDashscopeModel(opts.modelKey);
  const size = ecomRatioToImageSize(opts.ratio);

  if (opts.refImageUrls.length === 0) {
    const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
      kind: "wanx",
      model: apiModel,
      prompt,
      n: 1,
      size,
      clientPage,
    });
    const vendorUrl = await pollDashscopeImage(opts.userId, taskId, logId);
    return downloadAndUpload(opts.userId, vendorUrl);
  }

  const wan26 = isWan26ImageModel(apiModel) || isWan26ImageModel(opts.modelKey);
  const refs = await ensureStoryboardRefImagesForWan27({
    userId: opts.userId,
    urls: opts.refImageUrls,
  });
  const content: Array<{ text: string } | { image: string }> = wan26
    ? [{ text: prompt }, ...refs.map((url) => ({ image: url }))]
    : [...refs.map((url) => ({ image: url })), { text: prompt }];

  const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
    kind: "wan27-image",
    model: apiModel,
    content,
    size: wan26 ? undefined : size,
    n: 1,
    contentOrder: wan26 ? "text-first" : "images-first",
    clientPage,
  });
  const vendorUrl = await pollDashscopeImage(opts.userId, taskId, logId);
  return downloadAndUpload(opts.userId, vendorUrl);
}

function refUrlsFor(
  references: ProductDesignReference[],
  target: ProductDesignImageTarget,
  modelKey: string,
): { urls: string[]; productCount: number; styleCount: number } {
  const product = filterProductDesignReferencesByRole(references, ["product"]).map(
    (r) => r.ossUrl,
  );
  const styleRole = target === "main" ? "main-style" : "detail-style";
  const style = filterProductDesignReferencesByRole(references, [styleRole]).map(
    (r) => r.ossUrl,
  );
  const max = getImageGenMaxRefs(modelKey);
  const urls = [...product, ...style].slice(0, max);
  const productCount = Math.min(product.length, urls.length);
  const styleCount = Math.max(0, urls.length - productCount);
  return { urls, productCount, styleCount };
}

export type GenerateProductDesignImagesResult = {
  design: ProductDesign;
  generated: number;
  failures: Array<{ index: number; message: string }>;
};

/**
 * 生成主图或详情屏。indexes 为空表示生成该类别下全部还没有图的条目。
 * 出图落 EcomAsset，module 沿用 main-image / detail-page，保证「我的资产」分组不变。
 */
export async function generateProductDesignImages(opts: {
  userId: string;
  projectId: string;
  target: ProductDesignImageTarget;
  indexes?: number[];
  modelKey?: string;
  /** 覆盖平台默认比例 */
  ratio?: EcomImageRatio;
}): Promise<GenerateProductDesignImagesResult> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const project = await getProductDesignProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  if (!hasProductDesignProductRef(project.references)) {
    throw new Error("请先上传至少 1 张产品实拍图");
  }
  const design = project.design;
  if (!design) throw new Error("请先让助手产出文案，再生成图片");

  const useRefPrompt =
    opts.target === "main" &&
    project.settings.mainImageGenMode === "reference-prompt" &&
    Boolean(project.settings.mainImageCustomPrompt?.trim());

  if (!useRefPrompt && isVisualBriefStale(design, opts.target, project.references)) {
    throw new Error("参考图或文案已变更，请先重新执行视觉分析");
  }
  const visualEntry =
    opts.target === "main" ? design.visualBrief?.main : design.visualBrief?.detail;
  const visualBriefText = visualEntry?.derivedPrompt;
  if (!visualBriefText?.trim() && !useRefPrompt) {
    throw new Error("请先完成视觉分析，再生成图片");
  }

  const spec = getEcomPlatformSpec(project.platform);
  const modelKey =
    opts.modelKey?.trim() ||
    project.settings.imageModelKey?.trim() ||
    ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;
  const ratio =
    opts.ratio ??
    (opts.target === "main"
      ? project.resolved.mainImageRatio
      : project.resolved.detailPageRatio);

  const items: Array<{ index: number }> =
    opts.target === "main" ? design.mainImages : design.detailPages;
  if (items.length === 0) {
    throw new Error(opts.target === "main" ? "还没有主图文案" : "还没有详情页文案");
  }

  const wanted =
    opts.indexes && opts.indexes.length > 0
      ? items.filter((i) => opts.indexes!.includes(i.index))
      : items;
  if (wanted.length === 0) throw new Error("找不到要生成的条目");

  const refPack = refUrlsFor(project.references, opts.target, modelKey);
  const refImageUrls = refPack.urls;
  const baselineImageUrl = design.mainImages.find((m) => m.imageUrl)?.imageUrl;

  let mainImages = [...design.mainImages];
  let detailPages = [...design.detailPages];
  const failures: GenerateProductDesignImagesResult["failures"] = [];
  let generated = 0;

  for (const target of wanted) {
    const isMain = opts.target === "main";
    const item = isMain
      ? mainImages.find((m) => m.index === target.index)
      : detailPages.find((d) => d.index === target.index);
    if (!item) continue;

    const prompt = isMain
      ? useRefPrompt
        ? buildReferenceDrivenMainPrompt({
            item: item as ProductDesignMainImage,
            platformLabel: spec.label,
            ratio,
            customPrompt: project.settings.mainImageCustomPrompt!.trim(),
            visualBrief: visualBriefText,
            productRefCount: refPack.productCount,
            styleRefCount: refPack.styleCount,
          })
        : buildMainImagePrompt({
            item: item as ProductDesignMainImage,
            design,
            platformLabel: spec.label,
            ratio,
            hasRefs: refImageUrls.length > 0,
            productRefCount: refPack.productCount,
            styleRefCount: refPack.styleCount,
            visualBrief: visualBriefText,
          })
      : buildDetailPagePrompt({
          item: item as ProductDesignDetailPage,
          design,
          platformLabel: spec.label,
          ratio,
          hasRefs: refImageUrls.length > 0,
          baselineImageUrl,
          visualBrief: visualBriefText,
        });

    const refsMax = getImageGenMaxRefs(modelKey);
    const refs =
      !isMain && baselineImageUrl
        ? [baselineImageUrl, ...refImageUrls].slice(0, refsMax)
        : refImageUrls;

    try {
      const ossUrl = await generateOneImage({
        userId: opts.userId,
        projectId: opts.projectId,
        modelKey,
        prompt,
        ratio,
        refImageUrls: refs,
        toolKey: isMain
          ? `${ECOM_MAIN_IMAGE_TOOL_KEY}__${ECOM_MAIN_IMAGE_ACTION}`
          : `${ECOM_DETAIL_PAGE_TOOL_KEY}__${ECOM_DETAIL_PAGE_ACTION}`,
      });

      const asset = await prisma.ecomAsset.create({
        data: {
          userId: opts.userId,
          module: isMain ? ECOM_MAIN_IMAGE_MODULE : ECOM_DETAIL_PAGE_MODULE,
          kind: "image",
          title: (isMain
            ? `${(item as ProductDesignMainImage).layers?.title ?? "主图"} · 主图${item.index}`
            : `${(item as ProductDesignDetailPage).title ?? "详情"} · 第${item.index}屏`
          ).slice(0, 80),
          prompt,
          ossUrl,
          thumbnailUrl: ossUrl,
          meta: {
            projectId: opts.projectId,
            source: "product-creation",
            kind: isMain ? "main_image" : "detail_page",
            index: item.index,
            platform: spec.code,
            ratio,
            modelKey,
          },
        },
      });

      if (isMain) {
        mainImages = mainImages.map((m) =>
          m.index === item.index
            ? { ...m, imageUrl: ossUrl, assetId: asset.id, genPrompt: prompt }
            : m,
        );
      } else {
        detailPages = detailPages.map((d) =>
          d.index === item.index
            ? { ...d, imageUrl: ossUrl, assetId: asset.id, genPrompt: prompt }
            : d,
        );
      }
      generated += 1;
    } catch (e) {
      failures.push({
        index: item.index,
        message: e instanceof Error ? e.message : "生成失败",
      });
    }
  }

  const nextDesign: ProductDesign = { ...design, mainImages, detailPages };
  const mainDone = mainImages.length > 0 && mainImages.every((m) => m.imageUrl);
  const detailDone = detailPages.length > 0 && detailPages.every((d) => d.imageUrl);

  await updateProductDesignProject(opts.userId, opts.projectId, {
    design: nextDesign,
    status: mainDone && detailDone ? "completed" : mainDone ? "main_ready" : "generating",
    settings: { imageModelKey: modelKey },
  });

  if (generated === 0 && failures.length > 0) {
    throw new Error(failures[0]!.message);
  }

  return { design: nextDesign, generated, failures };
}
