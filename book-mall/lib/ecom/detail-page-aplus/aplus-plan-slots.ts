import { assertSuiteCounts } from "@/lib/ecom/detail-page-suite/parse";
import { ensureBriefSizeChartDefaults } from "@/lib/ecom/detail-page-suite/size-chart-image";
import { ensureBriefSpecChartDefaults } from "@/lib/ecom/detail-page-suite/spec-table-image";
import {
  getDetailPageSuiteAplusProject,
  updateDetailPageSuiteAplusProject,
} from "@/lib/ecom/detail-page-suite/project-service";
import { normalizeDetailPageSuiteState } from "@/lib/ecom/detail-page-suite/suite-persist";

import { materializeAplusModuleSlots } from "./aplus-plan-materialize";
import { applyAutoMatchToSuite } from "./aplus-subdim-match";

/** 生成点位：占位 slot，Prompt 留空，供后续 LLM 填写 */
export async function planAiDetailPageSlots(opts: {
  userId: string;
  projectId: string;
}) {
  const project = await getDetailPageSuiteAplusProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
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
  const updated = await updateDetailPageSuiteAplusProject(opts.userId, opts.projectId, {
    suite,
    brief,
    meta: { ...(project.meta ?? {}), phase: "prompts" },
  });
  if (!updated) throw new Error("保存失败");
  return updated;
}
