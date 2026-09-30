import type { CanvasChatContentPart, CanvasChatMessage } from "@/lib/canvas/providers/types";
import { formatEcomSellpointFivePartDocument } from "@/lib/ecom/ecom-sellpoint-five-part";
import { extractSellpointsFromProductImages } from "@/lib/ecom/detail-page-suite/vision-sellpoint-extract";
import { drainEcomGwChat } from "@/lib/ecom/ecom-product-design-vision";
import {
  ECOM_PRODUCT_IMAGE_SET_BRIEF_ACTION,
  ECOM_PRODUCT_IMAGE_SET_TOOL_KEY,
} from "@/lib/ecom/product-image-set/types";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import type { EcomStylePresetVertical } from "@/lib/ecom/ecom-style-preset";

import {
  getProductImageSetProject,
  updateProductImageSetProject,
} from "./project-service";

const VERTICAL_PROMPT = `根据产品图判断品类垂直，只输出 JSON：{"vertical":"fashion_apparel"|"bags"|"digital_3c"|"generic"}`;

async function inferVerticalFromImages(opts: {
  userId: string;
  projectId: string;
  urls: string[];
  modelKey: string;
}): Promise<EcomStylePresetVertical> {
  if (opts.urls.length === 0) return "generic";
  try {
    const parts: CanvasChatContentPart[] = [
      ...opts.urls.slice(0, 3).map((url) => ({
        type: "image_url" as const,
        image_url: { url },
      })),
      { type: "text" as const, text: VERTICAL_PROMPT },
    ];
    const text = await drainEcomGwChat(opts.userId, {
      modelKey: opts.modelKey,
      messages: [
        { role: "system", content: "你是电商品类识别助手。" },
        { role: "user", content: parts },
      ] as CanvasChatMessage[],
      clientPage: ecomClientPage(
        opts.userId,
        opts.projectId,
        `${ECOM_PRODUCT_IMAGE_SET_TOOL_KEY}__${ECOM_PRODUCT_IMAGE_SET_BRIEF_ACTION}`,
      ),
    });
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(text.slice(start, end + 1)) as { vertical?: string };
      const v = parsed.vertical;
      if (
        v === "fashion_apparel" ||
        v === "bags" ||
        v === "digital_3c" ||
        v === "generic"
      ) {
        return v;
      }
    }
  } catch {
    /* fallback */
  }
  return "generic";
}

export async function suggestProductImageSetBrief(opts: {
  userId: string;
  projectId: string;
  modelKey?: string;
}): Promise<{ project: Awaited<ReturnType<typeof getProductImageSetProject>>; document: string }> {
  const project = await getProductImageSetProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  const urls = project.references.map((r) => r.ossUrl).filter(Boolean);
  const visionKey =
    opts.modelKey?.trim() ||
    project.settings.visionModelKey?.trim() ||
    ECOM_DEFAULT_VISION_MODEL;

  const extracted = await extractSellpointsFromProductImages({
    userId: opts.userId,
    projectId: opts.projectId,
    toolKey: ECOM_PRODUCT_IMAGE_SET_TOOL_KEY,
    clientPageSuffix: `${ECOM_PRODUCT_IMAGE_SET_TOOL_KEY}__${ECOM_PRODUCT_IMAGE_SET_BRIEF_ACTION}`,
    productUrls: urls,
    modelKey: visionKey,
    settingsVisionModelKey: project.settings.visionModelKey,
  });

  const vertical = await inferVerticalFromImages({
    userId: opts.userId,
    projectId: opts.projectId,
    urls,
    modelKey: visionKey,
  });

  const updated = await updateProductImageSetProject(opts.userId, opts.projectId, {
    meta: {
      sellpointDocument: extracted.document,
      inferredVertical: vertical,
    },
    settings: {
      visionModelKey: visionKey,
    },
  });

  return { project: updated, document: extracted.document || formatEcomSellpointFivePartDocument(extracted.sellpointFivePart) };
}
