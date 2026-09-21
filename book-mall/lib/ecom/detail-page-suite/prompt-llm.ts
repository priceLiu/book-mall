import { z } from "zod";

import type { CanvasChatMessage } from "@/lib/canvas/providers/types";
import { drainEcomGwChat } from "@/lib/ecom/ecom-product-design-vision";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";

import { materializeModuleSlots, resolveModuleDisplaySlots } from "./module-slots";
import { upsertPromptSnapshotsFromSuite } from "./prompt-snapshot";
import { normalizeDetailPageSuiteState } from "./suite-persist";
import { assertSuiteCounts } from "./parse";
import {
  clearDetailPageSuitePromptModulePending,
  markDetailPageSuitePromptModulePending,
  reconcileDetailPageSuitePendingMeta,
} from "./pending-state";
import { getDetailPageSuiteProject, updateDetailPageSuiteProject } from "./project-service";
import {
  buildDetailPageSuiteBriefContextBlock,
  buildDetailPageSuiteGenderModelRule,
  composeDetailPageSuiteVisiblePrompt,
  detailPageSuiteModuleInvolvesModel,
  stripDetailPageSuitePromptEnvelope,
} from "./brief-context";
import { ensureBriefSizeChartDefaults } from "./size-chart-image";
import {
  buildModuleSlotForLabel,
  buildModuleSlotsForSelected,
  partitionSizeModuleSelected,
} from "./size-chart-prompt";
import { isDetailPageSuiteSizeChartDataLabel } from "./size-chart-constants";
import {
  BLANK_PLATE_MODULE_IDS,
  DETAIL_PAGE_SUITE_FENCE,
  DETAIL_PAGE_SUITE_SCHEMA_VERSION,
  ECOM_DETAIL_PAGE_SUITE_TOOL_KEY,
  type DetailPageSuiteBrief,
  type DetailPageSuiteSlot,
} from "./types";

const ItemSchema = z.object({
  item_key: z.string().optional(),
  item_label: z.string().min(1),
  positive_prompt: z.string().min(8),
});

const ModulePromptSchema = z.object({
  schemaVersion: z.string().optional(),
  module_id: z.string(),
  items: z.array(ItemSchema).min(1),
});

function extractFenceJson(text: string): unknown {
  const fence = new RegExp("```" + DETAIL_PAGE_SUITE_FENCE + "\\s*([\\s\\S]*?)```", "i");
  const m = text.match(fence);
  const raw = (m?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("大模型未返回有效 JSON");
  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

function buildSystemPrompt(opts: {
  moduleName: string;
  blankPlate: boolean;
  lang: string;
  genderModelRule?: string;
}): string {
  const langLine =
    opts.lang.includes("英") || opts.lang.toLowerCase().startsWith("en")
      ? "输出提示词使用英文。"
      : "输出提示词使用中文。";
  const blank = opts.blankPlate
    ? "本模块是留白底板：画面主体只能是纯色/渐变干净背景与预留空白区域；严禁出现服装、模特、产品实物、人物、拉链、面料等；七维与卖点仅用于影调色调一致，不得写入服装描写；画面内禁止任何文字、数字、表格、logo 字、水印。"
    : "本模块非留白底板。";
  const genderRule = opts.genderModelRule?.trim() ?? "";
  const genderBlock = genderRule ? `\n【模特性别】${genderRule.replace(/^\d+\.\s*/, "")}` : "";
  return `你的任务：根据传入参数生成电商服装生图正向提示词。
硬性规则：
1. 只允许使用【selected_item_list】里的项目，严禁自行创造列表以外的拍摄部位、姿势、场景。每一条对应列表中的一项。
2. 须严格遵从 user 消息中的【七维参数】与【商品卖点】，全片风格、档次、场景与性别品类一致；卖点可在光影/质感层面体现，不得发明列表外主体。${genderBlock}
3. 只做摄影层面润色：构图、光影、微距、景深、质感。不修改核心拍摄主体。
4. 每条须按该子维度区分景别/光位/构图，禁止多条复制粘贴只换主语。
5. 风格：电商商业摄影，写实照片，8K超清，影棚柔和布光，主体清晰对焦，简洁背景，无水印，画面内不出现任何文字。
6. 禁止 3D、插画、手绘、卡通、二次元。
7. ${blank}
8. ${langLine}
9. positive_prompt 只写摄影润色正文（构图、光影、质感等），不要输出【全片一致】【本张拍摄要求】等系统前缀，服务端会自动拼接。
10. 必须只输出一个围栏，围栏名为 ${DETAIL_PAGE_SUITE_FENCE}，内为 JSON 对象，不要解释。
JSON 形状：
{
  "schemaVersion": "${DETAIL_PAGE_SUITE_SCHEMA_VERSION}",
  "module_id": "当前模块 id",
  "items": [
    { "item_key": "短英文key", "item_label": "必须与选中子维度原文一致", "positive_prompt": "摄影润色正文" }
  ]
}`;
}

function buildPromptLlmUserMessage(opts: {
  brief: DetailPageSuiteBrief;
  lang: string;
  moduleId: string;
  moduleName: string;
  generateCount: number;
  selected: string[];
  rewriteNote?: string;
  currentPrompt?: string;
}): string {
  const briefBlock = buildDetailPageSuiteBriefContextBlock(opts.brief);
  const lines = [
    opts.rewriteNote,
    briefBlock ? `【七维参数与商品信息】\n${briefBlock}` : "",
    `当前模块：${opts.moduleId} ${opts.moduleName}`,
    `N：${opts.generateCount}`,
    `selected_item_list：${JSON.stringify(opts.selected)}`,
    opts.currentPrompt
      ? `当前提示词（仅作参考，请按同一主体重写，不要照抄）：${opts.currentPrompt}`
      : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export async function generateModulePrompts(opts: {
  userId: string;
  projectId: string;
  moduleId: string;
  modelKey?: string;
}): Promise<NonNullable<Awaited<ReturnType<typeof getDetailPageSuiteProject>>>> {
  const project = await getDetailPageSuiteProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  const countErr = assertSuiteCounts(project.suite);
  if (countErr) throw new Error(countErr);

  const mod = project.suite.modules.find((m) => m.module_id === opts.moduleId);
  if (!mod || !mod.enable || mod.generate_count < 1) {
    throw new Error("该模块未开启");
  }
  let selected = mod.selected_item_list.slice(0, mod.generate_count);
  if (selected.length < mod.generate_count) {
    const extra = mod.candidate_pool.filter((x) => !selected.includes(x));
    selected = [...selected, ...extra].slice(0, mod.generate_count);
  }
  if (selected.length !== mod.generate_count) {
    throw new Error(`${mod.module_name} 请先选满 ${mod.generate_count} 个子维度`);
  }

  let metaWithPending = markDetailPageSuitePromptModulePending(project.meta, mod.module_id);
  await updateDetailPageSuiteProject(opts.userId, opts.projectId, { meta: metaWithPending });

  let brief = ensureBriefSizeChartDefaults(project.brief ?? {});
  const { llm: llmLabels } = partitionSizeModuleSelected(selected);

  const finishWithSlots = async (slots: DetailPageSuiteSlot[]) => {
    const modules = project.suite.modules.map((m) =>
      m.module_id === mod.module_id
        ? {
            ...m,
            selected_item_list: selected,
            slots: materializeModuleSlots({ ...m, selected_item_list: selected, slots }),
          }
        : m,
    );
    const suite = normalizeDetailPageSuiteState({ ...project.suite, modules }, metaWithPending);
    metaWithPending =
      clearDetailPageSuitePromptModulePending(metaWithPending, mod.module_id) ?? { phase: "prompts" };
    const metaWithSnapshots = upsertPromptSnapshotsFromSuite(
      reconcileDetailPageSuitePendingMeta(suite, { ...metaWithPending, phase: "prompts" }),
      suite,
    );
    const updated = await updateDetailPageSuiteProject(opts.userId, opts.projectId, {
      suite,
      meta: metaWithSnapshots,
      brief,
    });
    if (!updated) throw new Error("保存失败");
    return updated;
  };

  if (llmLabels.length === 0) {
    const slots = buildModuleSlotsForSelected(mod, selected, brief, new Map());
    return finishWithSlots(slots);
  }

  const modelKey = opts.modelKey?.trim() || project.settings.chatModelKey || ECOM_DEFAULT_VISION_MODEL;
  const lang = brief.outputLanguage ?? "中文";
  const involvesModel = detailPageSuiteModuleInvolvesModel({
    moduleId: mod.module_id,
    moduleName: mod.module_name,
    selectedLabels: llmLabels,
  });
  const system = buildSystemPrompt({
    moduleName: mod.module_name,
    blankPlate: BLANK_PLATE_MODULE_IDS.has(mod.module_id),
    lang,
    genderModelRule: buildDetailPageSuiteGenderModelRule(brief.genderCategory, involvesModel),
  });
  const user = buildPromptLlmUserMessage({
    brief,
    lang,
    moduleId: mod.module_id,
    moduleName: mod.module_name,
    generateCount: llmLabels.length,
    selected: llmLabels,
  });

  let lastErr = "生成失败";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await drainEcomGwChat(opts.userId, {
        modelKey,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ] as CanvasChatMessage[],
        clientPage: ecomClientPage(opts.userId, opts.projectId, `${ECOM_DETAIL_PAGE_SUITE_TOOL_KEY}__chat`),
      });
      const parsed = ModulePromptSchema.parse(extractFenceJson(text));
      if (parsed.items.length !== llmLabels.length) {
        throw new Error(`返回条数 ${parsed.items.length} 不等于 ${llmLabels.length}`);
      }
      const llmMap = new Map<string, { item_key?: string; positive_prompt: string }>();
      llmLabels.forEach((label, i) => {
        const item = parsed.items[i]!;
        llmMap.set(label, {
          item_key: item.item_key,
          positive_prompt: item.positive_prompt,
        });
      });
      const slots = buildModuleSlotsForSelected(mod, selected, brief, llmMap);
      return finishWithSlots(slots);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  metaWithPending = clearDetailPageSuitePromptModulePending(metaWithPending, mod.module_id) ?? metaWithPending;
  await updateDetailPageSuiteProject(opts.userId, opts.projectId, {
    meta: reconcileDetailPageSuitePendingMeta(project.suite, metaWithPending),
  });
  throw new Error(lastErr);
}

export async function rewriteSlotPrompt(opts: {
  userId: string;
  projectId: string;
  moduleId: string;
  slotKey: string;
  modelKey?: string;
}): Promise<NonNullable<Awaited<ReturnType<typeof getDetailPageSuiteProject>>>> {
  const project = await getDetailPageSuiteProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  const mod = project.suite.modules.find((m) => m.module_id === opts.moduleId);
  if (!mod) throw new Error("模块不存在");
  const slot = resolveModuleDisplaySlots(mod).find((s) => s.item_key === opts.slotKey);
  if (!slot) throw new Error("该条提示词不存在");

  if (isDetailPageSuiteSizeChartDataLabel(slot.item_label)) {
    const brief = ensureBriefSizeChartDefaults(project.brief ?? {});
    const nextSlot = buildModuleSlotForLabel(mod, slot.item_label, 0, brief);
    const modules = project.suite.modules.map((m) =>
      m.module_id === mod.module_id
        ? {
            ...m,
            slots: materializeModuleSlots({
              ...m,
              slots: resolveModuleDisplaySlots(m).map((s) =>
                s.item_key === slot.item_key ? { ...s, ...nextSlot } : s,
              ),
            }),
          }
        : m,
    );
    const suite = normalizeDetailPageSuiteState({ ...project.suite, modules }, project.meta);
    const updated = await updateDetailPageSuiteProject(opts.userId, opts.projectId, {
      suite,
      brief,
      meta: upsertPromptSnapshotsFromSuite(project.meta, suite),
    });
    if (!updated) throw new Error("保存失败");
    return updated;
  }

  const modelKey = opts.modelKey?.trim() || project.settings.chatModelKey || ECOM_DEFAULT_VISION_MODEL;
  const brief = project.brief ?? {};
  const lang = brief.outputLanguage ?? "中文";
  const involvesModel = detailPageSuiteModuleInvolvesModel({
    moduleId: mod.module_id,
    moduleName: mod.module_name,
    selectedLabels: [slot.item_label],
  });
  const system = buildSystemPrompt({
    moduleName: mod.module_name,
    blankPlate: BLANK_PLATE_MODULE_IDS.has(mod.module_id),
    lang,
    genderModelRule: buildDetailPageSuiteGenderModelRule(brief.genderCategory, involvesModel),
  });
  const user = buildPromptLlmUserMessage({
    brief,
    lang,
    moduleId: mod.module_id,
    moduleName: mod.module_name,
    generateCount: 1,
    selected: [slot.item_label],
    rewriteNote: "只重写这一条子维度的提示词，禁止改拍摄主体。",
    currentPrompt: stripDetailPageSuitePromptEnvelope(slot.positive_prompt),
  });

  let lastErr = "重写失败";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await drainEcomGwChat(opts.userId, {
        modelKey,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ] as CanvasChatMessage[],
        clientPage: ecomClientPage(opts.userId, opts.projectId, `${ECOM_DETAIL_PAGE_SUITE_TOOL_KEY}__chat`),
      });
      const parsed = ModulePromptSchema.parse(extractFenceJson(text));
      const item = parsed.items[0];
      const llmBody = stripDetailPageSuitePromptEnvelope(item?.positive_prompt.trim() ?? "");
      if (!llmBody) throw new Error("未返回提示词");
      const modules = project.suite.modules.map((m) =>
        m.module_id === mod.module_id
          ? {
              ...m,
              slots: materializeModuleSlots({
                ...m,
                slots: resolveModuleDisplaySlots(m).map((s) =>
                  s.item_key === slot.item_key
                    ? {
                        ...s,
                        positive_prompt: composeDetailPageSuiteVisiblePrompt(
                          llmBody,
                          brief,
                          slot.item_label,
                          mod.module_id,
                        ),
                        promptEdited: false,
                      }
                    : s,
                ),
              }),
            }
          : m,
      );
      const suite = normalizeDetailPageSuiteState({ ...project.suite, modules }, project.meta);
      const updated = await updateDetailPageSuiteProject(opts.userId, opts.projectId, {
        suite,
        meta: upsertPromptSnapshotsFromSuite(project.meta, suite),
      });
      if (!updated) throw new Error("保存失败");
      return updated;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastErr);
}

export async function generateAllEnabledPrompts(opts: {
  userId: string;
  projectId: string;
  modelKey?: string;
}) {
  const project = await getDetailPageSuiteProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  let latest = project;
  for (const m of project.suite.modules.filter((x) => x.enable && x.generate_count > 0)) {
    latest = await generateModulePrompts({
      userId: opts.userId,
      projectId: opts.projectId,
      moduleId: m.module_id,
      modelKey: opts.modelKey,
    });
  }
  return latest;
}
