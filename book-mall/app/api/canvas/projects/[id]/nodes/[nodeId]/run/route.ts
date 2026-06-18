import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { enrichSingleCanvasTask } from "@/lib/canvas/canvas-task-billing";
import { attachGenerationCanvasHistory } from "@/lib/canvas/generation-canvas-history";
import {
  scheduleCanvasPollWorkerForProject,
  submitCanvasNodeTask,
} from "@/lib/canvas/canvas-task-service";
import { assertGatewayApiKeyLinkedForUser } from "@/lib/canvas/book-gateway-link";
import {
  runAiEngineNode,
  runImageEngineNode,
  runStoryLlmEngineNode,
  runTtsEngineNode,
  runVideoEngineNode,
  runRefVideoEngineNode,
} from "@/lib/canvas/canvas-engine-runner";
import {
  runStoryCharacterColumnRow,
  runStoryFrameColumnRow,
  runStoryScriptHubSection,
  runStoryVideoColumnTtsRow,
  runStoryVideoColumnVideoRow,
  type StoryLlmSection,
} from "@/lib/canvas/story-workspace-runner";
import {
  runStoryProCharacterRow,
  runStoryProFrameRow,
  runStoryProSceneRow,
  runStoryProScriptHubSection,
  runStoryProStarterThemeOutline,
  runStoryProStyleDraft,
  runStoryProTtsRow,
  runStoryProVideoRow,
  type StoryProLlmSection,
} from "@/lib/canvas/story-pro-workspace-runner";
import {
  isStoryPro2PipelineNodeType,
  isSbv1PipelineNodeType,
  storyPro2ToProRunnerType,
} from "@/lib/canvas/canvas-story-edition";
import { runSbv1ImageNode } from "@/lib/canvas/sbv1-image-runner";
import { runSbv1VideoEngineNode } from "@/lib/canvas/sbv1-video-engine-runner";
import { storyProStyleGateError } from "@/lib/canvas/story-pro-style-anchor";
import { resolveCharacterRowAssetRefUrls } from "@/lib/canvas/story-pro-character-ref-resolve";
import { assertStoryProRunModelCapabilities } from "@/lib/canvas/story-pro-run-guards";
import { assertStoryModelCapabilities } from "@/lib/canvas/story-model-capabilities";

type Ctx = { params: Promise<{ id: string; nodeId: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id: projectId, nodeId } = await ctx.params;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const node = body.body.node as
    | {
        type?: string;
        modelKey?: string;
        data?: Record<string, unknown>;
        imageInputs?: string[];
        textInputs?: string[];
        portraitAssetRefs?: Array<{
          url: string;
          role?: "reference_image" | "first_frame" | "last_frame";
        }>;
      }
    | undefined;
  if (!node || typeof node.type !== "string") {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "body.node.{type,data} required" },
      { status: 400, headers: jsonHeaders(request) },
    );
  }
  const forceFresh = body.body.forceFresh === true;
  const llmSection = body.body.llmSection as StoryLlmSection | undefined;
  const rowKey =
    typeof body.body.rowKey === "string" ? body.body.rowKey : undefined;
  const mediaKind = body.body.mediaKind as
    | "threeView"
    | "frameImage"
    | "video"
    | "tts"
    | "sceneRef"
    | "themeOutline"
    | undefined;
  const storyScope =
    rowKey || mediaKind || llmSection
      ? { rowKey, mediaKind, llmSection }
      : undefined;
  const isPro2 = isStoryPro2PipelineNodeType(node.type);
  const isSbv1 = isSbv1PipelineNodeType(node.type);
  const isPro =
    !isPro2 &&
    !isSbv1 &&
    node.type.startsWith("story-pro-") &&
    !node.type.startsWith("story-pro2-");
  const runnerType = isPro2 ? storyPro2ToProRunnerType(node.type) : node.type;
  const styleAnchor = body.body.styleAnchor as
    | {
        styleAnchorZh?: string;
        styleAnchorEn?: string;
        negativePrompt?: string;
      }
    | undefined;
  const styleFinalized = body.body.styleFinalized === true;
  const proClientPage = isPro2
    ? `canvas/${projectId}/story-pro2`
    : `canvas/${projectId}/story-pro`;
  const sbv1ClientPage = `canvas/${projectId}/sbv1`;
  const baseArgs = {
    userId: guard.user.id,
    projectId,
    nodeId,
    clientPage: isSbv1
      ? sbv1ClientPage
      : isPro || isPro2
        ? proClientPage
        : `canvas/${projectId}`,
    storyScope,
    node: {
      type: node.type,
      modelKey: node.modelKey,
      data: (node.data && typeof node.data === "object" ? node.data : {}) as Record<
        string,
        unknown
      >,
      imageInputs: Array.isArray(node.imageInputs)
        ? node.imageInputs.filter((u): u is string => typeof u === "string")
        : [],
      textInputs: Array.isArray(node.textInputs)
        ? node.textInputs.filter((u): u is string => typeof u === "string")
        : [],
      portraitAssetRefs: Array.isArray(node.portraitAssetRefs)
        ? node.portraitAssetRefs.filter(
            (r): r is {
              url: string;
              role?: "reference_image" | "first_frame" | "last_frame";
            } =>
              Boolean(r) &&
              typeof r === "object" &&
              typeof (r as { url?: string }).url === "string" &&
              (r as { url: string }).url.startsWith("asset://"),
          )
        : [],
    },
  };
  try {
    await assertGatewayApiKeyLinkedForUser(guard.user.id, {
      role: guard.user.role ?? null,
    });
    const requireProStyle = () => {
      if (!styleFinalized) storyProStyleGateError();
    };
    /** Pro2 LibTV：三视图/分镜图走单格 dock 风格，不强制全局 styleFinalized */
    const requireProStyleUnlessPro2 = () => {
      if (!isPro2) requireProStyle();
    };
    if ((isPro || isPro2) && rowKey && mediaKind) {
      if (
        runnerType === "story-pro-character" &&
        mediaKind === "threeView"
      ) {
        const rows =
          (baseArgs.node.data.rows as { key?: string; lockedRefIds?: string[] }[]) ??
          [];
        const row = rows.find((r) => String(r.key ?? "") === rowKey);
        const refUrls = await resolveCharacterRowAssetRefUrls(
          guard.user.id,
          projectId,
          { key: rowKey, lockedRefIds: row?.lockedRefIds },
          { excludeThreeView: true },
        );
        const batch = (baseArgs.node.data.batchImage as { modelKey?: string }) ?? {};
        assertStoryModelCapabilities(
          String(batch.modelKey ?? "").trim(),
          refUrls.length > 0 ? ["image_multi_ref"] : ["image_t2i"],
          "角色三视图",
        );
      } else {
        assertStoryProRunModelCapabilities({
          nodeType: runnerType,
          mediaKind,
          nodeData: baseArgs.node.data,
          rowKey,
        });
      }
    }
    let result;
    if (runnerType === "story-pro-starter" && mediaKind === "themeOutline") {
      result = await runStoryProStarterThemeOutline({ ...baseArgs, forceFresh });
    } else if (runnerType === "story-pro-script-hub" && llmSection) {
      result = await runStoryProScriptHubSection({
        ...baseArgs,
        forceFresh,
        llmSection: llmSection as StoryProLlmSection,
      });
    } else if (runnerType === "story-pro-style") {
      result = await runStoryProStyleDraft({ ...baseArgs, forceFresh });
    } else if (
      runnerType === "story-pro-character" &&
      rowKey &&
      mediaKind === "threeView"
    ) {
      requireProStyleUnlessPro2();
      result = await runStoryProCharacterRow({
        ...baseArgs,
        forceFresh,
        rowKey,
        styleAnchor,
      });
    } else if (
      runnerType === "story-pro-scene" &&
      rowKey &&
      mediaKind === "sceneRef"
    ) {
      requireProStyleUnlessPro2();
      result = await runStoryProSceneRow({
        ...baseArgs,
        forceFresh,
        rowKey,
        styleAnchor,
      });
    } else if (
      runnerType === "story-pro-frame" &&
      rowKey &&
      mediaKind === "frameImage"
    ) {
      requireProStyleUnlessPro2();
      result = await runStoryProFrameRow({
        ...baseArgs,
        forceFresh,
        rowKey,
        styleAnchor,
      });
    } else if (
      runnerType === "story-pro-video" &&
      rowKey &&
      mediaKind === "video"
    ) {
      requireProStyle();
      result = await runStoryProVideoRow({
        ...baseArgs,
        forceFresh,
        rowKey,
        styleAnchor,
      });
    } else if (
      runnerType === "story-pro-video" &&
      rowKey &&
      mediaKind === "tts"
    ) {
      requireProStyle();
      result = await runStoryProTtsRow({
        ...baseArgs,
        forceFresh,
        rowKey,
      });
    } else if (node.type === "ai-engine") {
      result = await runAiEngineNode({ ...baseArgs, forceFresh });
    } else if (node.type === "story-script-hub" && llmSection) {
      result = await runStoryScriptHubSection({
        ...baseArgs,
        forceFresh,
        llmSection,
      });
    } else if (
      node.type === "story-character-column" && rowKey && mediaKind === "threeView"
    ) {
      result = await runStoryCharacterColumnRow({
        ...baseArgs,
        forceFresh,
        rowKey,
      });
    } else if (
      node.type === "story-frame-column" && rowKey && mediaKind === "frameImage"
    ) {
      result = await runStoryFrameColumnRow({
        ...baseArgs,
        forceFresh,
        rowKey,
      });
    } else if (
      node.type === "story-video-column" && rowKey && mediaKind === "video"
    ) {
      result = await runStoryVideoColumnVideoRow({
        ...baseArgs,
        forceFresh,
        rowKey,
      });
    } else if (
      node.type === "story-video-column" && rowKey && mediaKind === "tts"
    ) {
      result = await runStoryVideoColumnTtsRow({
        ...baseArgs,
        forceFresh,
        rowKey,
      });
    } else if (
      node.type === "story-outline-engine" ||
      node.type === "character-engine" ||
      node.type === "storyboard-engine"
    ) {
      result = await runStoryLlmEngineNode({
        ...baseArgs,
        forceFresh,
        engineKind: node.type,
      });
    } else if (node.type === "sbv1-image") {
      result = await runSbv1ImageNode({ ...baseArgs, forceFresh });
    } else if (
      node.type === "story-pro2-image" &&
      !["frame", "character-three-view"].includes(
        String(
          (node.data as { pro2MediaRole?: string }).pro2MediaRole ?? "generic",
        ),
      )
    ) {
      result = await runSbv1ImageNode({ ...baseArgs, forceFresh });
    } else if (node.type === "sbv1-video-engine") {
      result = await runSbv1VideoEngineNode({ ...baseArgs, forceFresh });
    } else if (node.type === "video-engine") {
      result = await runVideoEngineNode({ ...baseArgs, forceFresh });
    } else if (node.type === "ai-video-engine") {
      result = await runRefVideoEngineNode({ ...baseArgs, forceFresh });
    } else if (node.type === "tts-engine") {
      result = await runTtsEngineNode({ ...baseArgs, forceFresh });
    } else if (node.type === "image-engine" || node.type === "three-view-engine") {
      result = await runImageEngineNode({ ...baseArgs, forceFresh });
    } else {
      // v1 兼容：image-gen 仍走旧路径
      result = await submitCanvasNodeTask(baseArgs);
    }
    if (
      result.task.status === "PENDING" ||
      result.task.status === "SUBMITTED"
    ) {
      scheduleCanvasPollWorkerForProject(projectId);
    }
    const task = await enrichSingleCanvasTask(result.task);

    const canvasSnapshot = body.body.canvasSnapshot as
      | { canvas?: unknown; thumbnailUrl?: unknown }
      | undefined;
    if (
      !result.reused &&
      canvasSnapshot &&
      typeof canvasSnapshot === "object" &&
      canvasSnapshot.canvas &&
      typeof canvasSnapshot.canvas === "object"
    ) {
      try {
        await attachGenerationCanvasHistory({
          userId: guard.user.id,
          projectId,
          taskId: result.task.id,
          canvas: canvasSnapshot.canvas,
          thumbnailUrl:
            typeof canvasSnapshot.thumbnailUrl === "string"
              ? canvasSnapshot.thumbnailUrl
              : undefined,
          nodeType: node.type,
          model: result.task.model,
          inputPayload: result.task.inputPayload,
          createdAt: result.task.createdAt,
        });
      } catch (e) {
        console.warn("[canvas/run] generation canvas snapshot failed", e);
      }
    }

    return NextResponse.json(
      { reused: result.reused, task },
      { status: result.reused ? 200 : 202, headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
