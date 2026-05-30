import {
  STORY_PRO_CHARACTER_PROMPT,
  STORY_PRO_OUTLINE_USER_PROMPT,
  STORY_PRO_STORYBOARD_PROMPT,
  STORY_PRO_HUB_LLM_SYSTEM,
  STORY_PRO_LLM_PARAMS_DEFAULT,
} from "./story-pro-prompts";
import type { StoryProStarterNodeData } from "./story-pro-workspace-types";

/** 启动节点保存后同步「故事剧本」hub 的 LLM 配置 */
export function syncStoryProHubFromStarter(args: {
  starterNodeId: string;
  systemPrompt: string;
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  scriptHubId: string;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
}) {
  args.updateNodeData(args.scriptHubId, {
    providerId: args.providerId,
    modelKey: args.modelKey,
    params: {
      ...STORY_PRO_LLM_PARAMS_DEFAULT,
      ...args.params,
    },
    referencedNodeIds: [args.starterNodeId],
    outlineSystemPrompt: STORY_PRO_HUB_LLM_SYSTEM,
    promptOutline: STORY_PRO_OUTLINE_USER_PROMPT,
    promptCharacter: STORY_PRO_CHARACTER_PROMPT,
    promptStoryboard: STORY_PRO_STORYBOARD_PROMPT,
  });
}

/** 启动节点是否已有可解析的剧本文本（上传或预留上游） */
export function storyProStarterHasScriptSource(
  d: Pick<
    StoryProStarterNodeData,
    "starterMode" | "uploadedScriptMd" | "uploadedScriptOssUrl" | "systemPrompt"
  >,
  upstreamScript?: string | null,
): boolean {
  if (upstreamScript?.trim()) return true;
  if ((d.uploadedScriptMd ?? "").trim()) return true;
  if ((d.uploadedScriptOssUrl ?? "").trim()) return true;
  if (d.starterMode === "generate" && (d.systemPrompt ?? "").trim()) return true;
  return false;
}
