import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import {
  wizardAssetDraftKey,
  type Pro2ProductionWizardAssetDraft,
  type Pro2WizardAssetKind,
} from "@/lib/canvas/pro2-production-wizard-assets";
import {
  sceneRowKeysEquivalent,
  storyProSceneRowKey,
} from "@/lib/canvas/story-pro-scene-asset-catalog";
import { isUnstableTaskMediaUrl } from "@/lib/canvas/task-media-url";
import type {
  StoryProSceneRow,
  StoryProScriptHubNodeData,
} from "@/lib/canvas/story-pro-workspace-types";
import type { CanvasNodeRuntime } from "@/lib/canvas/types";

export type WizardMentionHubPreviewSource = {
  scriptHubId: string;
  hubData: Pick<
    StoryProScriptHubNodeData,
    | "scriptStudioCharacterRows"
    | "sceneRows"
    | "scriptStudioPropRows"
    | "productionScript"
  >;
};

function isHttpPreviewUrl(url: string | undefined): url is string {
  const u = url?.trim();
  return Boolean(u && /^https?:\/\//i.test(u) && !u.startsWith("blob:"));
}

function isStableCanvasOssPreviewUrl(url: string): boolean {
  return /\/node-(image|video)\//i.test(url);
}

function readRuntimePreviewCandidates(
  runtime?: CanvasNodeRuntime | null,
): string[] {
  const out: string[] = [];
  for (const raw of [runtime?.ossUrl, runtime?.ephemeralUrl]) {
    const url = raw?.trim();
    if (isHttpPreviewUrl(url) && !out.includes(url)) out.push(url);
  }
  return out;
}

function pickBestPreviewUrl(candidates: string[]): string | undefined {
  if (!candidates.length) return undefined;
  const stableByPath = candidates.find(isStableCanvasOssPreviewUrl);
  if (stableByPath) return stableByPath;
  const stableBySignature = candidates.find((u) => !isUnstableTaskMediaUrl(u));
  if (stableBySignature) return stableBySignature;
  return candidates[0];
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

function readHubRowPreviewUrl(
  kind: Pro2WizardAssetKind,
  assetId: string,
  hub: WizardMentionHubPreviewSource,
): string | undefined {
  const { hubData, scriptHubId } = hub;
  if (kind === "character") {
    const row = hubData.scriptStudioCharacterRows?.find((r) => r.key === assetId);
    return pickBestPreviewUrl(readRuntimePreviewCandidates(row?.runtime));
  }
  if (kind === "scene") {
    const sceneRows = hubData.sceneRows ?? [];
    const rowKey = resolveSceneRowKey(
      sceneRows,
      hubData.productionScript,
      scriptHubId,
      assetId,
    );
    if (!rowKey) return undefined;
    const row = sceneRows.find((r) => sceneRowKeysEquivalent(r.key, rowKey));
    return pickBestPreviewUrl(readRuntimePreviewCandidates(row?.runtime));
  }
  const row = hubData.scriptStudioPropRows?.find((r) => r.key === assetId);
  return pickBestPreviewUrl(readRuntimePreviewCandidates(row?.runtime));
}

function normalizePreviewCandidates(urls: Array<string | undefined>): string[] {
  const unique: string[] = [];
  for (const raw of urls) {
    const t = raw?.trim();
    if (isHttpPreviewUrl(t) && !unique.includes(t)) unique.push(t);
  }
  const stableByPath = unique.filter(isStableCanvasOssPreviewUrl);
  const stableBySignature = unique.filter(
    (u) => !isStableCanvasOssPreviewUrl(u) && !isUnstableTaskMediaUrl(u),
  );
  const unstable = unique.filter(
    (u) => isUnstableTaskMediaUrl(u) && !isStableCanvasOssPreviewUrl(u),
  );
  return [...stableByPath, ...stableBySignature, ...unstable];
}

/** @ 徽标 / 参考图 catalog：Hub 行 OSS 优先于可能过期的 draft previewUrl */
export function toWizardMentionHubPreviewSource(
  scriptHubId: string,
  hubData?: WizardMentionHubPreviewSource["hubData"] | null,
): WizardMentionHubPreviewSource | undefined {
  if (!hubData) return undefined;
  return { scriptHubId, hubData };
}

export function resolveWizardAssetMentionPreviewUrl(
  kind: Pro2WizardAssetKind,
  assetId: string,
  assetDrafts?: Record<string, Pro2ProductionWizardAssetDraft>,
  hub?: WizardMentionHubPreviewSource,
): string | undefined {
  return resolveWizardAssetMentionPreviewCandidates(
    kind,
    assetId,
    assetDrafts,
    hub,
  )[0];
}

export function resolveWizardAssetMentionPreviewCandidates(
  kind: Pro2WizardAssetKind,
  assetId: string,
  assetDrafts?: Record<string, Pro2ProductionWizardAssetDraft>,
  hub?: WizardMentionHubPreviewSource,
): string[] {
  const rowUrl = hub ? readHubRowPreviewUrl(kind, assetId, hub) : undefined;
  const draftUrl = assetDrafts?.[wizardAssetDraftKey(kind, assetId)]?.previewUrl;

  return normalizePreviewCandidates([rowUrl, draftUrl]);
}
