"use client";

import type { CanvasNodeRuntime } from "./types";
import { sceneRowKeysEquivalent } from "./story-pro-scene-asset-catalog";
import type { StoryProSceneRow } from "./story-pro-workspace-types";
import type {
  StoryCharacterColumnNodeData,
  StoryCharacterRow,
  StoryFrameColumnNodeData,
  StoryFrameRow,
  StoryLlmSection,
  StoryScriptHubNodeData,
  StoryVideoColumnNodeData,
  StoryVideoRow,
} from "./story-workspace-types";
import type { StoryRunContext } from "./story-workspace-types";
import {
  mergeOutlineRolesIntoCharacterMd,
  normalizeCharacterTableMd,
  normalizeOutlineSection,
  normalizeStoryboardSectionMd,
  parseOutlineBriefCharacters,
  storyboardMdHasParseableRows,
} from "./parse-md-tables";
import { pushStoryRevision } from "./story-revision";
import {
  outlineTextHasEmbeddedProductionPack,
  promoteEmbeddedPackFromOutline,
} from "./story-hub-runtime";
import { parseVisualStylePackFromOutline } from "./story-pro-visual-style-pack";
import { tryApplyStructuredProductionScript, trySyncResolvedProductionScriptToHub } from "./pro2-production-script-apply";
import { isUnparsedPro2ProductionJsonBlob } from "./pro2-production-script-structured";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";

function isUnparsedPro2JsonBlob(text: string): boolean {
  return isUnparsedPro2ProductionJsonBlob(text);
}

export function applyHubSectionFromTask(
  data: StoryScriptHubNodeData,
  section: StoryLlmSection,
  runtime: CanvasNodeRuntime,
  textOutput?: string,
): Partial<StoryScriptHubNodeData> {
  const patch: Partial<StoryScriptHubNodeData> = {};
  if (section === "outline") {
    patch.outlineRuntime = runtime;
    if (textOutput?.trim()) {
      const structured = tryApplyStructuredProductionScript(
        data as StoryProScriptHubNodeData,
        section,
        textOutput,
      );
      if (structured) {
        const promoted = promoteEmbeddedPackFromOutline(textOutput, "", "", "");
        const storyboardBackfill =
          !storyboardMdHasParseableRows(structured.storyboardMd ?? "") &&
          storyboardMdHasParseableRows(promoted.storyboardMd)
            ? promoted.storyboardMd
            : null;
        const merged: Partial<StoryProScriptHubNodeData> = {
          ...structured,
          ...(storyboardBackfill
            ? {
                storyboardMd: storyboardBackfill,
                storyboardHistory: pushStoryRevision(
                  data.storyboardHistory,
                  storyboardBackfill,
                ),
              }
            : {}),
        };
        const syncPatch = trySyncResolvedProductionScriptToHub({
          ...(data as StoryProScriptHubNodeData),
          ...merged,
          outlineRuntime: { ...runtime, textOutput },
        });
        const withSync = syncPatch ? { ...merged, ...syncPatch } : merged;
        const pro2Sync = withSync as StoryProScriptHubNodeData;
        const keepTextOutput =
          !storyboardMdHasParseableRows(pro2Sync.storyboardMd ?? "") &&
          !pro2Sync.productionScript;
        return {
          ...withSync,
          outlineRuntime: {
            ...runtime,
            textOutput: keepTextOutput ? textOutput : undefined,
          },
          ...(withSync.characterMd != null ? { characterRuntime: runtime } : {}),
          ...(withSync.sceneMd != null ? { sceneRuntime: runtime } : {}),
          ...(withSync.storyboardMd != null || storyboardBackfill
            ? { storyboardRuntime: runtime }
            : {}),
        } as Partial<StoryScriptHubNodeData>;
      }
      if (isUnparsedPro2JsonBlob(textOutput)) {
        return {
          outlineRuntime: {
            ...runtime,
            status: "failed",
            failCode: "PRO2_SCRIPT_JSON_INVALID",
            failMessage:
              "模型返回了未解析的结构化 JSON，未写入大纲预览。请重试生成。",
          },
        };
      }
      const replaceEmbedded = outlineTextHasEmbeddedProductionPack(textOutput);
      const promoted = promoteEmbeddedPackFromOutline(
        textOutput,
        replaceEmbedded ? "" : (data.characterMd ?? ""),
        replaceEmbedded ? "" : (data.storyboardMd ?? ""),
        replaceEmbedded ? "" : (data.sceneMd ?? ""),
      );
      const { outlineMd, characterMd } = normalizeOutlineSection(
        promoted.outlineMd,
        promoted.characterMd,
      );
      patch.outlineMd = outlineMd;
      patch.outlineHistory = pushStoryRevision(data.outlineHistory, outlineMd);
      const stylePack = parseVisualStylePackFromOutline(outlineMd);
      if (stylePack) {
        (patch as Record<string, unknown>).visualStylePack = stylePack;
      }
      const storyboardReady = storyboardMdHasParseableRows(promoted.storyboardMd);
      if (
        replaceEmbedded
          ? characterMd.trim()
          : characterMd !== (data.characterMd ?? "")
      ) {
        patch.characterMd = characterMd;
        patch.characterHistory = pushStoryRevision(
          data.characterHistory,
          characterMd,
        );
      }
      if (promoted.sceneMd.trim()) {
        const sceneChanged =
          replaceEmbedded || promoted.sceneMd !== (data.sceneMd ?? "");
        if (sceneChanged) {
          patch.sceneMd = promoted.sceneMd;
          patch.sceneHistory = pushStoryRevision(
            data.sceneHistory,
            promoted.sceneMd,
          );
        }
      }
      if (
        storyboardReady &&
        (replaceEmbedded
          ? promoted.storyboardMd.trim()
          : promoted.storyboardMd.trim() &&
            promoted.storyboardMd !== (data.storyboardMd ?? ""))
      ) {
        patch.storyboardMd = promoted.storyboardMd;
        patch.storyboardHistory = pushStoryRevision(
          data.storyboardHistory,
          promoted.storyboardMd,
        );
      }
      const syncPatch = trySyncResolvedProductionScriptToHub({
        ...(data as StoryProScriptHubNodeData),
        ...patch,
        outlineRuntime: { ...runtime, textOutput },
      });
      if (syncPatch) Object.assign(patch, syncPatch);
      const pro2Patch = patch as StoryProScriptHubNodeData;
      const packComplete =
        storyboardMdHasParseableRows(pro2Patch.storyboardMd ?? "") ||
        Boolean(pro2Patch.productionScript);
      const sectionRuntime: CanvasNodeRuntime | undefined =
        replaceEmbedded && runtime.status === "done"
          ? {
              status: "done",
              taskId: runtime.taskId,
              textOutput: packComplete ? undefined : textOutput,
              failCode: undefined,
              failMessage: undefined,
            }
          : undefined;
      if (patch.characterMd != null && sectionRuntime) {
        patch.characterRuntime = sectionRuntime;
      }
      if (patch.sceneMd != null && sectionRuntime) {
        patch.sceneRuntime = sectionRuntime;
      }
      if (patch.storyboardMd != null && sectionRuntime) {
        patch.storyboardRuntime = sectionRuntime;
      }
    }
  } else if (section === "character") {
    patch.characterRuntime = runtime;
    if (textOutput?.trim()) {
      const structured = tryApplyStructuredProductionScript(
        data as StoryProScriptHubNodeData,
        section,
        textOutput,
      );
      if (structured) {
        return { ...structured, characterRuntime: runtime } as Partial<StoryScriptHubNodeData>;
      }
      const brief = parseOutlineBriefCharacters(data.outlineMd ?? "");
      const characterMd = normalizeCharacterTableMd(
        brief.length > 0
          ? mergeOutlineRolesIntoCharacterMd(textOutput, brief)
          : textOutput,
      );
      patch.characterMd = characterMd;
      patch.characterHistory = pushStoryRevision(
        data.characterHistory,
        characterMd,
      );
    }
  } else if (section === "scene") {
    patch.sceneRuntime = runtime;
    if (textOutput?.trim()) {
      const structured = tryApplyStructuredProductionScript(
        data as StoryProScriptHubNodeData,
        section,
        textOutput,
      );
      if (structured) {
        return { ...structured, sceneRuntime: runtime } as Partial<StoryScriptHubNodeData>;
      }
      const sceneMd = textOutput.trim();
      patch.sceneMd = sceneMd;
      patch.sceneHistory = pushStoryRevision(data.sceneHistory, sceneMd);
    }
  } else if (section === "shot_prompts") {
    if (textOutput?.trim()) {
      const structured = tryApplyStructuredProductionScript(
        data as StoryProScriptHubNodeData,
        section,
        textOutput,
      );
      if (structured) return structured;
    }
    return patch;
  } else {
    patch.storyboardRuntime = runtime;
    if (textOutput?.trim()) {
      const structured = tryApplyStructuredProductionScript(
        data as StoryProScriptHubNodeData,
        section,
        textOutput,
      );
      if (structured) {
        return { ...structured, storyboardRuntime: runtime } as Partial<StoryScriptHubNodeData>;
      }
      const storyboardMd = normalizeStoryboardSectionMd(textOutput);
      if (storyboardMdHasParseableRows(storyboardMd)) {
        patch.storyboardMd = storyboardMd;
        patch.storyboardHistory = pushStoryRevision(
          data.storyboardHistory,
          storyboardMd,
        );
      }
    }
  }
  return patch;
}

export function applyCharacterRowRuntime(
  rows: StoryCharacterRow[],
  rowKey: string,
  runtime: CanvasNodeRuntime,
): StoryCharacterRow[] {
  return rows.map((r) =>
    r.key === rowKey ? { ...r, runtime: { ...r.runtime, ...runtime } } : r,
  );
}

export function applySceneRowRuntime(
  rows: StoryProSceneRow[],
  rowKey: string,
  runtime: CanvasNodeRuntime,
): StoryProSceneRow[] {
  return rows.map((r) =>
    sceneRowKeysEquivalent(r.key, rowKey)
      ? { ...r, runtime: { ...r.runtime, ...runtime } }
      : r,
  );
}

export function applyFrameRowRuntime(
  rows: StoryFrameRow[],
  rowKey: string,
  runtime: CanvasNodeRuntime,
): StoryFrameRow[] {
  return rows.map((r) => {
    if (r.key !== rowKey) return r;
    const prevUrl = r.runtime?.ossUrl ?? r.runtime?.ephemeralUrl;
    const nextUrl = runtime.ossUrl ?? runtime.ephemeralUrl;
    const next: StoryFrameRow = {
      ...r,
      runtime: { ...r.runtime, ...runtime },
    };
    /** 仅在新图落库且 URL 变化时取消过审；重生成 pending/running 保留过审标记（旧图仍有效直至新图成功） */
    const imageChanged =
      runtime.status === "done" &&
      Boolean(nextUrl?.trim()) &&
      nextUrl !== prevUrl;
    if (imageChanged) {
      next.frameApprovedAt = undefined;
      next.frameRejectedReason = undefined;
    }
    return next;
  });
}

export function applyVideoRowRuntime(
  rows: StoryVideoRow[],
  rowKey: string,
  kind: "video" | "tts",
  runtime: CanvasNodeRuntime,
): StoryVideoRow[] {
  return rows.map((r) => {
    if (r.key !== rowKey) return r;
    if (kind === "video") {
      return {
        ...r,
        videoRuntime: { ...r.videoRuntime, ...runtime },
        frameImageUrl:
          r.frameImageUrl ?? runtime.ossUrl ?? runtime.ephemeralUrl,
      };
    }
    return { ...r, ttsRuntime: { ...r.ttsRuntime, ...runtime } };
  });
}

export function rowRuntimeKey(
  ctx: StoryRunContext | undefined,
): string | undefined {
  if (!ctx?.rowKey) return undefined;
  if (ctx.mediaKind === "video") return `video:${ctx.rowKey}`;
  if (ctx.mediaKind === "tts") return `tts:${ctx.rowKey}`;
  return ctx.rowKey;
}
