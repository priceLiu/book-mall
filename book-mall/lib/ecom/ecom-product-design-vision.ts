import { assertStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import type { CanvasChatMessage, CanvasChatContentPart } from "@/lib/canvas/providers/types";
import { getEcomPlatformSpec } from "@/lib/ecom/ecom-platform-spec";
import {
  filterProductDesignReferencesByRole,
  productDesignRefFingerprint,
  emptyProductDesign,
  type ProductDesign,
  type ProductDesignReference,
  type ProductDesignVisualBriefEntry,
} from "@/lib/ecom/ecom-product-design-types";
import {
  getVisionMaxInputImages,
  orderRefsForModel,
} from "@/lib/ecom/ecom-product-design-ref-rules";
import {
  getProductDesignProject,
  updateProductDesignProject,
} from "@/lib/ecom/ecom-product-design-service";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import {
  ECOM_DETAIL_PAGE_TOOL_KEY,
  ECOM_MAIN_IMAGE_TOOL_KEY,
  ECOM_MAIN_IMAGE_ACTION,
  ECOM_DETAIL_PAGE_ACTION,
} from "@/lib/ecom/ecom-product-design-types";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { ecomGwChatStream } from "@/lib/gateway/ecom-tool-gateway-client";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";

export type ProductDesignVisionTarget = "main" | "detail";

const REFERENCE_STYLE_VISION_SYSTEM = `你是电商主图视觉策划专家。用户会提供多张店铺风格参考图（模特/场景/光线/构图）和商品实拍。
请先「学习风格参考」再锁定商品外观，输出可用于 AI 批量出图的详细视觉指令。

必须只输出一个 JSON 对象（不要 markdown 围栏），字段：
{
  "summary": "面向用户的摘要：风格关键词 + 商品锁定要点（3-5 句）",
  "derivedPrompt": "给生图模型的完整指令（中文），须分段包含：①整体风格（色调/情绪/画幅气质）②场景与背景（材质/空间/道具）③光影（方向/色温/软硬/对比）④模特与姿势建议（体态/表情/多套差异姿势，如站立/行走/坐姿）⑤构图与镜头（景别/留白/文字区）⑥商品本体约束（须与实拍一致的颜色/版型/材质，必须出现在画面）",
  "productTraits": "商品外观锁定要点",
  "styleTraits": "从参考图提炼的风格要点（姿势/光影/场景/色调分项简述）"
}`;

const VISION_SYSTEM = `你是电商视觉分析专家。用户会提供产品实拍图，以及可选的风格参考图。
请分析图片中的：商品外观/材质/配色、构图与排版风格、色调与情绪、需锁定的视觉元素。
结合用户给出的文案上下文，输出用于 AI 生图的视觉指令。

必须只输出一个 JSON 对象（不要 markdown 围栏），字段：
{
  "summary": "面向用户的简短中文摘要（2-4 句）",
  "derivedPrompt": "给生图模型的完整视觉描述（中文，含商品外观约束与排版风格）",
  "productTraits": "商品外观要点",
  "styleTraits": "风格/构图要点；若无风格参考则写 AI 推导方向"
}`;

function buildCopyContext(target: ProductDesignVisionTarget, design: ProductDesign): string {
  if (target === "main") {
    const lines = design.mainImages.map(
      (m) =>
        `主图${m.index}「${m.purpose}」：${m.layers.title} / ${m.layers.bullets.join("；")}`,
    );
    return `主图文案：\n${lines.join("\n")}`;
  }
  const lines = design.detailPages.map(
    (d) => `第${d.index}屏：${d.title} — ${d.body.slice(0, 2).join("；")}`,
  );
  return `详情文案：\n${lines.join("\n")}`;
}

export async function drainEcomGwChat(
  userId: string,
  opts: {
    modelKey: string;
    messages: CanvasChatMessage[];
    clientPage?: string;
  },
): Promise<string> {
  const gw = await ecomGwChatStream(userId, opts);
  const reader = gw.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = "";
  let fullText = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split("\n");
      sseBuffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const chunk = JSON.parse(payload) as {
            choices?: { delta?: { content?: string | null } }[];
          };
          const piece = chunk.choices?.[0]?.delta?.content ?? "";
          if (piece) fullText += piece;
        } catch {
          /* ignore */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return fullText;
}

function parseVisionJson(text: string): Omit<ProductDesignVisualBriefEntry, "modelKey" | "analyzedAt" | "refFingerprint"> {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("视觉分析未返回有效 JSON");
  }
  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  const derivedPrompt =
    typeof parsed.derivedPrompt === "string" ? parsed.derivedPrompt.trim() : "";
  if (!derivedPrompt) throw new Error("视觉分析缺少 derivedPrompt");
  return {
    summary: summary || derivedPrompt.slice(0, 200),
    derivedPrompt,
    productTraits:
      typeof parsed.productTraits === "string" ? parsed.productTraits.trim() : undefined,
    styleTraits:
      typeof parsed.styleTraits === "string" ? parsed.styleTraits.trim() : undefined,
  };
}

/**
 * 顺序由 orderRefsForModel 统一决定，与生图下发和前端 @图片N 编号一致；
 * 调用方不再自选顺序，否则同一批图在分析与出图两步会拿到不同编号。
 */
export function refsForVisionAnalysis(
  references: ProductDesignReference[],
  target: ProductDesignVisionTarget,
  modelKey: string,
): ProductDesignReference[] {
  const product = filterProductDesignReferencesByRole(references, ["product"]);
  const styleRole = target === "main" ? "main-style" : "detail-style";
  const style = filterProductDesignReferencesByRole(references, [styleRole]);
  return orderRefsForModel(product, style, getVisionMaxInputImages(modelKey)).ordered;
}

export async function analyzeProductDesignReferences(opts: {
  userId: string;
  projectId: string;
  target: ProductDesignVisionTarget;
  modelKey?: string;
  /** reference-style：多张风格参考 + 自定义 Prompt，深度分析姿势/光影/场景/色调 */
  analysisMode?: "copy" | "reference-style";
}): Promise<{ entry: ProductDesignVisualBriefEntry; design: ProductDesign }> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const project = await getProductDesignProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  if (!filterProductDesignReferencesByRole(project.references, ["product"]).length) {
    throw new Error("请先上传至少 1 张产品实拍图");
  }
  const design = project.design;
  const referenceStyle = opts.analysisMode === "reference-style";
  if (!design && !referenceStyle) {
    throw new Error("请先完成文案步骤再分析参考图");
  }

  const modelKey =
    opts.modelKey?.trim() ||
    project.settings.visionModelKey?.trim() ||
    ECOM_DEFAULT_VISION_MODEL;
  assertStoryLlmVisionModel(modelKey, "视觉分析");

  const refs = refsForVisionAnalysis(project.references, opts.target, modelKey);
  const imageUrls = refs.map((r) => r.ossUrl);
  const styleRole = opts.target === "main" ? "main-style" : "detail-style";
  const fingerprint = productDesignRefFingerprint(project.references, [
    "product",
    styleRole,
  ]);

  const spec = getEcomPlatformSpec(project.platform);
  const styleCount = filterProductDesignReferencesByRole(project.references, [
    styleRole,
  ]).length;
  const productCount = filterProductDesignReferencesByRole(project.references, [
    "product",
  ]).length;
  const visionMax = getVisionMaxInputImages(modelKey);
  const styleNote = referenceStyle
    ? [
        `用户已上传 ${styleCount} 张风格参考、${productCount} 张商品实拍。`,
        styleCount > 0
          ? "请逐张学习风格参考中的模特气质、姿势、光影、场景、色调与构图，并规划多套可批量出图的差异姿势。"
          : "未上传风格参考，请根据商品与平台规范推导风格。",
        visionMax < styleCount + productCount
          ? `视觉模型单次最多分析 ${visionMax} 张，已按「风格优先」选取前 ${imageUrls.length} 张。`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : filterProductDesignReferencesByRole(project.references, [styleRole]).length ===
        0
      ? "用户未上传风格参考图，请根据平台规范与文案自行推导视觉风格。"
      : "用户已上传风格参考图，请提取其构图/色调/排版特征。";

  const copyCtx =
    design && !referenceStyle ? buildCopyContext(opts.target, design) : "";
  const customPrompt =
    opts.target === "main"
      ? project.settings.mainImageCustomPrompt?.trim()
      : project.settings.detailPageCustomPrompt?.trim();
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
        `任务：为${opts.target === "main" ? "主图" : "详情页"}批量出图做视觉分析。`,
        styleNote,
        referenceStyle && customPrompt
          ? `用户自定义 Prompt（须融入 derivedPrompt）：\n${customPrompt}`
          : "",
        copyCtx,
        design?.analysis?.visualTone && !referenceStyle
          ? `整体视觉调性（助手已产出）：${design.analysis.visualTone}`
          : "",
        referenceStyle
          ? "图片顺序：先风格参考，后商品实拍（与 @图片1… 序号一致）。"
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];

  const toolKey =
    opts.target === "main"
      ? `${ECOM_MAIN_IMAGE_TOOL_KEY}__${ECOM_MAIN_IMAGE_ACTION}`
      : `${ECOM_DETAIL_PAGE_TOOL_KEY}__${ECOM_DETAIL_PAGE_ACTION}`;

  const raw = await drainEcomGwChat(opts.userId, {
    modelKey,
    messages: [
      {
        role: "system",
        content: referenceStyle ? REFERENCE_STYLE_VISION_SYSTEM : VISION_SYSTEM,
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

  const parsed = parseVisionJson(raw);
  const entry: ProductDesignVisualBriefEntry = {
    ...parsed,
    modelKey,
    analyzedAt: new Date().toISOString(),
    refFingerprint: fingerprint,
  };

  const nextDesign: ProductDesign = design
    ? {
        ...design,
        visualBrief: {
          ...(design.visualBrief ?? {}),
          [opts.target]: entry,
        },
      }
    : {
        ...emptyProductDesign(),
        visualBrief: {
          [opts.target]: entry,
        },
      };

  await updateProductDesignProject(opts.userId, opts.projectId, {
    design: nextDesign,
    settings: { visionModelKey: modelKey },
  });

  return { entry, design: nextDesign };
}

export function isVisualBriefStale(
  design: ProductDesign | null,
  target: ProductDesignVisionTarget,
  references: ProductDesignReference[],
): boolean {
  if (!design?.visualBrief) return true;
  const entry = target === "main" ? design.visualBrief.main : design.visualBrief.detail;
  if (!entry?.derivedPrompt) return true;
  const styleRole = target === "main" ? "main-style" : "detail-style";
  const fp = productDesignRefFingerprint(references, ["product", styleRole]);
  return entry.refFingerprint !== fp;
}
