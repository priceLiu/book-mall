import type { CanvasChatContentPart, CanvasChatMessage } from "@/lib/canvas/providers/types";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { parseIpMasterInputMode } from "@/lib/ecom/ecom-ip-master-input-presets";
import {
  getEcomIpMasterProject,
  updateEcomIpMasterProject,
  type EcomIpMasterProjectDto,
} from "@/lib/ecom/ecom-ip-master-service";
import { buildIpMasterTemplateGenerateSystemPrompt } from "@/lib/ecom/ecom-ip-master-template-prompt";
import {
  extractJsonObjectFromLlmText,
  formatIpMasterDraftParseError,
  ipMasterImagePromptSchema,
  ipMasterTemplateSchema,
  normalizeIpMasterLlmDraft,
  type IpMasterImagePrompt,
  type IpMasterRegenerateTarget,
  type IpMasterTemplate,
} from "@/lib/ecom/ecom-ip-master-template-schema";
import { ipMasterTemplateToMarkdown } from "@/lib/ecom/ecom-ip-master-template-render";
import { ECOM_IP_MASTER_TOOL_KEY } from "@/lib/ecom/ecom-ip-master-types";
import { assertStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import { getVisionMaxInputImages } from "@/lib/ecom/ecom-product-design-ref-rules";
import { ECOM_STORYBOARD_DEFAULT_CHAT_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { ecomGwChatComplete } from "@/lib/gateway/ecom-tool-gateway-client";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { z } from "zod";

const llmDraftSchema = z.object({
  imagePrompt: ipMasterImagePromptSchema,
  structuredTemplate: ipMasterTemplateSchema,
});

export type IpMasterDraftPayload = {
  imagePrompt: IpMasterImagePrompt;
  template: IpMasterTemplate;
};

function guessIpNameFromBrief(briefText: string): string | undefined {
  const m = briefText.match(/IP名称[：:]\s*([^\n\r，,]+)/);
  return m?.[1]?.trim();
}

function validateDraftInput(opts: {
  inputMode: ReturnType<typeof parseIpMasterInputMode>;
  briefText: string;
  hasBenchmark: boolean;
}): void {
  if (opts.inputMode === "1" && !opts.hasBenchmark) {
    throw new Error("模式 1 须先上传基准图");
  }
  if (opts.inputMode === "2" && !opts.briefText) {
    throw new Error("模式 2 须填写大白话描述");
  }
  if (opts.inputMode === "3" && !opts.briefText) {
    throw new Error("模式 3 须填写大白话描述");
  }
  if (opts.inputMode === "4" && !opts.briefText) {
    throw new Error("模式 4 须填写大白话描述");
  }
}

export async function generateIpMasterStructuredTemplate(opts: {
  userId: string;
  projectId: string;
  modelKey?: string;
  regenerateTarget?: IpMasterRegenerateTarget;
  draftTemplate?: Record<string, unknown> | null;
  draftImagePrompt?: IpMasterImagePrompt | null;
}): Promise<{ project: EcomIpMasterProjectDto; template: IpMasterTemplate; imagePrompt: IpMasterImagePrompt }> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const project = await getEcomIpMasterProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  const inputMode = parseIpMasterInputMode(
    (project.brief as { inputMode?: unknown } | null)?.inputMode,
  );
  const briefText =
    typeof project.brief?.description === "string" ? project.brief.description.trim() : "";

  validateDraftInput({
    inputMode,
    briefText,
    hasBenchmark: project.references.length > 0,
  });

  const regenerateTarget = opts.regenerateTarget ?? "both";
  const prevTemplate =
    opts.draftTemplate ??
    (project.meta?.workflow?.draftTemplate as Record<string, unknown> | undefined) ??
    null;
  const prevPrompt =
    opts.draftImagePrompt ??
    (project.meta?.workflow?.draftImagePrompt as IpMasterImagePrompt | undefined) ??
    null;

  const hasBenchmark = project.references.length > 0;
  let modelKey =
    opts.modelKey?.trim() ||
    project.settings.chatModelKey?.trim() ||
    ECOM_STORYBOARD_DEFAULT_CHAT_MODEL;

  const baseImageUrl = project.references[0]?.ossUrl ?? "";
  const willAttachImages = inputMode !== "2" && hasBenchmark;

  if (willAttachImages) {
    assertStoryLlmVisionModel(
      modelKey,
      "结构化模板生成（含基准图识图）",
    );
  } else if (inputMode === "4" && !hasBenchmark) {
    modelKey = modelKey || ECOM_STORYBOARD_DEFAULT_CHAT_MODEL;
  }
  const systemPrompt = buildIpMasterTemplateGenerateSystemPrompt({
    inputMode,
    regenerateTarget,
  });

  const draftBlock =
    prevTemplate || prevPrompt
      ? [
          "",
          "【当前用户已编辑草稿 — 请在此基础上修改，勿整篇推翻】",
          prevPrompt ? `imagePrompt:\n${JSON.stringify(prevPrompt)}` : "",
          prevTemplate ? `structuredTemplate:\n${JSON.stringify(prevTemplate)}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  const userText = [
    `输入模式：${inputMode}`,
    `本次生成范围：${regenerateTarget}`,
    briefText
      ? `用户大白话描述：\n${briefText}`
      : "用户未填文字描述。",
    baseImageUrl
      ? "已提供基准图（见消息内图片）。须识图填入柔性 6 项中的色彩/服装/五官等，勿写「基准图未能识别」。"
      : "当前尚无基准图（用户可能稍后按 imagePrompt 生图）。柔性特征仅据 Brief 推断；勿在每项重复「基准图未能识别」，缺口写入 pendingItems。",
    draftBlock,
    "",
    "请输出符合 schema 的单个 JSON 对象。",
  ].join("\n");

  const max = getVisionMaxInputImages(modelKey);
  const imageUrls =
    inputMode === "2" ? [] : project.references.slice(0, max).map((r) => r.ossUrl);

  let userContent: string | CanvasChatContentPart[];
  if (imageUrls.length > 0) {
    userContent = [
      ...imageUrls.map(
        (url): CanvasChatContentPart => ({ type: "image_url", image_url: { url } }),
      ),
      { type: "text", text: userText },
    ];
  } else {
    userContent = userText;
  }

  const messages: CanvasChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  const { text } = await ecomGwChatComplete(opts.userId, {
    modelKey,
    messages,
    clientPage: ecomClientPage(
      opts.userId,
      project.id,
      `${ECOM_IP_MASTER_TOOL_KEY}__template-generate`,
    ),
  });

  const raw = extractJsonObjectFromLlmText(text);
  const normalized = normalizeIpMasterLlmDraft(raw, {
    projectId: project.id,
    defaultIpName:
      guessIpNameFromBrief(briefText) ??
      project.title?.trim() ??
      undefined,
  });
  const parsed = llmDraftSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new Error(formatIpMasterDraftParseError(parsed.error));
  }

  let imagePrompt = parsed.data.imagePrompt;
  let structured = parsed.data.structuredTemplate;

  if (regenerateTarget === "imagePrompt" && prevTemplate) {
    const kept = ipMasterTemplateSchema.safeParse(prevTemplate);
    if (kept.success) structured = kept.data;
  }
  if (regenerateTarget === "structured" && prevPrompt) {
    imagePrompt = ipMasterImagePromptSchema.parse(prevPrompt);
  }

  let template: IpMasterTemplate = {
    ...structured,
    schemaVersion: 1,
    ipMeta: {
      ...structured.ipMeta,
      ipId: project.id,
      baseImageUrl: baseImageUrl || structured.ipMeta.baseImageUrl || "",
      version: structured.ipMeta.version || "V0.1",
      createTime: structured.ipMeta.createTime || new Date().toISOString().slice(0, 10),
    },
    imagePrompt,
  };

  const markdown = ipMasterTemplateToMarkdown(template);

  const updated = await updateEcomIpMasterProject(opts.userId, opts.projectId, {
    meta: {
      ...(project.meta ?? {}),
      workflow: {
        ...(project.meta?.workflow ?? {}),
        currentStepId: "review",
        draftTemplate: { ...template, imagePrompt: undefined } as unknown as Record<
          string,
          unknown
        >,
        draftImagePrompt: imagePrompt,
        draftMarkdown: markdown,
        inputCommitted: true,
      },
    },
    settings: { ...project.settings, chatModelKey: modelKey },
  });

  return { project: updated, template, imagePrompt };
}
