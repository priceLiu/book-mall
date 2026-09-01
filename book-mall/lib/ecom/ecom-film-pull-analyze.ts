import { randomUUID } from "crypto";

import type { CanvasChatContentPart } from "@/lib/canvas/providers/types";
import {
  assertStoryLlmVideoUnderstandingModel,
  isStoryLlmVideoUnderstandingModel,
} from "@/lib/canvas/story-llm-vision-models";
import {
  extractFilmPullAnalyzePatch,
  extractFilmPullRenderScriptPatch,
  normalizeFilmPullShotsForDisplay,
  resolveFilmPullParseError,
  assertRenderScriptInvariants,
} from "@/lib/ecom/ecom-film-pull-structured";
import {
  normalizeCameraMovement,
  normalizeCutTransition,
  normalizeShotScale,
} from "@/lib/ecom/ecom-film-pull-enums";
import {
  buildFilmPullAnalyzeSystemPrompt,
  buildFilmPullRenderScriptSystemPrompt,
  buildFilmPullRenderScriptUserPrompt,
  FILM_PULL_DEFAULT_ANALYZE_USER_PROMPT,
} from "@/lib/ecom/ecom-film-pull-prompts";
import {
  ECOM_FILM_PULL_DEFAULT_CHAT_MODEL,
  ECOM_FILM_PULL_TOOL_KEY,
  type FilmPullCharacterRef,
  type FilmPullMediaReference,
  type FilmPullRenderPlan,
  type FilmPullStructuredResult,
} from "@/lib/ecom/ecom-film-pull-types";
import type {
  FilmPullAnalyzePatch,
  FilmPullRenderScriptPatch,
} from "@/lib/ecom/ecom-film-pull-structured";
import {
  getEcomFilmPullProject,
  saveFilmPullAnalyzeResult,
  saveFilmPullRenderScriptResult,
  claimFilmPullAnalyzeSlot,
  updateEcomFilmPullProject,
  buildRenderPlanFromScript,
} from "@/lib/ecom/ecom-film-pull-service";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { collectEcomGwChatStreamText } from "@/lib/gateway/ecom-gw-chat-stream-collect";
import {
  isFilmPullAnalyzeRunAborted,
  registerFilmPullAnalyzeRun,
  releaseFilmPullAnalyzeRun,
} from "@/lib/ecom/ecom-film-pull-analyze-run";

export class FilmPullAnalyzeCanceledError extends Error {
  constructor() {
    super("拉片已中止");
    this.name = "FilmPullAnalyzeCanceledError";
  }
}

async function assertAnalyzeNotCanceled(
  userId: string,
  projectId: string,
  runId: string,
): Promise<void> {
  const project = await getEcomFilmPullProject(userId, projectId);
  const meta = project?.meta;
  if (
    meta?.analyzeCancelRunId &&
    meta.analyzeRunId &&
    meta.analyzeCancelRunId === meta.analyzeRunId &&
    meta.analyzeRunId === runId
  ) {
    throw new FilmPullAnalyzeCanceledError();
  }
}

function buildVideoUserContent(
  prompt: string,
  media: FilmPullMediaReference,
): string | CanvasChatContentPart[] {
  return [
    { type: "video_url", video_url: { url: media.ossUrl } },
    { type: "text", text: prompt },
  ];
}

async function collectGwChatText(
  userId: string,
  opts: {
    modelKey: string;
    messages: Array<{ role: "system" | "user"; content: string | CanvasChatContentPart[] }>;
    clientPage: string;
    signal?: AbortSignal;
  },
): Promise<string> {
  try {
    return await collectEcomGwChatStreamText(userId, {
      modelKey: opts.modelKey,
      messages: opts.messages,
      clientPage: opts.clientPage,
      signal: opts.signal,
    });
  } catch (e) {
    if (
      isFilmPullAnalyzeRunAborted(opts.signal) ||
      (e instanceof Error &&
        (e.name === "AbortError" || e.message.includes("请求已取消")))
    ) {
      throw new FilmPullAnalyzeCanceledError();
    }
    throw e;
  }
}

function normalizeAnalyzePatch(patch: FilmPullAnalyzePatch): FilmPullAnalyzePatch {
  return {
    ...patch,
    shots: normalizeFilmPullShotsForDisplay(
      patch.shots.map((s) => ({
        ...s,
        shotScale: normalizeShotScale(s.shotScale),
        cutTransition: normalizeCutTransition(s.cutTransition),
        cameraMovement: normalizeCameraMovement(s.cameraMovement),
      })),
    ),
  };
}

export type FilmPullAnalyzeRunContext = {
  userId: string;
  projectId: string;
  runId: string;
  abortSignal: AbortSignal;
  modelKey: string;
  userPrompt: string;
  clientPage: string;
  systemPrompt: string;
  media: FilmPullMediaReference;
};

export async function beginFilmPullAnalyzeRun(opts: {
  userId: string;
  projectId: string;
  prompt?: string;
  modelKey?: string;
}): Promise<FilmPullAnalyzeRunContext> {
  const project = await getEcomFilmPullProject(opts.userId, opts.projectId);
  if (!project?.media?.ossUrl) throw new Error("请先上传视频");

  let modelKey =
    opts.modelKey?.trim() ||
    project.settings.chatModelKey?.trim() ||
    ECOM_FILM_PULL_DEFAULT_CHAT_MODEL;
  if (!isStoryLlmVideoUnderstandingModel(modelKey)) {
    modelKey = ECOM_FILM_PULL_DEFAULT_CHAT_MODEL;
  }
  assertStoryLlmVideoUnderstandingModel(modelKey, "专业拉片");

  const userPrompt = opts.prompt?.trim() || FILM_PULL_DEFAULT_ANALYZE_USER_PROMPT;
  const runId = randomUUID();
  const startedAt = new Date().toISOString();

  let abortSignal: AbortSignal;
  try {
    abortSignal = registerFilmPullAnalyzeRun(opts.userId, opts.projectId, runId);
  } catch (e) {
    throw e instanceof Error ? e : new Error("拉片进行中，请等待完成或先中止");
  }

  try {
    await claimFilmPullAnalyzeSlot(opts.userId, opts.projectId, {
      runId,
      startedAt,
      chatModelKey: modelKey,
      lastAnalyzePrompt: userPrompt,
      settings: project.settings,
      meta: project.meta,
    });
  } catch (e) {
    releaseFilmPullAnalyzeRun(opts.userId, opts.projectId, runId);
    throw e;
  }

  return {
    userId: opts.userId,
    projectId: opts.projectId,
    runId,
    abortSignal,
    modelKey,
    userPrompt,
    clientPage: ecomClientPage(opts.userId, opts.projectId, ECOM_FILM_PULL_TOOL_KEY),
    systemPrompt: buildFilmPullAnalyzeSystemPrompt(),
    media: project.media,
  };
}

export async function finalizeFilmPullAnalyzeFromText(opts: {
  ctx: FilmPullAnalyzeRunContext;
  fullText: string;
  retryOnParseError?: boolean;
}): Promise<FilmPullStructuredResult<FilmPullAnalyzePatch>> {
  const { ctx } = opts;
  let fullText = opts.fullText;

  let structured = extractFilmPullAnalyzePatch(fullText);
  let parseError = structured ? null : resolveFilmPullParseError(fullText, "analyze");

  if (!structured && parseError && opts.retryOnParseError !== false) {
    try {
      await assertAnalyzeNotCanceled(ctx.userId, ctx.projectId, ctx.runId);
      fullText = await collectGwChatText(ctx.userId, {
        modelKey: ctx.modelKey,
        clientPage: ctx.clientPage,
        signal: ctx.abortSignal,
        messages: [
          { role: "system", content: ctx.systemPrompt },
          { role: "user", content: buildVideoUserContent(ctx.userPrompt, ctx.media) },
          {
            role: "user",
            content: `上次输出校验失败：${parseError}。请仅重输出完整 \`\`\`film-pull JSON。`,
          },
        ],
      });
      structured = extractFilmPullAnalyzePatch(fullText);
      parseError = structured ? null : resolveFilmPullParseError(fullText, "analyze");
    } catch (e) {
      if (e instanceof FilmPullAnalyzeCanceledError) throw e;
      parseError = e instanceof Error ? e.message : "拉片模型重试失败";
    }
  }

  if (structured) structured = normalizeAnalyzePatch(structured);

  await assertAnalyzeNotCanceled(ctx.userId, ctx.projectId, ctx.runId);

  const result: FilmPullStructuredResult<FilmPullAnalyzePatch> = {
    rawText: fullText,
    structured: structured ?? null,
    parseError,
    completedAt: new Date().toISOString(),
  };

  await saveFilmPullAnalyzeResult(ctx.userId, ctx.projectId, result);
  return result;
}

export function endFilmPullAnalyzeRun(ctx: Pick<FilmPullAnalyzeRunContext, "userId" | "projectId" | "runId">): void {
  releaseFilmPullAnalyzeRun(ctx.userId, ctx.projectId, ctx.runId);
}

export async function runFilmPullAnalyze(opts: {
  userId: string;
  projectId: string;
  prompt?: string;
  modelKey?: string;
}): Promise<FilmPullStructuredResult<FilmPullAnalyzePatch>> {
  const ctx = await beginFilmPullAnalyzeRun(opts);

  try {
    let fullText = "";
    let gatewayError: string | null = null;
    try {
      await assertAnalyzeNotCanceled(ctx.userId, ctx.projectId, ctx.runId);
      fullText = await collectGwChatText(ctx.userId, {
        modelKey: ctx.modelKey,
        clientPage: ctx.clientPage,
        signal: ctx.abortSignal,
        messages: [
          { role: "system", content: ctx.systemPrompt },
          { role: "user", content: buildVideoUserContent(ctx.userPrompt, ctx.media) },
        ],
      });
    } catch (e) {
      if (e instanceof FilmPullAnalyzeCanceledError) throw e;
      gatewayError = e instanceof Error ? e.message : "拉片模型调用失败";
    }

    if (gatewayError) {
      const result: FilmPullStructuredResult<FilmPullAnalyzePatch> = {
        rawText: "",
        structured: null,
        parseError: gatewayError,
        completedAt: new Date().toISOString(),
      };
      await saveFilmPullAnalyzeResult(ctx.userId, ctx.projectId, result);
      return result;
    }

    return await finalizeFilmPullAnalyzeFromText({ ctx, fullText });
  } catch (e) {
    if (e instanceof FilmPullAnalyzeCanceledError) {
      const latest = await getEcomFilmPullProject(ctx.userId, ctx.projectId);
      if (latest?.analyzeResult?.completedAt) {
        return latest.analyzeResult;
      }
      throw e;
    }
    throw e;
  } finally {
    endFilmPullAnalyzeRun(ctx);
  }
}

export async function runFilmPullRenderScript(opts: {
  userId: string;
  projectId: string;
  characterDescription?: string;
  modelKey?: string;
}): Promise<FilmPullStructuredResult<FilmPullRenderScriptPatch>> {
  const project = await getEcomFilmPullProject(opts.userId, opts.projectId);
  const analyze = project?.analyzeResult?.structured;
  if (!analyze) throw new Error("请先完成拉片分析");
  if (project.characterRefs.length === 0 && !opts.characterDescription?.trim()) {
    throw new Error("请上传角色参考图或填写角色描述");
  }

  let modelKey = opts.modelKey?.trim() || project.settings.chatModelKey?.trim() || ECOM_FILM_PULL_DEFAULT_CHAT_MODEL;
  if (!isStoryLlmVideoUnderstandingModel(modelKey)) {
    modelKey = ECOM_FILM_PULL_DEFAULT_CHAT_MODEL;
  }

  await updateEcomFilmPullProject(opts.userId, opts.projectId, { status: "render_scripting" });

  const clientPage = ecomClientPage(opts.userId, opts.projectId, ECOM_FILM_PULL_TOOL_KEY);
  const userPrompt = buildFilmPullRenderScriptUserPrompt({
    analyzeJson: JSON.stringify(analyze),
    characterDescription: opts.characterDescription ?? "",
    characterRefLabels: project.characterRefs.map((r) => r.label ?? "角色参考"),
  });

  const contentParts: CanvasChatContentPart[] = [{ type: "text", text: userPrompt }];
  for (const ref of project.characterRefs.slice(0, 3)) {
    contentParts.push({ type: "image_url", image_url: { url: ref.ossUrl } });
  }

  let fullText = "";
  let gatewayError: string | null = null;
  try {
    fullText = await collectGwChatText(opts.userId, {
      modelKey,
      clientPage,
      messages: [
        { role: "system", content: buildFilmPullRenderScriptSystemPrompt() },
        { role: "user", content: contentParts },
      ],
    });
  } catch (e) {
    gatewayError = e instanceof Error ? e.message : "渲染脚本模型调用失败";
  }

  let structured = gatewayError ? null : extractFilmPullRenderScriptPatch(fullText);
  let parseError = gatewayError ?? (structured ? null : resolveFilmPullParseError(fullText, "render_script"));

  if (structured) {
    structured = {
      ...structured,
      shots: normalizeFilmPullShotsForDisplay(structured.shots),
    };
    try {
      assertRenderScriptInvariants(analyze, structured);
    } catch (e) {
      parseError = e instanceof Error ? e.message : "渲染脚本不变量校验失败";
      structured = null;
    }
  }

  const result: FilmPullStructuredResult<FilmPullRenderScriptPatch> = {
    rawText: fullText,
    structured: structured ?? null,
    parseError,
    completedAt: new Date().toISOString(),
  };

  await saveFilmPullRenderScriptResult(opts.userId, opts.projectId, result);
  if (structured) {
    await buildRenderPlanFromScript(opts.userId, opts.projectId, structured);
  }
  return result;
}

export type { FilmPullCharacterRef, FilmPullRenderPlan };
