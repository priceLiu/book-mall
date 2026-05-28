"use client";

import type { CanvasNodeRuntime } from "./types";
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
  parseOutlineBriefCharacters,
} from "./parse-md-tables";
import { pushStoryRevision } from "./story-revision";
import { promoteEmbeddedPackFromOutline } from "./story-hub-runtime";

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
      const promoted = promoteEmbeddedPackFromOutline(
        textOutput,
        data.characterMd ?? "",
        data.storyboardMd ?? "",
      );
      const { outlineMd, characterMd } = normalizeOutlineSection(
        promoted.outlineMd,
        promoted.characterMd,
      );
      patch.outlineMd = outlineMd;
      patch.outlineHistory = pushStoryRevision(data.outlineHistory, outlineMd);
      if (characterMd !== (data.characterMd ?? "")) {
        patch.characterMd = characterMd;
        patch.characterHistory = pushStoryRevision(
          data.characterHistory,
          characterMd,
        );
      }
      if (
        promoted.storyboardMd.trim() &&
        promoted.storyboardMd !== (data.storyboardMd ?? "")
      ) {
        patch.storyboardMd = promoted.storyboardMd;
        patch.storyboardHistory = pushStoryRevision(
          data.storyboardHistory,
          promoted.storyboardMd,
        );
      }
    }
  } else if (section === "character") {
    patch.characterRuntime = runtime;
    if (textOutput?.trim()) {
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
  } else {
    patch.storyboardRuntime = runtime;
    if (textOutput?.trim()) {
      patch.storyboardMd = textOutput;
      patch.storyboardHistory = pushStoryRevision(
        data.storyboardHistory,
        textOutput,
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
