/**
 * 向导 Step1 · 出图完成后挂到 Hub rows（及已 spawn 的画布节点）
 */
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import { findStarterByHubId } from "@/lib/canvas/story-workspace-resolver";
import {
  syncPro2CharacterColumnAndThreeViewDocksFromHub,
} from "@/lib/canvas/pro2-spawn-character-image-group";
import {
  pro2SceneImageControllerId,
  syncPro2SceneImagesFromRows,
} from "@/lib/canvas/pro2-spawn-scene-image-group";
import type { Pro2WizardAssetKind } from "@/lib/canvas/pro2-production-wizard-assets";
import {
  parseWizardAssetDraftKey,
} from "@/lib/canvas/pro2-production-wizard-assets";
import {
  applyCharacterRowRuntime,
  applySceneRowRuntime,
} from "@/lib/canvas/story-row-patch";
import {
  sceneRowKeysEquivalent,
  storyProSceneRowKey,
} from "@/lib/canvas/story-pro-scene-asset-catalog";
import { syncStoryProColumnRows } from "@/lib/canvas/story-pro-column-sync";
import type {
  StoryProCharacterRow,
  StoryProPropRow,
  StoryProSceneRow,
  StoryProScriptHubNodeData,
  StoryProStarterNodeData,
} from "@/lib/canvas/story-pro-workspace-types";
import type { StoryPro2WorkspaceIds } from "@/lib/canvas/story-pro2-workspace-types";
import { useCanvasStore } from "@/lib/canvas/store";
import type { CanvasNodeRuntime } from "@/lib/canvas/types";

function runtimeFromPreviewUrl(
  previewUrl: string,
  taskId?: string,
): CanvasNodeRuntime {
  const url = previewUrl.trim();
  return {
    status: "done",
    taskId: taskId?.trim() || undefined,
    ossUrl: url,
    failCode: undefined,
    failMessage: undefined,
  };
}

function resolveWorkspaceIds(
  scriptHubId: string,
): StoryPro2WorkspaceIds | undefined {
  const nodes = useCanvasStore.getState().nodes;
  const starter = findStarterByHubId(nodes, scriptHubId);
  if (starter) {
    return (starter.data as StoryProStarterNodeData).workspaceIds;
  }
  const hub = nodes.find((n) => n.id === scriptHubId);
  return (hub?.data as { workspaceIds?: StoryPro2WorkspaceIds }).workspaceIds;
}

function ensureHubAssetRows(
  hubData: StoryProScriptHubNodeData,
  scriptHubId: string,
): {
  characterRows: StoryProCharacterRow[];
  sceneRows: StoryProSceneRow[];
  propRows: StoryProPropRow[];
} {
  const synced = syncStoryProColumnRows(
    hubData,
    {
      characterRows: hubData.scriptStudioCharacterRows,
      sceneRows: hubData.sceneRows,
      frameRows: hubData.scriptStudioFrameRows,
    },
    scriptHubId,
  );
  const propRows =
    hubData.scriptStudioPropRows?.length
      ? hubData.scriptStudioPropRows
      : (hubData.productionScript?.props ?? []).map((p) => ({
          key: p.id,
          name: p.name,
          description: p.description ?? "",
          prompt: p.imagePrompt ?? "",
        }));
  return {
    characterRows: synced.characterRows,
    sceneRows: synced.sceneRows,
    propRows,
  };
}

function resolveSceneRowKey(
  sceneRows: StoryProSceneRow[],
  script: Pro2ProductionScript | undefined,
  scriptHubId: string,
  sceneId: string,
): string | null {
  const scene = script?.scenes?.find((s) => s.id === sceneId);
  if (!scene) return null;
  const expected = storyProSceneRowKey(scriptHubId, scene.name);
  const hit = sceneRows.find(
    (r) => sceneRowKeysEquivalent(r.key, expected) || r.name === scene.name,
  );
  return hit?.key ?? expected;
}

function applyPropRowRuntime(
  rows: StoryProPropRow[],
  rowKey: string,
  runtime: CanvasNodeRuntime,
): StoryProPropRow[] {
  return rows.map((r) =>
    r.key === rowKey ? { ...r, runtime: { ...r.runtime, ...runtime } } : r,
  );
}

/** 计算 Hub patch（不写 store） */
export function buildWizardAssetMountHubPatch(
  hubData: StoryProScriptHubNodeData,
  scriptHubId: string,
  kind: Pro2WizardAssetKind,
  assetId: string,
  previewUrl: string,
  taskId?: string,
): Partial<StoryProScriptHubNodeData> | null {
  const url = previewUrl.trim();
  if (!url) return null;

  const runtime = runtimeFromPreviewUrl(url, taskId);
  const { characterRows, sceneRows, propRows } = ensureHubAssetRows(
    hubData,
    scriptHubId,
  );
  const script = hubData.productionScript;

  if (kind === "character") {
    if (!characterRows.some((r) => r.key === assetId)) return null;
    return {
      scriptStudioCharacterRows: applyCharacterRowRuntime(
        characterRows,
        assetId,
        runtime,
      ),
    };
  }

  if (kind === "scene") {
    const rowKey = resolveSceneRowKey(sceneRows, script, scriptHubId, assetId);
    if (!rowKey) return null;
    return {
      sceneRows: applySceneRowRuntime(sceneRows, rowKey, runtime),
    };
  }

  if (!propRows.some((r) => r.key === assetId)) return null;
  return {
    scriptStudioPropRows: applyPropRowRuntime(propRows, assetId, runtime),
  };
}

function rowPreviewUrl(
  runtime?: CanvasNodeRuntime | null,
): string | undefined {
  return runtime?.ossUrl?.trim() || runtime?.ephemeralUrl?.trim() || undefined;
}

/** draft 的 preview 是否已写入 Hub 对应资产行 */
export function isWizardAssetPreviewMounted(
  hubData: StoryProScriptHubNodeData,
  scriptHubId: string,
  kind: Pro2WizardAssetKind,
  assetId: string,
  previewUrl: string,
): boolean {
  const url = previewUrl.trim();
  if (!url) return false;

  const { characterRows, sceneRows, propRows } = ensureHubAssetRows(
    hubData,
    scriptHubId,
  );

  if (kind === "character") {
    const row = characterRows.find((r) => r.key === assetId);
    return rowPreviewUrl(row?.runtime) === url;
  }

  if (kind === "scene") {
    const rowKey = resolveSceneRowKey(
      sceneRows,
      hubData.productionScript,
      scriptHubId,
      assetId,
    );
    if (!rowKey) return false;
    const row = sceneRows.find((r) => sceneRowKeysEquivalent(r.key, rowKey));
    return rowPreviewUrl(row?.runtime) === url;
  }

  const row = propRows.find((r) => r.key === assetId);
  return rowPreviewUrl(row?.runtime) === url;
}

/** 补挂：向导 draft 里已有 previewUrl、但 Hub rows 尚未写入的历史出图 */
export function remountAllWizardAssetDraftsToHub(scriptHubId: string): number {
  const state = useCanvasStore.getState();
  const hub = state.nodes.find((n) => n.id === scriptHubId);
  if (!hub || hub.type !== "story-pro2-script-hub") return 0;

  let hubData = hub.data as StoryProScriptHubNodeData;
  let mounted = 0;

  for (const [key, draft] of Object.entries(
    hubData.productionWizardAssetDrafts ?? {},
  )) {
    const url = draft.previewUrl?.trim();
    if (!url || draft.generateStatus === "running") continue;
    const parsed = parseWizardAssetDraftKey(key);
    if (!parsed) continue;
    const { kind, assetId } = parsed;
    if (
      isWizardAssetPreviewMounted(hubData, scriptHubId, kind, assetId, url)
    ) {
      continue;
    }
    mountWizardAssetPreviewToHub(scriptHubId, kind, assetId, url, draft.taskId);
    mounted += 1;
    const nextHub = useCanvasStore.getState().nodes.find((n) => n.id === scriptHubId);
    if (nextHub) hubData = nextHub.data as StoryProScriptHubNodeData;
  }

  return mounted;
}

function syncMountedCanvasNodes(
  scriptHubId: string,
  kind: Pro2WizardAssetKind,
  assetId: string,
  hubData: StoryProScriptHubNodeData,
): void {
  const { nodes, updateNodeData } = useCanvasStore.getState();
  const ws = resolveWorkspaceIds(scriptHubId);

  if (kind === "character") {
    syncPro2CharacterColumnAndThreeViewDocksFromHub(
      nodes,
      scriptHubId,
      updateNodeData,
      hubData,
    );
    return;
  }

  if (kind === "scene") {
    const sceneRows = hubData.sceneRows ?? [];
    if (!sceneRows.length) return;
    syncPro2SceneImagesFromRows(
      nodes,
      pro2SceneImageControllerId(scriptHubId),
      sceneRows,
      updateNodeData,
    );
    return;
  }

  if (ws?.propColumnId) {
    const propCol = nodes.find((n) => n.id === ws.propColumnId);
    if (propCol) {
      updateNodeData(ws.propColumnId, {
        rows: hubData.scriptStudioPropRows ?? [],
        hubNodeId: scriptHubId,
      });
    }
  }

  const row = hubData.scriptStudioPropRows?.find((r) => r.key === assetId);
  if (!row?.runtime) return;
  for (const n of nodes) {
    if (n.type !== "story-pro2-prop") continue;
    const d = n.data as { scriptStudioSourceRowKey?: string };
    if (d.scriptStudioSourceRowKey !== assetId) continue;
    updateNodeData(n.id, {
      runtime: row.runtime,
      label: row.name?.trim() || "道具",
      dockInput: row.prompt?.trim() || row.description?.trim() || "",
      pro2RowKey: row.key,
    });
  }
}

/** 向导出图完成 · 挂 preview 到 Hub rows，并刷新已挂载画布节点 */
export function mountWizardAssetPreviewToHub(
  scriptHubId: string,
  kind: Pro2WizardAssetKind,
  assetId: string,
  previewUrl: string,
  taskId?: string,
): void {
  const { nodes, updateNodeData } = useCanvasStore.getState();
  const hub = nodes.find((n) => n.id === scriptHubId);
  if (!hub || hub.type !== "story-pro2-script-hub") return;

  const hubData = hub.data as StoryProScriptHubNodeData;
  const mountPatch = buildWizardAssetMountHubPatch(
    hubData,
    scriptHubId,
    kind,
    assetId,
    previewUrl,
    taskId,
  );
  if (!mountPatch) return;

  updateNodeData(scriptHubId, mountPatch);

  const mergedHub: StoryProScriptHubNodeData = {
    ...hubData,
    ...mountPatch,
  };
  syncMountedCanvasNodes(scriptHubId, kind, assetId, mergedHub);
}
