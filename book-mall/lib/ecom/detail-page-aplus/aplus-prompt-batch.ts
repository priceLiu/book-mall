import { z } from "zod";

import type { CanvasChatMessage } from "@/lib/canvas/providers/types";
import { drainEcomGwChat } from "@/lib/ecom/ecom-product-design-vision";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";

import {
  buildDetailPageSuiteBlankPlateBody,
  buildDetailPageSuiteBriefContextBlock,
} from "@/lib/ecom/detail-page-suite/brief-context";
import { materializeModuleSlots, resolveModuleDisplaySlots } from "@/lib/ecom/detail-page-suite/module-slots";
import { assertSuiteCounts } from "@/lib/ecom/detail-page-suite/parse";
import {
  buildModuleSlotsForSelected,
  partitionSizeModuleSelected,
} from "@/lib/ecom/detail-page-suite/size-chart-prompt";
import { isDetailPageSuiteSizeChartModuleId } from "@/lib/ecom/detail-page-suite/size-chart-constants";
import {
  buildSpecModuleSlotsForSelected,
  partitionSpecModuleSelected,
} from "@/lib/ecom/detail-page-suite/spec-table-prompt";
import { isDetailPageSuiteSpecChartModuleId } from "@/lib/ecom/detail-page-suite/spec-table-constants";
import {
  clearDetailPageSuitePromptModulePending,
  markDetailPageSuitePromptModulePending,
  reconcileDetailPageSuitePendingMeta,
} from "@/lib/ecom/detail-page-suite/pending-state";
import { loadDetailPageSuiteForOps } from "@/lib/ecom/detail-page-suite/project-access";
import { upsertPromptSnapshotsFromSuite } from "@/lib/ecom/detail-page-suite/prompt-snapshot";
import { normalizeDetailPageSuiteState } from "@/lib/ecom/detail-page-suite/suite-persist";
import { ensureBriefSizeChartDefaults } from "@/lib/ecom/detail-page-suite/size-chart-image";
import { ensureBriefSpecChartDefaults } from "@/lib/ecom/detail-page-suite/spec-table-image";
import {
  DETAIL_PAGE_SUITE_FENCE,
  type DetailPageSuiteBrief,
  type DetailPageSuiteModuleState,
  type DetailPageSuiteProject,
  type DetailPageSuiteSlot,
  type DetailPageSuiteState,
} from "@/lib/ecom/detail-page-suite/types";

import { materializeAplusModuleSlots } from "./aplus-plan-materialize";
import {
  buildAplusBatchPromptPlannerSystem,
  buildAplusModuleCatalogContextForLlm,
} from "./aplus-prompt-planner-compose";
import { isAplusBlankPlateModule } from "./aplus-prompt-system";
import { applyAutoMatchToSuite } from "./aplus-subdim-match";

const ItemSchema = z.object({
  item_key: z.string().optional(),
  item_label: z.string().min(1),
  positive_prompt: z.string().min(8),
});

const BatchModuleSchema = z.object({
  module_id: z.string(),
  items: z.array(ItemSchema).min(1),
});

const BatchPromptSchema = z.object({
  schemaVersion: z.string().optional(),
  modules: z.array(BatchModuleSchema).min(1),
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

function fillSelectedForModule(mod: DetailPageSuiteModuleState): string[] {
  let selected = mod.selected_item_list.slice(0, mod.generate_count);
  if (selected.length < mod.generate_count) {
    const extra = mod.candidate_pool.filter((x) => !selected.includes(x));
    selected = [...selected, ...extra].slice(0, mod.generate_count);
  }
  return selected;
}

function buildSlotsForModule(
  mod: DetailPageSuiteModuleState,
  selected: string[],
  brief: DetailPageSuiteBrief,
  llmMap: Map<string, { item_key?: string; positive_prompt: string }>,
): DetailPageSuiteSlot[] {
  if (isDetailPageSuiteSpecChartModuleId(mod.module_id)) {
    return buildSpecModuleSlotsForSelected(mod, selected, brief, llmMap);
  }
  return buildModuleSlotsForSelected(mod, selected, brief, llmMap);
}

function applyModuleSlots(
  suite: DetailPageSuiteState,
  mod: DetailPageSuiteModuleState,
  selected: string[],
  slots: DetailPageSuiteSlot[],
): DetailPageSuiteState {
  const modules = suite.modules.map((m) =>
    m.module_id === mod.module_id
      ? {
          ...m,
          selected_item_list: selected,
          slots: materializeModuleSlots({ ...m, selected_item_list: selected, slots }),
        }
      : m,
  );
  return { ...suite, modules };
}

type LlmTask = {
  moduleId: string;
  moduleName: string;
  selected: string[];
  llmToGenerate: string[];
};

function collectLlmTasks(mod: DetailPageSuiteModuleState): {
  selected: string[];
  llmToGenerate: string[];
  skipLlm: boolean;
} {
  const selected = fillSelectedForModule(mod);
  if (selected.length !== mod.generate_count) {
    throw new Error(`${mod.module_name} 请先选满 ${mod.generate_count} 个子维度`);
  }
  if (isAplusBlankPlateModule(mod.module_id)) {
    return { selected, llmToGenerate: [], skipLlm: true };
  }
  const partitioned = isDetailPageSuiteSpecChartModuleId(mod.module_id)
    ? partitionSpecModuleSelected(selected)
    : isDetailPageSuiteSizeChartModuleId(mod.module_id)
      ? partitionSizeModuleSelected(selected)
      : { programmatic: [], llm: selected };
  const displaySlots = resolveModuleDisplaySlots(mod);
  const llmToGenerate = partitioned.llm.filter((label) => {
    const prev = displaySlots.find((s) => s.item_label.trim() === label.trim());
    return !(prev?.promptEdited && prev.positive_prompt?.trim());
  });
  return { selected, llmToGenerate, skipLlm: false };
}

/**
 * A+ 详情：按用户已开启模块 **一次 LLM 调用** 批量写 Prompt（留白/程序化模块不走模型）
 */
export async function generateAplusModulePromptsBatch(opts: {
  userId: string;
  projectId: string;
  modelKey?: string;
  projectModule?: string;
  /** 仅生成指定模块（中栏单模块按钮）；省略则全部已开启模块 */
  moduleIds?: string[];
  /** 生成前已 materialize 的项目（来自 generateAllEnabledPrompts） */
  project?: DetailPageSuiteProject;
}): Promise<DetailPageSuiteProject> {
  const access = await loadDetailPageSuiteForOps(
    opts.userId,
    opts.projectId,
    opts.projectModule ?? "ai-detail-page",
  );
  if (!access) throw new Error("项目不存在");

  let project = opts.project ?? access.project;
  const updateDetailPageSuiteProject = access.update;
  const promptToolKey = access.toolKey;

  if (!opts.project) {
    const countErr = assertSuiteCounts(project.suite);
    if (countErr) throw new Error(countErr);
    let brief = ensureBriefSizeChartDefaults(project.brief ?? {});
    brief = ensureBriefSpecChartDefaults(brief);
    const matched = applyAutoMatchToSuite(project.suite, brief);
    const modules = matched.modules.map((m) => materializeAplusModuleSlots(m));
    project = {
      ...project,
      suite: normalizeDetailPageSuiteState(
        { ...matched, modules },
        project.meta ?? undefined,
      ),
      brief,
    };
  }

  const idFilter = opts.moduleIds?.length
    ? new Set(opts.moduleIds.map((id) => id.trim()).filter(Boolean))
    : null;

  const enabledMods = project.suite.modules.filter(
    (m) =>
      m.enable &&
      m.generate_count > 0 &&
      (!idFilter || idFilter.has(m.module_id)),
  );
  if (enabledMods.length === 0) {
    throw new Error(idFilter ? "该模块未开启" : "没有已开启的模块");
  }

  let brief = ensureBriefSizeChartDefaults(project.brief ?? {});
  brief = ensureBriefSpecChartDefaults(brief);
  let suite = project.suite;
  const llmTasks: LlmTask[] = [];

  for (const mod of enabledMods) {
    const { selected, llmToGenerate, skipLlm } = collectLlmTasks(mod);

    if (skipLlm && selected.length > 0) {
      const syntheticLlmMap = new Map(
        selected.map((label) => [
          label,
          { positive_prompt: buildDetailPageSuiteBlankPlateBody(label) },
        ]),
      );
      const slots = buildSlotsForModule(mod, selected, brief, syntheticLlmMap);
      suite = applyModuleSlots(suite, mod, selected, slots);
      continue;
    }

    if (llmToGenerate.length === 0) {
      const slots = buildSlotsForModule(mod, selected, brief, new Map());
      suite = applyModuleSlots(suite, mod, selected, slots);
      continue;
    }

    llmTasks.push({
      moduleId: mod.module_id,
      moduleName: mod.module_name,
      selected,
      llmToGenerate,
    });
  }

  let meta = project.meta ?? null;
  if (llmTasks.length === 0) {
    const metaWithSnapshots = upsertPromptSnapshotsFromSuite(
      reconcileDetailPageSuitePendingMeta(suite, {
        ...(meta ?? {}),
        phase: "prompts",
      }),
      suite,
    );
    const updated = await updateDetailPageSuiteProject(opts.userId, opts.projectId, {
      suite,
      meta: metaWithSnapshots,
      brief,
    });
    if (!updated) throw new Error("保存失败");
    return updated;
  }

  for (const t of llmTasks) {
    meta = markDetailPageSuitePromptModulePending(meta, t.moduleId);
  }
  await updateDetailPageSuiteProject(opts.userId, opts.projectId, { meta: meta ?? {} });

  const lang = brief.outputLanguage ?? "中文";
  const system = buildAplusBatchPromptPlannerSystem({
    settings: project.settings,
    lang,
  });
  const briefBlock = buildDetailPageSuiteBriefContextBlock(brief);
  const batchPayload = llmTasks.map((t) => ({
    module_id: t.moduleId,
    module_name: t.moduleName,
    N: t.llmToGenerate.length,
    selected_item_list: t.llmToGenerate,
  }));
  const user = [
    buildAplusModuleCatalogContextForLlm(),
    briefBlock ? `【七维参数与商品信息】\n${briefBlock}` : "",
    "【本次需一次生成的模块列表】",
    "严格遵守每个模块的 selected_item_list，不得增删子维度主题。",
    JSON.stringify({ modules: batchPayload }, null, 2),
  ]
    .filter(Boolean)
    .join("\n\n");

  const modelKey = opts.modelKey?.trim() || project.settings.chatModelKey || ECOM_DEFAULT_VISION_MODEL;

  let lastErr = "批量生成提示词失败";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await drainEcomGwChat(opts.userId, {
        modelKey,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ] as CanvasChatMessage[],
        clientPage: ecomClientPage(
          opts.userId,
          opts.projectId,
          `${promptToolKey}__prompt-batch`,
        ),
      });
      const parsed = BatchPromptSchema.parse(extractFenceJson(text));
      const byModuleId = new Map(parsed.modules.map((m) => [m.module_id, m]));

      for (const task of llmTasks) {
        const block = byModuleId.get(task.moduleId);
        if (!block) {
          throw new Error(`返回缺少模块 ${task.moduleId}`);
        }
        if (block.items.length !== task.llmToGenerate.length) {
          throw new Error(
            `${task.moduleName} 返回条数 ${block.items.length} 不等于 ${task.llmToGenerate.length}`,
          );
        }
        const llmMap = new Map<string, { item_key?: string; positive_prompt: string }>();
        task.llmToGenerate.forEach((label, i) => {
          const item = block.items[i]!;
          if (item.item_label.trim() !== label.trim()) {
            throw new Error(
              `${task.moduleName} 第 ${i + 1} 条 item_label 与 selected_item_list 不一致`,
            );
          }
          llmMap.set(label, {
            item_key: item.item_key,
            positive_prompt: item.positive_prompt,
          });
        });
        const mod = suite.modules.find((m) => m.module_id === task.moduleId);
        if (!mod) throw new Error(`模块 ${task.moduleId} 不存在`);
        const slots = buildSlotsForModule(mod, task.selected, brief, llmMap);
        suite = applyModuleSlots(suite, mod, task.selected, slots);
        meta = clearDetailPageSuitePromptModulePending(meta, task.moduleId) ?? meta;
      }

      for (const extra of parsed.modules) {
        if (llmTasks.some((t) => t.moduleId === extra.module_id)) continue;
        throw new Error(`返回了未请求的模块 ${extra.module_id}`);
      }

      const metaWithSnapshots = upsertPromptSnapshotsFromSuite(
        reconcileDetailPageSuitePendingMeta(suite, {
          ...(meta ?? {}),
          phase: "prompts",
        }),
        suite,
      );
      const updated = await updateDetailPageSuiteProject(opts.userId, opts.projectId, {
        suite,
        meta: metaWithSnapshots,
        brief,
      });
      if (!updated) throw new Error("保存失败");
      return updated;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }

  for (const t of llmTasks) {
    meta = clearDetailPageSuitePromptModulePending(meta, t.moduleId) ?? meta;
  }
  await updateDetailPageSuiteProject(opts.userId, opts.projectId, {
    meta: reconcileDetailPageSuitePendingMeta(suite, meta),
  });
  throw new Error(lastErr);
}