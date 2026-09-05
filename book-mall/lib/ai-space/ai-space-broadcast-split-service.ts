/**
 * 口播分镜 · Gateway LLM 拆镜
 */

import {
  GatewayRequiredError,
  assertGatewayApiKeyLinkedForUser,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import { runGatewayV1ChatCompletions } from "@/lib/gateway/gateway-v1-chat-service";

import {
  AiSpaceBroadcastError,
  createBroadcastScriptWithShots,
  getAiSpaceBroadcastProject,
} from "./ai-space-broadcast-service";
import type { BroadcastProjectDto, BroadcastSplitShotInput } from "./ai-space-broadcast-types";

const SPLIT_MODEL =
  process.env.AI_SPACE_BROADCAST_SPLIT_MODEL?.trim() || "deepseek-chat";

const SYSTEM_PROMPT = `你是专业口播分镜编剧。用户给出整段口播文案与 Brief，你输出 JSON（不要 markdown 围栏），格式：
{
  "step": "broadcast_split",
  "action": "await_shot_edit",
  "shots": [
    {
      "index": 1,
      "durationSec": 5,
      "voiceoverText": "本镜口播一句",
      "sceneDescription": "画面/运镜描述",
      "presenter": { "enabled": false },
      "visual": { "type": "placeholder", "sceneDescription": "..." }
    }
  ]
}
规则：
- shots 至少 1 镜，index 从 1 递增
- 每镜 voiceoverText 非空，一镜一个信息点
- 单镜 durationSec 建议 3–15 秒，口播字数控制在 40 字内（系统硬限 20 秒音频）
- 开场 Hook 镜可 presenter.enabled=false
- 讲解镜可 presenter.enabled=true
- 只输出 JSON，无其它文字`;

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("模型未返回 JSON");
    return JSON.parse(m[0]!);
  }
}

function parseSplitResponse(raw: unknown): BroadcastSplitShotInput[] {
  if (!raw || typeof raw !== "object") {
    throw new AiSpaceBroadcastError("拆镜 JSON 格式无效", 502);
  }
  const o = raw as Record<string, unknown>;
  const shots = o.shots;
  if (!Array.isArray(shots) || shots.length === 0) {
    throw new AiSpaceBroadcastError("拆镜结果为空", 502);
  }
  return shots.map((row, i) => {
    if (!row || typeof row !== "object") {
      throw new AiSpaceBroadcastError(`镜 ${i + 1} 格式无效`, 502);
    }
    const s = row as Record<string, unknown>;
    const voiceoverText =
      typeof s.voiceoverText === "string" ? s.voiceoverText.trim() : "";
    if (!voiceoverText) {
      throw new AiSpaceBroadcastError(`镜 ${i + 1} 缺少口播文案`, 502);
    }
    return {
      index: typeof s.index === "number" ? s.index : i + 1,
      durationSec: typeof s.durationSec === "number" ? s.durationSec : undefined,
      voiceoverText,
      sceneDescription:
        typeof s.sceneDescription === "string" ? s.sceneDescription : "",
      presenter:
        s.presenter && typeof s.presenter === "object"
          ? (s.presenter as BroadcastSplitShotInput["presenter"])
          : undefined,
      visual:
        s.visual && typeof s.visual === "object"
          ? (s.visual as BroadcastSplitShotInput["visual"])
          : undefined,
    };
  });
}

export async function splitBroadcastProjectWithLlm(args: {
  userId: string;
  projectId: string;
}): Promise<BroadcastProjectDto> {
  const project = await getAiSpaceBroadcastProject(args.userId, args.projectId);
  if (!project) throw new AiSpaceBroadcastError("项目不存在", 404);
  const sourceText = project.sourceText?.trim();
  if (!sourceText) {
    throw new AiSpaceBroadcastError("请先填写整段口播文案", 400);
  }
  if (project.status === "locked" || project.status === "rendering") {
    throw new AiSpaceBroadcastError("项目已锁定或渲染中", 409);
  }

  await assertGatewayApiKeyLinkedForUser(args.userId);
  const auth = await resolveGatewayAuthForBookUser(args.userId);
  if (!auth) throw new GatewayRequiredError("请先在个人中心关联 Gateway API Key");

  const userPrompt = [
    `Brief：画幅 ${project.aspectRatio}，目标时长 ${project.targetDurationSec ?? "未指定"} 秒`,
    project.brief.tone ? `语气：${project.brief.tone}` : "",
    project.brief.presenterMode
      ? `数字人策略：${project.brief.presenterMode}`
      : "",
    "",
    "整段口播文案：",
    sourceText,
  ]
    .filter(Boolean)
    .join("\n");

  const { text } = await runGatewayV1ChatCompletions({
    auth,
    body: {
      model: SPLIT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    },
    logMeta: {
      clientSource: "EXTERNAL",
      clientPage: "account/ai-space?tab=broadcast",
      actorBookUserId: args.userId,
    },
  });

  const parsed = extractJson(text);
  const shots = parseSplitResponse(parsed);

  await createBroadcastScriptWithShots({
    projectId: args.projectId,
    shots,
    llmMeta: {
      model: SPLIT_MODEL,
      step: "broadcast_split",
    },
  });

  const updated = await getAiSpaceBroadcastProject(args.userId, args.projectId);
  if (!updated) throw new AiSpaceBroadcastError("项目不存在", 404);
  return updated;
}
