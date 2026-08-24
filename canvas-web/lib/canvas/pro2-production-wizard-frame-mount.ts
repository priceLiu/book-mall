/**
 * 生产向导 · 放入画布前 · 分镜 row prompt / @ / ref 接线
 */
import type { Pro2ProductionScript } from "./data/pro2-production-script-schema";
import {
  applyPro2FrameMediaPromptsForIndices,
  applyPro2VideoMediaPromptsForIndices,
} from "./pro2-lazy-media-prompts";
import { storyProSceneRowKey } from "./story-pro-scene-asset-catalog";
import { storyRefMentionToken } from "./story-ref-image";
import { syncPro2FrameRowsUpstreamRefs } from "./pro2-wire-frame-board-refs";
import { mergeFrameRowCharacterRefsFromIds } from "./story-column-sync";
import type {
  StoryProCharacterRow,
  StoryProFrameRow,
  StoryProSceneRow,
  StoryProVideoRow,
} from "./story-pro-workspace-types";

const WIZ_CHAR_PREFIX = "wiz-char-";
const WIZ_SCENE_PREFIX = "wiz-scene-";

/** Pass2 @<wiz-*> → 画布 Dock @<ref-char/ref-scene-*> */
export function convertWizardMentionTokensToDockRefs(
  text: string,
  script: Pro2ProductionScript | undefined,
  scriptHubId: string,
  sceneRows: StoryProSceneRow[],
): string {
  if (!text.trim() || !script) return text;
  let out = text;
  for (const c of script.characters ?? []) {
    const token = `@<${WIZ_CHAR_PREFIX}${c.id}>`;
    if (out.includes(token)) {
      out = out.split(token).join(storyRefMentionToken(`ref-char-${c.id}`));
    }
  }
  for (const s of script.scenes ?? []) {
    const token = `@<${WIZ_SCENE_PREFIX}${s.id}>`;
    if (!out.includes(token)) continue;
    const sceneKey =
      sceneRows.find((r) => r.name === s.name)?.key ??
      (scriptHubId.trim()
        ? storyProSceneRowKey(scriptHubId, s.name)
        : s.id);
    out = out.split(token).join(storyRefMentionToken(`ref-scene-${sceneKey}`));
  }
  return out;
}

/** mount 前 · Pass1/Pass2 prompt + 上游资产 @ + refImages */
export function finalizePro2FrameRowsForCanvasMount(args: {
  frameRows: StoryProFrameRow[];
  characterRows: StoryProCharacterRow[];
  sceneRows: StoryProSceneRow[];
  script?: Pro2ProductionScript;
  scriptHubId: string;
}): StoryProFrameRow[] {
  const indices = args.frameRows.map((r) => r.frameIndex);
  if (!indices.length) return args.frameRows;

  let rows = applyPro2FrameMediaPromptsForIndices(args.frameRows, indices);
  rows = syncPro2FrameRowsUpstreamRefs(
    rows,
    args.characterRows,
    args.sceneRows,
  );

  if (args.script) {
    rows = rows.map((row) => {
      const shot = args.script!.shots?.find((s) => s.index === row.frameIndex);
      if (!shot?.characterIds?.length) return row;
      return mergeFrameRowCharacterRefsFromIds(
        row,
        args.characterRows,
        shot.characterIds,
      ) as StoryProFrameRow;
    });
  }

  if (!args.script) return rows;

  return rows.map((row) => {
    const prompt = convertWizardMentionTokensToDockRefs(
      row.prompt ?? "",
      args.script,
      args.scriptHubId,
      args.sceneRows,
    );
    return prompt === row.prompt ? row : { ...row, prompt };
  });
}

export function finalizePro2VideoRowsForCanvasMount(args: {
  frameRows: StoryProFrameRow[];
  videoRows: StoryProVideoRow[];
}): StoryProVideoRow[] {
  const indices = args.frameRows.map((r) => r.frameIndex);
  if (!indices.length) return args.videoRows;
  const withVideoPrompt = applyPro2VideoMediaPromptsForIndices(
    args.frameRows,
    indices,
  );
  const byKey = new Map(withVideoPrompt.map((r) => [r.key, r]));
  return args.videoRows.map((row) => {
    const frame = byKey.get(row.key);
    if (!frame) return row;
    const videoPrompt =
      frame.videoPrompt?.trim() ||
      frame.prompt?.trim() ||
      row.videoPrompt?.trim() ||
      "";
    return {
      ...row,
      videoPrompt,
      refImages: frame.refImages?.length ? frame.refImages : row.refImages,
      videoReferencedNodeIds:
        frame.referencedNodeIds ?? row.videoReferencedNodeIds,
    };
  });
}
