import type { CanvasChatMessage } from "@/lib/canvas/providers/types";
import { drainEcomGwChat } from "@/lib/ecom/ecom-product-design-vision";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { z } from "zod";

import { OUTDOOR_JACKET_MODULES } from "@/lib/ecom/detail-page-suite/category-seeds";
import type { DetailPageSuiteBrief, DetailPageSuiteProject } from "@/lib/ecom/detail-page-suite/types";
import {
  DETAIL_PAGE_SUITE_NEGATIVE_PROMPT,
  DETAIL_PAGE_SUITE_REPLICA_POLISH_BATCH_FENCE,
  DETAIL_PAGE_SUITE_REPLICA_POLISH_BATCH_SCHEMA_VERSION,
  ECOM_DETAIL_PAGE_SUITE_REPLICA_TOOL_KEY,
} from "@/lib/ecom/detail-page-suite/types";
import {
  runDetailPageVisionDecompose,
  sliceDecomposeModuleForSlotBudget,
} from "@/lib/ecom/detail-page-vision-decompose";

import {
  extractFenceJson,
  normalizeReplicaPhaseBBatch,
  type ReplicaPhaseA,
  type ReplicaPhaseBModule,
} from "./replica-schemas";

function isGatewayOrTransportError(e: unknown): boolean {
  if (e instanceof z.ZodError) return false;
  const msg = e instanceof Error ? e.message : String(e);
  if (
    /未返回有效 JSON|校验失败|顺序|module_id|schemaVersion|不支持|围栏|润色返回|润色模块/.test(msg)
  ) {
    return false;
  }
  return true;
}

const GLOBAL_PRESET = `全局正向基础：商业服装摄影，淘宝移动端详情页竖图，8K 高清，写实照片，自然光，锐度高，色彩真实，无水印，无文字，无 logo。
全局负向基础：3D 渲染，卡通，插画，手绘，变形，肢体畸形，水印，文字，字幕，模糊，低分辨率。`;

function buildPhaseBBatchSystem(): string {
  return `你是电商服装生图提示词专家。用户会给出视觉拆解结果与商品卖点，请在一次回复中为 **多个模块** 写可出图的 positive_prompt 与 negative_prompt（简体中文为主）。
${GLOBAL_PRESET}
规则：
1. 风格/版式、构图、光影、姿态须充分继承拆解 JSON 中 layoutHint 与 visualDetail 全字段（粒度参考 docs/ecom/羽绒服拆解.md 正向 Prompt）；商品外观须与用户产品实拍一致。
2. referenceCopyHints / onImageText 仅作版式与语义槽；可售表述用用户卖点改写，禁止照抄参考品牌/SKU 原文；出图仍禁止画面内文字（写在 negative_prompt）。
3. 画面内禁止文字、logo、水印（写在 negative_prompt）。
4. 系统全局负向还会拼接：${DETAIL_PAGE_SUITE_NEGATIVE_PROMPT}
5. 每个 module 的 items 须与拆解 JSON 中对应 item_key 一一对应（条数不超过该模块拆解首批条数）；无拆解条目的模块输出 items: []。
6. mod7_size_table：若拆解含尺码区，须含 item_label「尺码数据总表图」，positive_prompt 固定为 [detail-page-suite:size-chart-render]。
7. 每条 positive_prompt 建议 120～400 字（banner/场景图偏长，微距特写可略短），避免 JSON 截断。
8. 必须只输出围栏 \`\`\`${DETAIL_PAGE_SUITE_REPLICA_POLISH_BATCH_FENCE}\`\`\` JSON：
{
  "schemaVersion": "${DETAIL_PAGE_SUITE_REPLICA_POLISH_BATCH_SCHEMA_VERSION}",
  "modules": [
    { "module_id": "...", "items": [{ "item_key", "item_label", "positive_prompt", "negative_prompt" }] }
  ]
}
modules 长度与顺序必须与用户消息中「本次模块列表」完全一致。`;
}

function sellpointsBlock(brief: DetailPageSuiteBrief | null): string {
  const lines = brief?.sellPoints?.map((s) => s.text.trim()).filter(Boolean) ?? [];
  if (lines.length === 0) return "（用户尚未填写卖点，请从产品图与拆解 hint 合理推导，勿编造认证）";
  return lines.map((t, i) => `${i + 1}. ${t}`).join("\n");
}

function referenceSuiteUrls(project: DetailPageSuiteProject): string[] {
  return project.references
    .filter((r) => r.role === "reference_suite")
    .map((r) => r.ossUrl)
    .filter(Boolean);
}

function moduleDisplayName(moduleId: string): string {
  return OUTDOOR_JACKET_MODULES.find((m) => m.module_id === moduleId)?.module_name ?? moduleId;
}

function buildPhaseBBatchUserText(opts: {
  phaseA: ReplicaPhaseA;
  moduleIds: string[];
  brief: DetailPageSuiteBrief | null;
}): string {
  const moduleList = opts.moduleIds
    .map((id, i) => `${i + 1}. ${id} ${moduleDisplayName(id)}`)
    .join("\n");

  const blocks = opts.moduleIds.map((moduleId) => {
    const aMod = opts.phaseA.modules.find((m) => m.module_id === moduleId);
    if (!aMod) {
      return `=== module: ${moduleId} ===\n（无拆解数据）\nitems 输出 []`;
    }
    const fullCount = aMod.items.length;
    const { module: sliced, truncated } = sliceDecomposeModuleForSlotBudget(aMod);
    const note =
      truncated > 0
        ? `（拆解共 ${fullCount} 条，本批润色 ${sliced.items.length} 条）`
        : "";
    const mod7Hint =
      moduleId === "mod7_size_table"
        ? "\n若需尺码数据总表图，输出 item_label「尺码数据总表图」，positive_prompt [detail-page-suite:size-chart-render]"
        : "";
    return `=== module: ${moduleId} · ${moduleDisplayName(moduleId)} ${note} ===
${JSON.stringify(sliced)}${mod7Hint}`;
  });

  return [
    "【本次模块列表】（输出 modules 须与此顺序、id 完全一致）",
    moduleList,
    "",
    `referenceSummary：${opts.phaseA.referenceSummary ?? ""}`,
    `sharedVisualBrief：${opts.phaseA.sharedVisualBrief ?? ""}`,
    `【商品简述】${opts.brief?.productDesc?.trim() || "（未填）"}`,
    `【商品卖点】\n${sellpointsBlock(opts.brief)}`,
    "",
    ...blocks,
  ].join("\n");
}

/** Phase A：仅参考长图，逻辑在可复用包 detail-page-vision-decompose */
export async function runReplicaPhaseA(opts: {
  userId: string;
  project: DetailPageSuiteProject;
  modelKey?: string;
}): Promise<ReplicaPhaseA> {
  return runDetailPageVisionDecompose({
    userId: opts.userId,
    referenceImageUrls: referenceSuiteUrls(opts.project),
    visionModelKey: opts.modelKey ?? opts.project.settings.visionModelKey,
    workspaceId: opts.project.id,
    clientPageAction: `${ECOM_DETAIL_PAGE_SUITE_REPLICA_TOOL_KEY}__decompose`,
    productDesc: opts.project.brief?.productDesc,
  });
}

/** Phase B：单次 LLM，输出所选全部模块（含全选 12 模块） */
export async function runReplicaPhaseBBatch(opts: {
  userId: string;
  projectId: string;
  phaseA: ReplicaPhaseA;
  moduleIds: string[];
  modelKey?: string;
  brief: DetailPageSuiteBrief | null;
}): Promise<Map<string, ReplicaPhaseBModule>> {
  if (opts.moduleIds.length === 0) {
    throw new Error("请至少选择一个模块");
  }

  const modelKey = opts.modelKey?.trim() || ECOM_DEFAULT_VISION_MODEL;
  const userText = buildPhaseBBatchUserText({
    phaseA: opts.phaseA,
    moduleIds: opts.moduleIds,
    brief: opts.brief,
  });

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await drainEcomGwChat(opts.userId, {
        modelKey,
        messages: [
          { role: "system", content: buildPhaseBBatchSystem() },
          { role: "user", content: userText },
        ] as CanvasChatMessage[],
        clientPage: ecomClientPage(
          opts.userId,
          opts.projectId,
          `${ECOM_DETAIL_PAGE_SUITE_REPLICA_TOOL_KEY}__polish_batch`,
        ),
      });
      const json = extractFenceJson(text, DETAIL_PAGE_SUITE_REPLICA_POLISH_BATCH_FENCE);
      const batch = normalizeReplicaPhaseBBatch(json, opts.moduleIds);
      const map = new Map<string, ReplicaPhaseBModule>();
      for (const mod of batch.modules) {
        map.set(mod.module_id, {
          schemaVersion: mod.schemaVersion,
          module_id: mod.module_id,
          items: mod.items,
        });
      }
      return map;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (!isGatewayOrTransportError(e)) {
        throw lastErr;
      }
    }
  }
  throw lastErr ?? new Error("批量润色失败");
}
