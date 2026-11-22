import { randomUUID } from "crypto";

import { assertStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import { formatEcomImageGenUserError } from "@/lib/ecom/ecom-image-processing-error";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { persistEcomGenerationRecord } from "@/lib/ecom/ecom-generation-record";
import { drainEcomGwChat } from "@/lib/ecom/ecom-product-design-vision";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";

import {
  ECOM_MAIN_IMAGE_HIT_REPLICA_ACTION,
  ECOM_MAIN_IMAGE_HIT_REPLICA_MODULE,
  ECOM_MAIN_IMAGE_HIT_REPLICA_TOOL_KEY,
  MAIN_IMAGE_HIT_REPLICA_CATEGORY_LABELS,
  hitReplicaAspectToEcomRatio,
  hitReplicaBuildImageGenSize,
  type MainImageHitReplicaResult,
} from "./types";
import {
  getMainImageHitReplicaProject,
  updateMainImageHitReplicaProject,
} from "./project-service";

function buildReplicaPromptSystem(degree: "style_reference" | "high_fidelity"): string {
  const mode =
    degree === "high_fidelity"
      ? "高度复刻：参考原图的版式结构、文案层级与构图节奏，替换为用户产品与原图无关的文案/主体。"
      : "参考风格：学习整体风格与结构，色彩与场景可自动调整并重构。";
  return `你是电商爆款主图复刻与生图 Prompt 专家。${mode}
只输出一个 JSON 对象（不要 markdown 围栏）：
{"prompt":"给生图模型的完整中文指令，含构图、光影、文案占位、商品锁定要求"}`;
}

function parsePromptJson(text: string): string {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("未返回有效 Prompt JSON");
  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as { prompt?: string };
  const prompt = typeof parsed.prompt === "string" ? parsed.prompt.trim() : "";
  if (!prompt) throw new Error("AI 未生成有效 Prompt");
  return prompt;
}

export async function replicateMainImageHitBatch(opts: {
  userId: string;
  projectId: string;
  modelKey?: string;
  visionModelKey?: string;
}): Promise<{
  project: NonNullable<Awaited<ReturnType<typeof getMainImageHitReplicaProject>>>;
  generated: number;
  failures: Array<{ resultId: string; message: string }>;
}> {
  await assertEcomToolkitGatewayAccess(opts.userId);
  let project = await getMainImageHitReplicaProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  const refImages = project.references.filter((r) => r.role === "reference");
  if (refImages.length === 0) throw new Error("请先上传至少 1 张参考图");

  const productUrls = project.references
    .filter((r) => r.role === "product")
    .map((r) => r.ossUrl);
  const modelKey =
    opts.modelKey?.trim() ||
    project.settings.imageModelKey?.trim() ||
    ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;
  const visionKey =
    opts.visionModelKey?.trim() ||
    project.settings.visionModelKey?.trim() ||
    ECOM_DEFAULT_VISION_MODEL;
  assertStoryLlmVisionModel(visionKey, "爆款图复刻");

  const toolKey = `${ECOM_MAIN_IMAGE_HIT_REPLICA_TOOL_KEY}__${ECOM_MAIN_IMAGE_HIT_REPLICA_ACTION}`;
  const categoryLabel = MAIN_IMAGE_HIT_REPLICA_CATEGORY_LABELS[project.settings.replicaCategory];
  const globalReq = project.settings.globalRequirements?.trim() ?? "";
  const keepStyleConsistent = project.settings.keepOutputStyleConsistent !== false;

  const pending: MainImageHitReplicaResult[] = refImages.map((ref, i) => ({
    id: randomUUID(),
    index: i + 1,
    sourceRefId: ref.id,
    prompt: "",
    status: "generating" as const,
  }));

  project =
    (await updateMainImageHitReplicaProject(opts.userId, opts.projectId, {
      status: "generating",
      meta: { phase: "generating", genStartedAt: new Date().toISOString() },
      output: { results: pending },
    })) ?? project;

  const failures: Array<{ resultId: string; message: string }> = [];
  let generated = 0;
  const results: MainImageHitReplicaResult[] = [];
  let styleAnchorImageUrl: string | undefined;

  for (let i = 0; i < refImages.length; i++) {
    const ref = refImages[i]!;
    const slot = pending[i]!;
    try {
      const perRefReq = ref.referenceRequirement?.trim();
      const userText = [
        `复刻类型：${categoryLabel}`,
        `复刻程度：${project.settings.replicaDegree === "high_fidelity" ? "高度复刻" : "参考风格"}`,
        globalReq ? `统一复刻要求：\n${globalReq}` : "",
        perRefReq ? `本张参考图专属要求：\n${perRefReq}` : "",
        productUrls.length > 0
          ? "用户已上传产品原图：生图须锁定用户产品的颜色/版型/材质，不得沿用参考图中的商品款式。"
          : "未上传产品原图：可复刻版式与氛围，主体品类与参考图一致。",
        keepStyleConsistent && refImages.length > 1
          ? "输出风格保持一致：本批次多张成片须统一色调、字体气质、装饰元素与光影基调，像同一店铺主图套组。"
          : "",
        keepStyleConsistent && styleAnchorImageUrl
          ? "风格锚点：须与本批次已生成的第 1 张成片保持同一套视觉风格（仅版式按当前参考图调整）。"
          : "",
        "输出语种/文案语气：" + project.settings.language,
      ]
        .filter(Boolean)
        .join("\n\n");

      const raw = await drainEcomGwChat(opts.userId, {
        modelKey: visionKey,
        messages: [
          {
            role: "system",
            content: buildReplicaPromptSystem(project.settings.replicaDegree),
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: ref.ossUrl } },
              ...(productUrls[0]
                ? [{ type: "image_url" as const, image_url: { url: productUrls[0]! } }]
                : []),
              ...(keepStyleConsistent && styleAnchorImageUrl
                ? [
                    {
                      type: "image_url" as const,
                      image_url: { url: styleAnchorImageUrl },
                    },
                  ]
                : []),
              { type: "text", text: userText },
            ],
          },
        ],
        clientPage: ecomClientPage(opts.userId, opts.projectId, toolKey),
      });

      const prompt = parsePromptJson(raw);
      const refUrls = [
        ...(productUrls.length > 0 ? productUrls : [ref.ossUrl]),
        ...(keepStyleConsistent && styleAnchorImageUrl ? [styleAnchorImageUrl] : []),
      ];
      const genRatio = hitReplicaAspectToEcomRatio(project.settings.imageRatio);
      const imageSize =
        project.settings.imageGenSize?.trim() ||
        hitReplicaBuildImageGenSize(
          project.settings.imageRatio,
          project.settings.outputResolution ?? "2K",
        );
      const imageUrl = await generateEcomImage({
        userId: opts.userId,
        modelKey,
        prompt,
        ratio: genRatio,
        imageSize,
        refImageUrls: refUrls.slice(0, 3),
        toolKey,
        workspaceId: opts.projectId,
      });

      const { assetId } = await persistEcomGenerationRecord({
        userId: opts.userId,
        ossUrl: imageUrl,
        prompt,
        title: `爆款复刻 #${slot.index}`,
        meta: {
          sourceModule: ECOM_MAIN_IMAGE_HIT_REPLICA_MODULE,
          sourceToolKey: toolKey,
          projectId: opts.projectId,
          sourceResultId: slot.id,
          versionKey: `${opts.projectId}::${slot.id}`,
          modelKey,
        },
      });

      generated += 1;
      if (keepStyleConsistent && !styleAnchorImageUrl) {
        styleAnchorImageUrl = imageUrl;
      }
      results.push({
        ...slot,
        prompt,
        imageUrl,
        assetId,
        status: "ready",
      });
    } catch (e) {
      const message = formatEcomImageGenUserError(e).message;
      failures.push({ resultId: slot.id, message });
      results.push({
        ...slot,
        status: "failed",
        failMessage: message,
      });
    }

    const tail = pending.slice(results.length).map((s) => ({
      ...s,
      status: "generating" as const,
    }));
    await updateMainImageHitReplicaProject(opts.userId, opts.projectId, {
      output: { results: [...results, ...tail] },
    });
  }

  const finalResults = results;
  const phase = finalResults.some((r) => r.imageUrl) ? "done" : "setup";
  project =
    (await updateMainImageHitReplicaProject(opts.userId, opts.projectId, {
      status: "draft",
      meta: { phase, genStartedAt: null },
      output: { results: finalResults },
    })) ?? project;

  return { project, generated, failures };
}