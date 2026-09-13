import { randomUUID } from "crypto";

import type { CanvasChatContentPart, CanvasChatMessage } from "@/lib/canvas/providers/types";
import { assertStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import { getVisionMaxInputImages } from "@/lib/ecom/ecom-product-design-ref-rules";
import { drainEcomGwChat } from "@/lib/ecom/ecom-product-design-vision";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";

import { getDetailPageSuiteProject, updateDetailPageSuiteProject } from "./project-service";
import { ECOM_DETAIL_PAGE_SUITE_TOOL_KEY, type DetailPageSuiteSellpoint } from "./types";

const SYSTEM = `你是服装电商卖点提炼专家。用户会提供多张产品实拍图。
根据图片中的版型、面料、辅料、工艺、场景气质，提炼 4～8 条可直接用于详情页的卖点短句。
必须只输出 JSON 对象（不要 markdown）：
{ "sell_points": ["卖点1", "卖点2"] }
禁止编造图中看不到的材质成分或认证。`;

export async function visionSellpointsFromProductImages(opts: {
  userId: string;
  projectId: string;
  modelKey?: string;
}): Promise<NonNullable<Awaited<ReturnType<typeof getDetailPageSuiteProject>>>> {
  const project = await getDetailPageSuiteProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  if (project.references.length === 0) throw new Error("请先上传至少 1 张产品图");

  const modelKey = opts.modelKey?.trim() || project.settings.visionModelKey || ECOM_DEFAULT_VISION_MODEL;
  assertStoryLlmVisionModel(modelKey);
  const max = getVisionMaxInputImages(modelKey);
  const urls = project.references.map((r) => r.ossUrl).filter(Boolean).slice(0, max);

  const parts: CanvasChatContentPart[] = [
    ...urls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
    {
      type: "text" as const,
      text: `商品简述：${project.brief?.productDesc ?? "见产品图"}。请提炼卖点。`,
    },
  ];

  const text = await drainEcomGwChat(opts.userId, {
    modelKey,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: parts },
    ] as CanvasChatMessage[],
    clientPage: ecomClientPage(
      opts.userId,
      opts.projectId,
      `${ECOM_DETAIL_PAGE_SUITE_TOOL_KEY}__vision`,
    ),
  });
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("识图未返回有效 JSON");
  const parsed = JSON.parse(text.slice(start, end + 1)) as { sell_points?: unknown };
  const lines = Array.isArray(parsed.sell_points)
    ? parsed.sell_points.map((x) => String(x).trim()).filter(Boolean)
    : [];
  if (lines.length === 0) throw new Error("未能从图中识别出卖点");
  const sellPoints: DetailPageSuiteSellpoint[] = lines.map((textLine) => ({
    id: randomUUID(),
    text: textLine,
    source: "vision",
  }));
  const updated = await updateDetailPageSuiteProject(opts.userId, opts.projectId, {
    brief: { ...(project.brief ?? {}), sellPoints, sellpointsLocked: false },
    meta: { ...(project.meta ?? {}), phase: "sellpoints" },
  });
  if (!updated) throw new Error("保存失败");
  return updated;
}

const POLISH_SYSTEM = `你是服装电商卖点润色编辑。只润色用户已给出的卖点短句：更顺口、更适合详情页，禁止发明新卖点、材质成分或认证。
必须只输出 JSON 对象（不要 markdown）：
{ "sell_points": ["卖点1", "卖点2"] }
条数必须与输入一致，顺序对应。`;

export async function polishDetailPageSuiteSellpoints(opts: {
  userId: string;
  projectId: string;
  modelKey?: string;
}): Promise<NonNullable<Awaited<ReturnType<typeof getDetailPageSuiteProject>>>> {
  const project = await getDetailPageSuiteProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  const current = project.brief?.sellPoints ?? [];
  if (current.length === 0) throw new Error("请先手填或识图卖点再润色");

  const modelKey = opts.modelKey?.trim() || project.settings.chatModelKey || ECOM_DEFAULT_VISION_MODEL;
  const text = await drainEcomGwChat(opts.userId, {
    modelKey,
    messages: [
      { role: "system", content: POLISH_SYSTEM },
      {
        role: "user",
        content: `请润色这些卖点：\n${JSON.stringify(current.map((s) => s.text))}`,
      },
    ] as CanvasChatMessage[],
    clientPage: ecomClientPage(
      opts.userId,
      opts.projectId,
      `${ECOM_DETAIL_PAGE_SUITE_TOOL_KEY}__chat`,
    ),
  });
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("润色未返回有效 JSON");
  const parsed = JSON.parse(text.slice(start, end + 1)) as { sell_points?: unknown };
  const lines = Array.isArray(parsed.sell_points)
    ? parsed.sell_points.map((x) => String(x).trim()).filter(Boolean)
    : [];
  if (lines.length === 0) throw new Error("润色结果为空");
  const sellPoints: DetailPageSuiteSellpoint[] = current.map((s, i) => ({
    ...s,
    text: lines[i] ?? s.text,
    source: "ai",
  }));
  const updated = await updateDetailPageSuiteProject(opts.userId, opts.projectId, {
    brief: { ...(project.brief ?? {}), sellPoints, sellpointsLocked: false },
    meta: { ...(project.meta ?? {}), phase: "sellpoints" },
  });
  if (!updated) throw new Error("保存失败");
  return updated;
}
