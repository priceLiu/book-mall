/**
 * Pro2 剧本 Hub · 生产向导 v2 判定（见 docs/剧本可视化功能.md）
 * 入口在脚本 Hub 顶栏，非独立项目模板。
 */
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";

/** Hub 是否走新两步向导（有结构化制作包分镜表，或已 hydrate 标记） */
export function isPro2ProductionWizardHub(
  hubData: StoryProScriptHubNodeData | null | undefined,
): boolean {
  if (!hubData) return false;
  if (hubData.productionWizardMode === true) return true;
  return Boolean(hubData.productionScript?.shots?.length);
}

export function shouldHydratePro2ProductionScaffold(
  hubData: StoryProScriptHubNodeData | null | undefined,
): boolean {
  return isPro2ProductionWizardHub(hubData);
}
