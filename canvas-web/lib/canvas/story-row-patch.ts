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
} from "./parse-md-tables";
import { pushStoryRevision } from "./story-revision";
import {
  outlineTextHasEmbeddedProductionPack,
  promoteEmbeddedPackFromOutline,
} from "./story-hub-runtime";
import { parseVisualStylePackFromOutline } from "./story-pro-visual-style-pack";
import { tryApplyStructuredProductionScript } from "./pro2-production-script-apply";
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
        return {
          ...structured,
          outlineRuntime: runtime,
          ...(structured.characterMd != null ? { characterRuntime: runtime } : {}),
          ...(structured.sceneMd != null ? { sceneRuntime: runtime } : {}),
          ...(structured.storyboardMd != null ? { storyboardRuntime: runtime } : {}),
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
      const derivedSectionRuntime: CanvasNodeRuntime | undefined =
        replaceEmbedded && runtime.status === "done"
          ? {
              status: "done",
              taskId: runtime.taskId,
              textOutput: undefined,
              failCode: undefined,
              failMessage: undefined,
            }
          : undefined;
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
        if (derivedSectionRuntime) {
          patch.characterRuntime = derivedSectionRuntime;
        }
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
          if (derivedSectionRuntime) {
            patch.sceneRuntime = derivedSectionRuntime;
          }
        }
      }
      if (
        replaceEmbedded
          ? promoted.storyboardMd.trim()
          : promoted.storyboardMd.trim() &&
            promoted.storyboardMd !== (data.storyboardMd ?? "")
      ) {
        patch.storyboardMd = promoted.storyboardMd;
        patch.storyboardHistory = pushStoryRevision(
          data.storyboardHistory,
          promoted.storyboardMd,
        );
        if (derivedSectionRuntime) {
          patch.storyboardRuntime = derivedSectionRuntime;
        }
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
      patch.storyboardMd = storyboardMd;
      patch.storyboardHistory = pushStoryRevision(
        data.storyboardHistory,
        storyboardMd,
      );
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
