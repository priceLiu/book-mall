import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  bindShotRefIds,
  buildRefLabelToIdMap,
  parseSeedVideoDirectFromMarkdown,
  parseSeedVideoScriptsFromMarkdown,
  parseSeedVideoShotsFromMarkdown,
} from "@/lib/ecom/ecom-seed-video-markdown-parse";
import {
  getEcomSeedVideoProject,
  updateEcomSeedVideoProject,
} from "@/lib/ecom/ecom-seed-video-service";
import type {
  SeedVideoProductionMode,
  SeedVideoStylePreset,
  SeedVideoWorkflowPhase,
} from "@/lib/ecom/ecom-seed-video-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function inferPhaseFromMarkdown(text: string): SeedVideoWorkflowPhase | null {
  if (/镜号|AI视频生成提示词/.test(text) && /\|/.test(text)) return "shots";
  if (/全局.*视频提示词|完整连贯口播/.test(text)) return "production";
  if (/甜美种草风|干练安利风/.test(text)) return "style";
  if (/直接连贯生成|精细成片流程/.test(text)) return "mode";
  if (/脚本一|脚本二|脚本三/.test(text) && /\|/.test(text)) return "scripts";
  if (/核心卖点|风格定位|商品信息/.test(text)) return "scripts";
  return null;
}

function parseProductionMode(text: string): SeedVideoProductionMode | null {
  if (/方案①|直接连贯/.test(text)) return "direct";
  if (/方案②|精细成片/.test(text)) return "fine";
  return null;
}

function parseStylePreset(text: string): SeedVideoStylePreset | null {
  if (/A方案|甜美种草/.test(text)) return "sweet-xhs";
  if (/B方案|干练安利/.test(text)) return "sharp-douyin";
  return null;
}

function parseSelectedScriptId(text: string): "script-1" | "script-2" | "script-3" | null {
  if (/脚本一|方案一/.test(text)) return "script-1";
  if (/脚本二|方案二/.test(text)) return "script-2";
  if (/脚本三|方案三/.test(text)) return "script-3";
  return null;
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { markdown?: string; userChoice?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const project = await getEcomSeedVideoProject(auth.userId, id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const markdown =
    typeof body.markdown === "string" && body.markdown.trim()
      ? body.markdown.trim()
      : (project.meta?.lastAssistantRaw as string | undefined)?.trim() ?? "";

  if (!markdown) {
    return NextResponse.json({ error: "缺少可解析的助手内容" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);

    const refMap = buildRefLabelToIdMap(project.references);
    const scripts = parseSeedVideoScriptsFromMarkdown(markdown);
    const shotsRaw = parseSeedVideoShotsFromMarkdown(markdown);
    const directVideo = parseSeedVideoDirectFromMarkdown(markdown);
    const shots = bindShotRefIds(shotsRaw, refMap);

    const phase = inferPhaseFromMarkdown(markdown);
    const prevWorkflow = (project.meta?.workflow as Record<string, unknown> | undefined) ?? {};
    const userChoice = typeof body.userChoice === "string" ? body.userChoice : "";

    const workflow = {
      ...prevWorkflow,
      ...(phase ? { phase } : {}),
      ...(parseSelectedScriptId(userChoice || markdown)
        ? { selectedScriptId: parseSelectedScriptId(userChoice || markdown) }
        : {}),
      ...(parseProductionMode(userChoice || markdown)
        ? { productionMode: parseProductionMode(userChoice || markdown) }
        : {}),
      ...(parseStylePreset(userChoice || markdown)
        ? { stylePreset: parseStylePreset(userChoice || markdown) }
        : {}),
    };

    const planPatch: Record<string, unknown> = {};
    if (scripts.length > 0) planPatch.scripts = scripts;
    if (shots.length > 0) planPatch.shots = shots;
    if (directVideo) planPatch.directVideo = directVideo;

    if (/湾湾小何|甜美种草/.test(markdown)) {
      planPatch.stylePack = {
        voiceLabel: "湾湾小何",
        voicePreset: "sweet-xhs",
        bgmPreset: "轻快甜美的氛围感轻音乐",
        copyTone: "姐妹分享感",
      };
    } else if (/爽快思思|干练安利/.test(markdown)) {
      planPatch.stylePack = {
        voiceLabel: "爽快思思",
        voicePreset: "sharp-douyin",
        bgmPreset: "节奏感卡点 BGM",
        copyTone: "短促有力带货",
      };
    }

    const updated = await updateEcomSeedVideoProject(auth.userId, id, {
      plan: planPatch,
      meta: { workflow, lastAssistantRaw: markdown },
      status: shots.length > 0 || directVideo ? "plan_ready" : project.status,
    });

    return NextResponse.json({ project: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "同步失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
