import { useCanvasStore } from "@/lib/canvas/store";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import {
  wizardShotDraftKey,
  type Pro2ProductionWizardShotDraft,
  type Pro2WizardShotMediaKind,
} from "@/lib/canvas/pro2-production-wizard-shot-drafts";
import { mountWizardShotPreviewToHub } from "@/lib/canvas/pro2-wizard-shot-mount";

function draftFieldsEqual(
  a: Pro2ProductionWizardShotDraft | undefined,
  b: Pro2ProductionWizardShotDraft,
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
    a.framePreviewUrl === b.framePreviewUrl &&
    JSON.stringify(a.refImages ?? []) === JSON.stringify(b.refImages ?? []) &&
    JSON.stringify(a.params ?? {}) === JSON.stringify(b.params ?? {})
  );
}

export function wizardShotDraftsShallowEqual(
  a: Record<string, Pro2ProductionWizardShotDraft>,
  b: Record<string, Pro2ProductionWizardShotDraft>,
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

export function patchProductionWizardShotDraft(
  scriptHubId: string,
  mediaKind: Pro2WizardShotMediaKind,
  shotIndex: number,
  patch: Partial<Pro2ProductionWizardShotDraft>,
  opts?: { sessionOnly?: boolean },
): void {
  const key = wizardShotDraftKey(mediaKind, shotIndex);
  const { nodes, updateNodeData } = useCanvasStore.getState();
  const hub = nodes.find((n) => n.id === scriptHubId);
  if (!hub) return;

  const data = hub.data as StoryProScriptHubNodeData;
  const drafts = data.productionWizardShotDrafts ?? {};
  const prev = drafts[key];
  const next: Pro2ProductionWizardShotDraft = {
    ...prev,
    mediaKind,
    shotIndex,
    ...patch,
  };
  if (draftFieldsEqual(prev, next)) return;

  updateNodeData(
    scriptHubId,
    {
      productionWizardShotDrafts: {
        ...drafts,
        [key]: next,
      },
    },
    { sessionOnly: opts?.sessionOnly },
  );

  if (patch.previewUrl?.trim()) {
    mountWizardShotPreviewToHub(
      scriptHubId,
      mediaKind,
      shotIndex,
      patch.previewUrl.trim(),
      patch.taskId ?? next.taskId,
    );
  }
}

export function readProductionWizardShotDraft(
  scriptHubId: string,
  mediaKind: Pro2WizardShotMediaKind,
  shotIndex: number,
): Pro2ProductionWizardShotDraft | undefined {
  const hub = useCanvasStore
    .getState()
    .nodes.find((n) => n.id === scriptHubId);
  if (!hub) return undefined;
  const data = hub.data as StoryProScriptHubNodeData;
  const key = wizardShotDraftKey(mediaKind, shotIndex);
  return data.productionWizardShotDrafts?.[key];
}
