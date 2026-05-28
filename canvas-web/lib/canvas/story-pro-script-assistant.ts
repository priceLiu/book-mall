/** 剧本创作助手 · 客户端模式与文案（system prompt 真源在 book-mall） */

import type { CanvasFlowNode } from "./types";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";
import {
  storyProHubHasMediaColumns,
  storyProHubHasStyleLayer,
} from "./spawn-story-pro-workspace";

export type ScriptAssistantOutputMode = "chat" | "pack";

/** 「确定导入」仅允许全新工作流：未定稿、Hub 无生成内容、无风格/媒体下游 */
export function storyProAssistantImportGate(nodes: CanvasFlowNode[]): {
  allowed: boolean;
  reason: string;
} {
  const hub = nodes.find((n) => n.type === "story-pro-script-hub");
  if (!hub) {
    return { allowed: false, reason: "未找到故事剧本节点，无法导入。" };
  }
  const hd = hub.data as unknown as StoryProScriptHubNodeData;
  if (hd.scriptFinalized) {
    return {
      allowed: false,
      reason:
        "故事已定稿。确定导入仅用于全新工作流，请新建项目后在助手中起草并导入。",
    };
  }
  if (
    (hd.outlineMd ?? "").trim() ||
    (hd.characterMd ?? "").trim() ||
    (hd.storyboardMd ?? "").trim()
  ) {
    return {
      allowed: false,
      reason:
        "故事剧本 Hub 已有大纲/角色/分镜。确定导入仅用于全新工作流，请勿覆盖进行中项目。",
    };
  }
  if (storyProHubHasStyleLayer(nodes, hub.id)) {
    return {
      allowed: false,
      reason:
        "已连接风格节点。确定导入仅用于全新工作流，请在新项目中使用。",
    };
  }
  if (storyProHubHasMediaColumns(nodes, hub.id)) {
    return {
      allowed: false,
      reason:
        "已生成人物/场景/分镜/视频等下游列。确定导入仅用于全新工作流。",
    };
  }
  return { allowed: true, reason: "" };
}

export const SCRIPT_ASSISTANT_OUTPUT_MODES: {
  id: ScriptAssistantOutputMode;
  label: string;
  hint: string;
}[] = [
  { id: "chat", label: "闲聊 / 润色", hint: "自由 Markdown" },
  {
    id: "pack",
    label: "创作并导入故事剧本",
    hint: "完整制作包 · 全新工作流",
  },
];

/** 打开助手且无历史对话时展示的欢迎语（仅 UI，不写入 API / 持久化） */
export const SCRIPT_ASSISTANT_WELCOME_MESSAGE = `你好！我是你的剧本创作助手，随时准备为你服务。

可以帮你完成以下任务：
- 撰写短剧剧本
- 润色对话与对白
- 扩写剧情或人物设定
- 生成完整故事大纲与分镜表
- 输出可直接导入 AI 短剧画布的剧本格式（含角色表、场景表、分镜）

请告诉我：
- 你需要的项目类型（悬疑、爱情、喜剧、科幻等）
- 基本剧情或灵感（一句话或一段描述）
- 希望完成的输出格式（简纲 / 全本剧本 / 角色设定）

我会用最专业、简洁的方式呈现。现在，请说出你的创作需求。`;
