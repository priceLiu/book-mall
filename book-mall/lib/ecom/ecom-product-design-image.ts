import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import {
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
  mergeProductDesign,
  type ImageGenPlan,
  type ProductDesign,
  type ProductDesignDetailPage,
  type ProductDesignMainImage,
  type ProductDesignReference,
} from "@/lib/ecom/ecom-product-design-types";
import {
  getImageGenMaxRefs,
  orderRefsForModel,
} from "@/lib/ecom/ecom-product-design-ref-rules";
import { refLegendLines } from "@/lib/ecom/ecom-product-design-mention-tokens";
import {
  getProductDesignProject,
  updateProductDesignProject,
} from "@/lib/ecom/ecom-product-design-service";
import { ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { mapWithConcurrency } from "@/lib/generation/poll-parallel";
import { resolveEcomImageGenConcurrency } from "@/lib/ecom/ecom-image-gen-concurrency";
import { prisma } from "@/lib/prisma";

export type ProductDesignImageTarget = "main" | "detail";


const SHARED_VISUAL_RULES = [
  "画面总颜色不超过 3 种，强调色只用于标注的关键词",
  "文字排版层级清晰，主标题视觉权重最高，手机端远距离可读",
  "中文排版完整、无错别字、行间距舒适",
  "不添加水印、二维码、平台 Logo 与无关标语",
  "严格使用给定文案，不删减、不改写、不新增语句",
];

export function buildMainImagePrompt(opts: {
  item: ProductDesignMainImage;
  design: ProductDesign;
  platformLabel: string;
  ratio: EcomImageRatio;
  hasRefs: boolean;
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
  // 参考图图例不在这里拼：统一由 appendRefLegend 加到最终 Prompt 末尾，
  // 保证「计划/用户自定义 Prompt」这条路径也带上，且槽位里不出现图例文字
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

export function buildDetailPagePrompt(opts: {
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

function refUrlsFor(
  references: ProductDesignReference[],
  target: ProductDesignImageTarget,
  modelKey: string,
): {
  urls: string[];
  productCount: number;
  styleCount: number;
  styleFirst: boolean;
} {
  const product = filterProductDesignReferencesByRole(references, ["product"]).map(
    (r) => r.ossUrl,
  );
  const styleRole = target === "main" ? "main-style" : "detail-style";
  const style = filterProductDesignReferencesByRole(references, [styleRole]).map(
    (r) => r.ossUrl,
  );
  const packed = orderRefsForModel(product, style, getImageGenMaxRefs(modelKey));
  return {
    urls: packed.ordered,
    productCount: packed.productCount,
    styleCount: packed.styleCount,
    styleFirst: packed.styleFirst,
  };
}

/**
 * 给生图模型的参考图图例，说明第几张是什么、哪张才是商品本体。
 *
 * 必须挂在**每一条** Prompt 上。计划拆解或用户自定义的 Prompt 里只会写「@图片2」这类编号，
 * 模型没有图例就不知道哪张是商品，会直接照着风格参考里的商品出图。
 */
function appendRefLegend(
  prompt: string,
  opts: {
    target: ProductDesignImageTarget;
    productCount: number;
    styleCount: number;
    styleFirst: boolean;
    baselineAt?: number;
    references?: ProductDesignReference[];
  },
): string {
  if (opts.productCount <= 0 && opts.styleCount <= 0) return prompt;

  if (opts.references?.length) {
    const lines = refLegendLines(opts.references, opts.target);
    const legend = [
      "",
      "参考图说明（硬性要求，优先级高于上文；Prompt 可用 @产品实拍N / @参考图N / @模特N，或兼容旧 @图片N）：",
      ...lines,
      ...(opts.productCount
        ? [
            "- 商品的颜色、版型、材质、印花与结构细节须与商品实拍完全一致，不得替换成风格参考里的款式",
            "- 画面中必须清晰展示该商品本体（穿着或陈列），不得生成没有商品的纯文字海报",
          ]
        : []),
      ...(opts.baselineAt
        ? [`- 参考图第 ${opts.baselineAt} 张为本套主图成品，仅作整店视觉基准，不改变商品本身`]
        : []),
    ].join("\n");
    return `${prompt.trimEnd()}\n${legend}`;
  }

  const range = (from: number, count: number) =>
    count === 1 ? `第 ${from} 张` : `第 ${from}–${from + count - 1} 张`;
  const styleLabel = opts.target === "main" ? "店铺风格参考" : "详情页风格参考";
  const productFrom = opts.styleFirst ? opts.styleCount + 1 : 1;
  const styleFrom = opts.styleFirst ? 1 : opts.productCount + 1;

  const styleLine = opts.styleCount
    ? `- 参考图${range(styleFrom, opts.styleCount)}为${styleLabel}：只学习其排版、光线、背景、构图与模特气质，严禁照搬其中出现的商品`
    : null;
  const productLine = opts.productCount
    ? `- 参考图${range(productFrom, opts.productCount)}为商品实拍：成图里的商品必须是这张图中的商品本体`
    : null;

  const legend = [
    "",
    "参考图说明（硬性要求，优先级高于上文）：",
    ...(opts.styleFirst ? [styleLine, productLine] : [productLine, styleLine]).filter(
      (l): l is string => Boolean(l),
    ),
    ...(opts.productCount
      ? [
          "- 商品的颜色、版型、材质、印花与结构细节须与商品实拍完全一致，不得替换成风格参考里的款式",
          "- 画面中必须清晰展示该商品本体（穿着或陈列），不得生成没有商品的纯文字海报",
        ]
      : []),
    ...(opts.baselineAt
      ? [`- 参考图第 ${opts.baselineAt} 张为本套主图成品，仅作整店视觉基准，不改变商品本身`]
      : []),
  ].join("\n");

  return `${prompt.trimEnd()}\n${legend}`;
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
  /** 像素尺寸或 KIE 2K/4K */
  imageSize?: string;
  /** 覆盖批量出图并发（1–5） */
  concurrency?: number;
}): Promise<GenerateProductDesignImagesResult> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const project = await getProductDesignProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  if (!hasProductDesignProductRef(project.references)) {
    throw new Error("请先上传至少 1 张产品实拍图");
  }
  const design = project.design;
  if (!design) throw new Error("请先让助手产出文案，再生成图片");

  const imageGenPlan: ImageGenPlan | undefined = design.imageGenPlans?.[opts.target];

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

  const concurrency = await resolveEcomImageGenConcurrency(
    opts.userId,
    project.settings,
    opts.concurrency,
  );

  let stateLock = Promise.resolve();
  const withStateLock = async <T>(fn: () => Promise<T>): Promise<T> => {
    const prev = stateLock;
    let release!: () => void;
    stateLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  };

  const persistSlotImage = async (
    isMain: boolean,
    index: number,
    patch: Partial<ProductDesignMainImage | ProductDesignDetailPage>,
    status: "generating" | "main_ready" | "completed",
  ) => {
    await withStateLock(async () => {
      const fresh = await getProductDesignProject(opts.userId, opts.projectId);
      if (!fresh?.design) return;
      const designPatch: Partial<ProductDesign> = isMain
        ? {
            mainImages: fresh.design.mainImages.map((m) =>
              m.index === index ? { ...m, ...patch } : m,
            ),
          }
        : {
            detailPages: fresh.design.detailPages.map((d) =>
              d.index === index ? { ...d, ...patch } : d,
            ),
          };
      const merged = mergeProductDesign(fresh.design, designPatch);
      const mainDone =
        merged.mainImages.length > 0 && merged.mainImages.every((m) => m.imageUrl);
      const detailDone =
        merged.detailPages.length > 0 && merged.detailPages.every((d) => d.imageUrl);
      await updateProductDesignProject(opts.userId, opts.projectId, {
        designPatch,
        status:
          status === "generating"
            ? mainDone && detailDone
              ? "completed"
              : mainDone
                ? "main_ready"
                : "generating"
            : status,
        settings: { imageModelKey: modelKey },
      });
    });
  };

  await updateProductDesignProject(opts.userId, opts.projectId, {
    status: "generating",
    settings: { imageModelKey: modelKey },
  });

  await mapWithConcurrency(
    wanted,
    async (target) => {
      const isMain = opts.target === "main";
      const item = isMain
        ? mainImages.find((m) => m.index === target.index)
        : detailPages.find((d) => d.index === target.index);
      if (!item) return;

      const planItem = imageGenPlan?.items.find((p) => p.index === target.index);
      const slotItem = isMain
        ? (item as ProductDesignMainImage)
        : (item as ProductDesignDetailPage);
      let prompt =
        slotItem.genPrompt?.trim() ||
        planItem?.prompt?.trim() ||
        "";
      if (!prompt) {
        if (isMain) {
          prompt = buildMainImagePrompt({
            item: item as ProductDesignMainImage,
            design,
            platformLabel: spec.label,
            ratio,
            hasRefs: refImageUrls.length > 0,
            visualBrief:
              design.visualBrief?.main?.derivedPrompt ??
              imageGenPlan?.sharedVisualBrief,
          });
        } else {
          prompt = buildDetailPagePrompt({
            item: item as ProductDesignDetailPage,
            design,
            platformLabel: spec.label,
            ratio,
            hasRefs: refImageUrls.length > 0,
            baselineImageUrl,
            visualBrief:
              design.visualBrief?.detail?.derivedPrompt ??
              imageGenPlan?.sharedVisualBrief,
          });
        }
      }
      if (!prompt.trim()) {
        failures.push({ index: target.index, message: "缺少生图 Prompt" });
        return;
      }

      // 主图基准挂在末尾：前插会把 Prompt 里的「图片N」整体后移一位，指错参考图
      const refsMax = getImageGenMaxRefs(modelKey);
      const refs =
        !isMain && baselineImageUrl
          ? [...refImageUrls, baselineImageUrl].slice(0, refsMax)
          : refImageUrls;
      const baselineAt =
        !isMain && baselineImageUrl && refs.length > refImageUrls.length
          ? refs.length
          : undefined;

      prompt = appendRefLegend(prompt, {
        target: opts.target,
        productCount: refPack.productCount,
        styleCount: refPack.styleCount,
        styleFirst: refPack.styleFirst,
        baselineAt,
        references: project.references,
      });

      try {
        const ossUrl = await generateEcomImage({
          userId: opts.userId,
          modelKey,
          prompt,
          ratio,
          imageSize: opts.imageSize,
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
              projectName:
                (typeof project.brief?.productName === "string" &&
                  project.brief.productName.trim()) ||
                project.title?.trim() ||
                undefined,
              source: "product-creation",
              kind: isMain ? "main_image" : "detail_page",
              index: item.index,
              platform: spec.code,
              ratio,
              modelKey,
            },
          },
        });

        await withStateLock(async () => {
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
        });
        const mainDone = mainImages.length > 0 && mainImages.every((m) => m.imageUrl);
        const detailDone =
          detailPages.length > 0 && detailPages.every((d) => d.imageUrl);
        await persistSlotImage(
          isMain,
          item.index,
          {
            imageUrl: ossUrl,
            assetId: asset.id,
            genPrompt: prompt,
          },
          mainDone && detailDone ? "completed" : mainDone ? "main_ready" : "generating",
        );
      } catch (e) {
        await withStateLock(async () => {
          failures.push({
            index: item.index,
            message: e instanceof Error ? e.message : "生成失败",
          });
        });
      }
    },
    concurrency,
  );

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
