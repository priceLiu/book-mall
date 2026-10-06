import { parseReferencedIds } from "./dock-mention-parse";
import {
  buildCameraShotRunPrompt,
  findCameraShotPreset,
} from "./camera-shot-library/catalog";

const CAM_ID_PREFIX = "cam:";

/** 节点 data 中存储的镜头 mention 画面覆盖（@<cam:…> → 用户确认时的画面描述） */
export type CameraShotMentionOverrides = Record<string, string>;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceToken(prompt: string, refId: string, replacement: string): string {
  return prompt.replace(
    new RegExp(`@<${escapeRegExp(refId)}>`, "g"),
    replacement,
  );
}

/** 提交前将 @<cam:…> 展开为「画面描述 + 英文运镜」（中文释义不进模型） */
export function resolveCameraShotTokensInPrompt(
  prompt: string,
  overrides: CameraShotMentionOverrides = {},
): string {
  const mentioned = parseReferencedIds(prompt).filter((id) =>
    id.startsWith(CAM_ID_PREFIX),
  );
  if (!mentioned.length) return prompt;

  let result = prompt;
  for (const id of mentioned) {
    const preset = findCameraShotPreset(id);
    if (!preset) {
      result = replaceToken(result, id, "");
      continue;
    }
    const scene =
      overrides[id]?.trim() || preset.sceneExampleZh.trim();
    const expanded = buildCameraShotRunPrompt(preset, scene);
    result = replaceToken(result, id, expanded);
  }
  return result.replace(/\s{2,}/g, " ").trim();
}

export function isCameraShotMentionId(id: string): boolean {
  return id.startsWith(CAM_ID_PREFIX);
}
