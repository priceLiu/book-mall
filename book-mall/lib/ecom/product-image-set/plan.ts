import { ensureStylePresetCache } from "@/lib/ecom/ecom-style-preset";
import { extractSellpointsFromProductImages } from "@/lib/ecom/detail-page-suite/vision-sellpoint-extract";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";

import { llmFillProductImageSetPrompts } from "./plan-llm";
import { buildProductImageSetSlots } from "./slot-plan";
import type { ProductImageSetSlot } from "./types";
import {
  ECOM_PRODUCT_IMAGE_SET_PLAN_ACTION,
  ECOM_PRODUCT_IMAGE_SET_TOOL_KEY,
} from "./types";
import {
  getProductImageSetProject,
  updateProductImageSetProject,
} from "./project-service";

function mergePlannedSlots(
  existing: ProductImageSetSlot[],
  fresh: ProductImageSetSlot[],
  opts?: { overwritePrompts?: boolean },
): ProductImageSetSlot[] {
  const prevById = new Map(existing.map((s) => [s.id, s]));
  return fresh.map((f) => {
    const prev = prevById.get(f.id);
    if (!prev) return f;
    if (prev.imageUrl?.trim()) {
      const keepPrompt = prev.promptEdited && !opts?.overwritePrompts;
      return {
        ...f,
        prompt: keepPrompt ? prev.prompt : f.prompt,
        promptEdited: keepPrompt ? prev.promptEdited : undefined,
        imageUrl: prev.imageUrl,
        assetId: prev.assetId,
        status: "ready" as const,
        failMessage: undefined,
      };
    }
    const keepPrompt = prev.promptEdited && !opts?.overwritePrompts;
    const prompt = keepPrompt ? prev.prompt : f.prompt;
    return {
      ...f,
      prompt,
      title: f.title?.trim() ? f.title : prev.title,
      promptEdited: keepPrompt ? prev.promptEdited : undefined,
      status: prev.status === "failed" ? ("failed" as const) : ("pending" as const),
      failMessage: prev.status === "failed" ? prev.failMessage : undefined,
    };
  });
}

async function ensureSellpointDocumentForPlan(opts: {
  userId: string;
  projectId: string;
  visionModelKey?: string;
}): Promise<NonNullable<Awaited<ReturnType<typeof getProductImageSetProject>>>> {
  let project = await getProductImageSetProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  if (project.meta.sellpointDocument?.trim()) return project;

  const urls = project.references.map((r) => r.ossUrl).filter(Boolean);
  const visionKey =
    opts.visionModelKey?.trim() ||
    project.settings.visionModelKey?.trim() ||
    ECOM_DEFAULT_VISION_MODEL;

  try {
    const extracted = await extractSellpointsFromProductImages({
      userId: opts.userId,
      projectId: opts.projectId,
      toolKey: ECOM_PRODUCT_IMAGE_SET_TOOL_KEY,
      clientPageSuffix: `${ECOM_PRODUCT_IMAGE_SET_TOOL_KEY}__${ECOM_PRODUCT_IMAGE_SET_PLAN_ACTION}`,
      productUrls: urls,
      modelKey: visionKey,
      settingsVisionModelKey: project.settings.visionModelKey,
    });

    project =
      (await updateProductImageSetProject(opts.userId, opts.projectId, {
        meta: { sellpointDocument: extracted.document },
        settings: { visionModelKey: visionKey },
      })) ?? project;
  } catch (e) {
    console.warn("[product-image-set] sellpoint extract before plan failed", e);
  }
  return project;
}

export async function planProductImageSet(opts: {
  userId: string;
  projectId: string;
  visionModelKey?: string;
}): Promise<NonNullable<Awaited<ReturnType<typeof getProductImageSetProject>>>> {
  let project = await ensureSellpointDocumentForPlan(opts);
  if (!project) throw new Error("项目不存在");
  if (project.references.length === 0) throw new Error("请先上传商品原图");

  await ensureStylePresetCache();
  const skeleton = buildProductImageSetSlots(project);
  if (skeleton.length === 0) throw new Error("请配置至少 1 张套图结构");

  const planStartedAt = new Date().toISOString();
  await updateProductImageSetProject(opts.userId, opts.projectId, {
    status: "planning",
    meta: { phase: "planning", planStartedAt },
  });

  let fresh: ProductImageSetSlot[] = skeleton;
  let planPromptSource: "llm" | "fallback" = "fallback";
  let planPromptError: string | undefined;
  try {
    fresh = await llmFillProductImageSetPrompts({
      userId: opts.userId,
      projectId: opts.projectId,
      project,
      skeleton,
      modelKey: opts.visionModelKey,
    });
    planPromptSource = "llm";
  } catch (e) {
    planPromptError = e instanceof Error ? e.message : String(e);
    console.error("[product-image-set] LLM plan prompts failed, using rule fallback", e);
  }

  const slots = mergePlannedSlots(project.output.slots, fresh, {
    overwritePrompts: planPromptSource === "llm",
  });

  const updated =
    (await updateProductImageSetProject(opts.userId, opts.projectId, {
      output: { slots, listingCopy: project.output.listingCopy },
      meta: {
        phase: "planned",
        planPromptSource,
        planPromptError: planPromptSource === "llm" ? null : planPromptError ?? null,
        planStartedAt: null,
      },
      status: "draft",
    })) ?? project;

  return updated;
}
