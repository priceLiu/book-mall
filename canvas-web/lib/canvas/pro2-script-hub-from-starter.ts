/**
 * 文本节点 → 剧本节点：promote 嵌入段 + production-script JSON 解析（与 Hub mount repair 一致）
 */
import { buildPro2ScriptHubNodeData } from "./pro2-spawn-nodes";
import {
  tryRepairHubFromStoredProductionJson,
  trySyncResolvedProductionScriptToHub,
} from "./pro2-production-script-apply";
import {
  hasPro2ProductionScriptFence,
  isUnparsedPro2ProductionJsonBlob,
} from "./pro2-production-script-structured";
import { promoteEmbeddedPackFromOutline } from "./story-hub-runtime";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";

export function buildPro2ScriptHubDataFromStarterOutline(
  outlineSource: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const src = outlineSource.trim();
  const promoted = promoteEmbeddedPackFromOutline(src, "", "", "");

  const outlineMdForSeed =
    src &&
    (hasPro2ProductionScriptFence(src) ||
      isUnparsedPro2ProductionJsonBlob(promoted.outlineMd))
      ? src
      : promoted.outlineMd.trim() || src;

  const seed = buildPro2ScriptHubNodeData({
    outlineMd: outlineMdForSeed,
    characterMd: promoted.characterMd,
    sceneMd: promoted.sceneMd,
    storyboardMd: promoted.storyboardMd,
    ...overrides,
  }) as StoryProScriptHubNodeData;

  const repair = tryRepairHubFromStoredProductionJson(seed);
  const merged: StoryProScriptHubNodeData = { ...seed, ...(repair ?? {}) };
  const sync = trySyncResolvedProductionScriptToHub(merged);
  return { ...merged, ...(sync ?? {}) };
}
