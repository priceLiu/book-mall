import { generateAllEnabledPrompts } from "@/lib/ecom/detail-page-suite/prompt-llm";
import { assertSuiteCounts } from "@/lib/ecom/detail-page-suite/parse";
import { ensureBriefSizeChartDefaults } from "@/lib/ecom/detail-page-suite/size-chart-image";
import { ensureBriefSpecChartDefaults } from "@/lib/ecom/detail-page-suite/spec-table-image";
import {
  getDetailPageSuiteAplusProject,
  updateDetailPageSuiteAplusProject,
} from "@/lib/ecom/detail-page-suite/project-service";
import { normalizeDetailPageSuiteState } from "@/lib/ecom/detail-page-suite/suite-persist";

import { applyAutoMatchToSuite } from "./aplus-subdim-match";
import { materializeAplusModuleSlots } from "./aplus-plan-materialize";

/** 自动子维度 + 点位 + 全部模块 Prompt（不出图） */
export async function planAndPromptsAiDetailPage(opts: {
  userId: string;
  projectId: string;
  modelKey?: string;
}) {
  const project = await getDetailPageSuiteAplusProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  if (!project.references.some((r) => r.ossUrl?.trim())) {
    throw new Error("请先上传至少一张产品参考图");
  }

  let brief = ensureBriefSizeChartDefaults(project.brief ?? {});
  brief = ensureBriefSpecChartDefaults(brief);

  const matchedSuite = applyAutoMatchToSuite(project.suite, brief);
  const countErr = assertSuiteCounts(matchedSuite);
  if (countErr) throw new Error(countErr);

  const modules = matchedSuite.modules.map((m) => materializeAplusModuleSlots(m));
  const suite = normalizeDetailPageSuiteState(
    { ...matchedSuite, modules },
    { ...(project.meta ?? {}), phase: "prompts" },
  );

  const afterPlan = await updateDetailPageSuiteAplusProject(opts.userId, opts.projectId, {
    suite,
    brief,
    meta: { ...(project.meta ?? {}), phase: "prompts" },
  });
  if (!afterPlan) throw new Error("保存失败");

  return generateAllEnabledPrompts({
    userId: opts.userId,
    projectId: opts.projectId,
    modelKey: opts.modelKey,
    projectModule: "ai-detail-page",
  });
}
