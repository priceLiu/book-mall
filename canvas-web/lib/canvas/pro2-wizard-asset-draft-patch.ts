import { useCanvasStore } from "@/lib/canvas/store";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import type { Pro2ProductionWizardAssetDraft } from "@/lib/canvas/pro2-production-wizard-assets";
import {
  wizardAssetDraftKey,
  type Pro2WizardAssetKind,
} from "@/lib/canvas/pro2-production-wizard-assets";
import { mountWizardAssetPreviewToHub } from "@/lib/canvas/pro2-wizard-asset-mount";

export function wizardAssetDraftsShallowEqual(
  a: Record<string, Pro2ProductionWizardAssetDraft>,
  b: Record<string, Pro2ProductionWizardAssetDraft>,
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    const da = a[key];
    const db = b[key];
    if (!db) return false;
    if (!draftFieldsEqual(da, db)) return false;
  }
  return true;
}

function draftFieldsEqual(
  a: Pro2ProductionWizardAssetDraft | undefined,
  b: Pro2ProductionWizardAssetDraft,
): boolean {
  if (!a) return false;
  return (
    a.prompt === b.prompt &&
    a.providerId === b.providerId &&
    a.modelKey === b.modelKey &&
    a.previewUrl === b.previewUrl &&
    a.generateStatus === b.generateStatus &&
    a.taskId === b.taskId &&
    a.failMessage === b.failMessage &&
    JSON.stringify(a.refImages ?? []) === JSON.stringify(b.refImages ?? []) &&
    JSON.stringify(a.params ?? {}) === JSON.stringify(b.params ?? {})
  );
}

/** 从 store 读最新 drafts 再 merge，避免并发后台任务用陈旧闭包覆盖其它资产卡状态。 */
export function patchProductionWizardAssetDraft(
  scriptHubId: string,
  kind: Pro2WizardAssetKind,
  assetId: string,
  patch: Partial<Pro2ProductionWizardAssetDraft>,
  opts?: { sessionOnly?: boolean },
): void {
  const key = wizardAssetDraftKey(kind, assetId);
  const { nodes, updateNodeData } = useCanvasStore.getState();
  const hub = nodes.find((n) => n.id === scriptHubId);
  if (!hub) return;

  const data = hub.data as StoryProScriptHubNodeData;
  const drafts = data.productionWizardAssetDrafts ?? {};
  const prev = drafts[key];
  const next: Pro2ProductionWizardAssetDraft = {
    kind,
    assetId,
    ...prev,
    ...patch,
  };
  if (draftFieldsEqual(prev, next)) return;

  updateNodeData(
    scriptHubId,
    {
      productionWizardAssetDrafts: {
        ...drafts,
        [key]: next,
      },
    },
    { sessionOnly: opts?.sessionOnly },
  );

  if (patch.previewUrl?.trim()) {
    mountWizardAssetPreviewToHub(
      scriptHubId,
      kind,
      assetId,
      patch.previewUrl.trim(),
      patch.taskId ?? next.taskId,
    );
  }
}

export function readProductionWizardAssetDraft(
  scriptHubId: string,
  kind: Pro2WizardAssetKind,
  assetId: string,
): Pro2ProductionWizardAssetDraft | undefined {
  const hub = useCanvasStore
    .getState()
    .nodes.find((n) => n.id === scriptHubId);
  if (!hub) return undefined;
  const data = hub.data as StoryProScriptHubNodeData;
  const key = wizardAssetDraftKey(kind, assetId);
  return data.productionWizardAssetDrafts?.[key];
}
