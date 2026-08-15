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
import type { SeedVideoChatMessage } from "@/lib/ecom/ecom-seed-video-types";
import {
  findPlanMarkdownForSync,
  hasSeedVideoShotsTableMarkdown,
  isDirectPlanConfirmChoice,
  isFinalShotsConfirmChoice,
  isSeedVideoProductionWorkspaceReady,
  mergeSeedVideoWorkflowFromUserChoice,
  parseSeedVideoProductionModeFromChoice,
  parseSeedVideoScriptIdFromChoice,
} from "@/lib/ecom/ecom-seed-video-workflow";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function inferPhaseFromMarkdown(text: string): SeedVideoWorkflowPhase | null {
  if (/正式脚本/.test(text) && /\|/.test(text)) return "shots";
  if (/镜号|AI视频生成提示词|AI提示词|素材映射/.test(text) && /\|/.test(text)) return "shots";
  if (/全局.*(?:AI\s*)?(?:生成)?(?:视频)?提示词|完整连贯口播|直接连贯成片参数|请确认成片参数/.test(text)) return "production";
  if (/请选择成片风格/.test(text) && /A方案|B方案|[①②③]/.test(text)) return "style";
  if (/成片风格|定调成片风格/.test(text) && /[①②③]/.test(text) && /\|/.test(text)) {
    return "style";
  }
  if (/请选择视频制作模式/.test(text)) return "mode";
  if (/脚本一|脚本二|脚本三/.test(text) && /\|/.test(text)) return "scripts";
  if (/方案\s*[ABCabc]/.test(text) && /\|/.test(text) && /脚本|口播|种草|运镜|主题/.test(text)) {
    return "scripts";
  }
  if (/核心卖点/.test(text) && /[①②③]/.test(text) && /\|/.test(text)) return "scripts";
  if (/种草视频脚本|脚本选项/.test(text) && /[①②③]/.test(text)) return "scripts";
  return null;
}

function parseProductionMode(text: string): SeedVideoProductionMode | null {
  return parseSeedVideoProductionModeFromChoice(text);
}

function parseSelectedScriptId(text: string): "script-1" | "script-2" | "script-3" | null {
  return parseSeedVideoScriptIdFromChoice(text);
}

function parseStylePreset(text: string): SeedVideoStylePreset | null {
  if (/A方案|甜美种草|湾湾小何/.test(text)) return "sweet-xhs";
  if (/B方案|干练安利|爽快思思/.test(text)) return "sharp-douyin";
  if (/复古胶片|胶片质感/.test(text)) return "sweet-xhs";
  if (/柔光梦幻|梦幻滤镜/.test(text)) return "sweet-xhs";
  if (/极简杂志|杂志排版/.test(text)) return "sharp-douyin";
  if (/^我选择成片风格[①1]|^选[①1]$/.test(text)) return "sweet-xhs";
  if (/^我选择成片风格[②2]|^选[②2]$/.test(text)) return "sharp-douyin";
  if (/^我选择成片风格[③3]|^选[③3]$/.test(text)) return "sharp-douyin";
  return null;
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { markdown?: string; userChoice?: string; confirmSync?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const project = await getEcomSeedVideoProject(auth.userId, id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const userChoice = typeof body.userChoice === "string" ? body.userChoice.trim() : "";
  const confirmSync =
    body.confirmSync === true ||
    isFinalShotsConfirmChoice(userChoice) ||
    isDirectPlanConfirmChoice(userChoice);

  let chatHistory: SeedVideoChatMessage[] = [...project.chatHistory];
  if (confirmSync && userChoice) {
    const last = chatHistory[chatHistory.length - 1];
    if (last?.role !== "user" || last.content.trim() !== userChoice) {
      chatHistory = [
        ...chatHistory,
        {
          id: `user-${Date.now()}`,
          role: "user",
          content: userChoice,
          createdAt: new Date().toISOString(),
        },
      ];
    }
  }

  let markdown =
    typeof body.markdown === "string" && body.markdown.trim()
      ? body.markdown.trim()
      : "";

  if (confirmSync || !hasSeedVideoShotsTableMarkdown(markdown)) {
    const resolved = findPlanMarkdownForSync({ chatHistory, meta: project.meta });
    if (resolved) markdown = resolved;
  }

  if (!markdown) {
    markdown = (project.meta?.lastAssistantRaw as string | undefined)?.trim() ?? "";
  }

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

    if (confirmSync && shots.length === 0 && !directVideo) {
      return NextResponse.json(
        { error: "未在策划内容中解析到逐镜参数表或成片参数，请让助手重新输出后再确认" },
        { status: 400 },
      );
    }

    const prevProductionMode = (project.meta?.workflow as { productionMode?: string } | undefined)
      ?.productionMode;
    const effectiveMode = parseProductionMode(userChoice) ?? prevProductionMode;
    const hasStyle =
      Boolean(parseStylePreset(userChoice)) ||
      Boolean((project.meta?.workflow as { stylePreset?: string } | undefined)?.stylePreset) ||
      project.chatHistory.some((m) => m.role === "user" && /^A方案：|^B方案：/.test(m.content.trim()));
    if (confirmSync && shots.length > 0 && effectiveMode === "fine" && !hasStyle) {
      return NextResponse.json(
        { error: "方案②须先完成成片风格（A/B）点选，再同步逐镜参数表" },
        { status: 400 },
      );
    }

    const prevWorkflow = (project.meta?.workflow as Record<string, unknown> | undefined) ?? {};

    const workflow = mergeSeedVideoWorkflowFromUserChoice(prevWorkflow, userChoice);
    if (parseSelectedScriptId(userChoice)) {
      workflow.selectedScriptId = parseSelectedScriptId(userChoice);
    }
    if (parseProductionMode(userChoice)) {
      workflow.productionMode = parseProductionMode(userChoice);
    }
    if (parseStylePreset(userChoice)) {
      workflow.stylePreset = parseStylePreset(userChoice);
    }

    const workspaceReady = isSeedVideoProductionWorkspaceReady({
      chatHistory: confirmSync ? chatHistory : project.chatHistory,
      meta: {
        ...(project.meta as Record<string, unknown> | null),
        workflow: { ...prevWorkflow, ...workflow },
      },
    });

    const planPatch: Record<string, unknown> = {};
    if (scripts.length > 0) planPatch.scripts = scripts;

    const isFineProduction =
      effectiveMode === "fine" || isFinalShotsConfirmChoice(userChoice);

    const canWritePlan = workspaceReady || confirmSync;
    if (shots.length > 0 && canWritePlan) {
      planPatch.shots = shots;
    }
    // 正式逐镜表可被 parseSeedVideoDirectFromMarkdown 误解析为 directVideo；方案②只写 shots
    if (directVideo && canWritePlan && !isFineProduction) {
      planPatch.directVideo = directVideo;
    }
    if (confirmSync && isFineProduction && shots.length > 0) {
      planPatch.directVideo = null;
    }

    if (confirmSync && shots.length === 0 && !planPatch.directVideo) {
      return NextResponse.json(
        { error: "未在策划内容中解析到逐镜参数表或成片参数，请让助手重新输出后再确认" },
        { status: 400 },
      );
    }

    const phase = confirmSync
      ? ("production" as SeedVideoWorkflowPhase)
      : inferPhaseFromMarkdown(markdown);
    if (phase) workflow.phase = phase;
    if (confirmSync) {
      workflow.planSynced = true;
      workflow.phase = "production";
    }

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

    const prevMeta = (project.meta as Record<string, unknown> | undefined) ?? {};
    const metaPatch: Record<string, unknown> = {
      ...prevMeta,
      workflow,
      ...(hasSeedVideoShotsTableMarkdown(markdown) || scripts.length > 0 || directVideo
        ? { lastAssistantRaw: markdown }
        : {}),
    };
    if (shots.length > 0 && canWritePlan) {
      metaPatch.storyboardDraft = shots.map((s) => ({
        index: s.index,
        duration: s.timeSlice,
        refLabel: s.refImageLabel,
        cameraMove: "",
        sceneDescription: s.sceneDescription,
        voiceover: s.voiceover,
        aiPrompt: s.videoPrompt,
      }));
    }

    const updated = await updateEcomSeedVideoProject(auth.userId, id, {
      plan: planPatch,
      meta: metaPatch,
      chatHistory: confirmSync ? chatHistory : undefined,
      status:
        canWritePlan && (Boolean(planPatch.shots) || Boolean(planPatch.directVideo))
          ? "plan_ready"
          : project.status,
    });

    return NextResponse.json({ project: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "同步失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
