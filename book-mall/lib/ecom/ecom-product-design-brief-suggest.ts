import { assertStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import type { CanvasChatContentPart } from "@/lib/canvas/providers/types";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  filterProductDesignReferencesByRole,
  type ProductDesignReference,
} from "@/lib/ecom/ecom-product-design-types";
import {
  getProductDesignProject,
  updateProductDesignProject,
} from "@/lib/ecom/ecom-product-design-service";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_DETAIL_PAGE_TOOL_KEY, ECOM_DETAIL_COPY_ACTION } from "@/lib/ecom/ecom-product-design-types";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { ecomGwChatStream } from "@/lib/gateway/ecom-tool-gateway-client";
import { getVisionMaxInputImages } from "@/lib/ecom/ecom-product-design-ref-rules";

export type BriefSuggestField =
  | "productName"
  | "targetUserGroup"
  | "mainPainPoint"
  | "productCoreAdvantage";

export type BriefSuggestions = Partial<Record<BriefSuggestField, string[]>>;

const BRIEF_SUGGEST_SYSTEM = `你是电商选品与文案策划专家。用户会提供产品实拍图（及可选的风格参考图）。
请根据图片推断商品信息，输出供商家点选的候选项。

必须只输出一个 JSON 对象（不要 markdown 围栏），字段：
{
  "productName": ["产品名候选1", "产品名候选2", "产品名候选3"],
  "targetUserGroup": ["人群描述1", "人群描述2", "人群描述3"],
  "mainPainPoint": ["核心痛点1", "核心痛点2", "核心痛点3"],
  "productCoreAdvantage": ["差异化优势1", "差异化优势2", "差异化优势3"]
}

要求：
- 每项 3 个候选，中文，每条 8～28 字，具体可感知，勿空泛
- 痛点与优势不得重复表述
- 若图片信息不足，结合常见品类做合理推断并标注通用性`;

async function drainEcomGwChat(
  userId: string,
  opts: {
    modelKey: string;
    messages: Array<{ role: "system" | "user" | "assistant"; content: string | CanvasChatContentPart[] }>;
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

function refsForBriefSuggest(
  references: ProductDesignReference[],
  modelKey: string,
): ProductDesignReference[] {
  const product = filterProductDesignReferencesByRole(references, ["product"]);
  const style = filterProductDesignReferencesByRole(references, ["main-style"]);
  const max = getVisionMaxInputImages(modelKey);
  return [...product, ...style].slice(0, max);
}

function parseBriefSuggestJson(text: string): BriefSuggestions {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("AI 未返回有效 JSON");
  }
  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  const fields: BriefSuggestField[] = [
    "productName",
    "targetUserGroup",
    "mainPainPoint",
    "productCoreAdvantage",
  ];
  const out: BriefSuggestions = {};
  for (const key of fields) {
    const raw = parsed[key];
    if (!Array.isArray(raw)) continue;
    const items = raw
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter((v) => v.length >= 2 && v.length <= 80)
      .slice(0, 5);
    if (items.length) out[key] = items;
  }
  if (Object.keys(out).length === 0) {
    throw new Error("AI 未生成有效候选项");
  }
  return out;
}

export async function suggestProductDesignBrief(opts: {
  userId: string;
  projectId: string;
  modelKey?: string;
}): Promise<{ suggestions: BriefSuggestions }> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const project = await getProductDesignProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  const productRefs = filterProductDesignReferencesByRole(project.references, ["product"]);
  if (!productRefs.length) {
    throw new Error("请先上传至少 1 张产品实拍图");
  }

  const modelKey =
    opts.modelKey?.trim() ||
    project.settings.visionModelKey?.trim() ||
    ECOM_DEFAULT_VISION_MODEL;
  assertStoryLlmVisionModel(modelKey, "产品信息推断");

  const refs = refsForBriefSuggest(project.references, modelKey);
  const imageUrls = refs.map((r) => r.ossUrl);
  const hasStyle = filterProductDesignReferencesByRole(project.references, ["main-style"]).length > 0;

  const promptText = [
    "请根据产品实拍图推断以下字段的候选项。",
    hasStyle
      ? "已附带主图风格参考，可结合风格推断目标人群与视觉方向。"
      : "用户未上传风格参考，请主要依据产品外观推断。",
  ].join("\n");

  const userParts: CanvasChatContentPart[] = [
    ...imageUrls.map(
      (url): CanvasChatContentPart => ({
        type: "image_url",
        image_url: { url },
      }),
    ),
    { type: "text", text: promptText },
  ];

  const raw = await drainEcomGwChat(opts.userId, {
    modelKey,
    messages: [
      { role: "system", content: BRIEF_SUGGEST_SYSTEM },
      {
        role: "user",
        content: imageUrls.length === 0 ? promptText : userParts,
      },
    ],
    clientPage: ecomClientPage(
      opts.userId,
      opts.projectId,
      `${ECOM_DETAIL_PAGE_TOOL_KEY}__${ECOM_DETAIL_COPY_ACTION}`,
    ),
  });

  const suggestions = parseBriefSuggestJson(raw);

  await updateProductDesignProject(opts.userId, opts.projectId, {
    meta: {
      briefSuggestions: suggestions,
      briefSuggestionsLoaded: true,
    },
    settings: { visionModelKey: modelKey },
  });

  return { suggestions };
}
