import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  beginFilmPullAnalyzeRun,
  endFilmPullAnalyzeRun,
  finalizeFilmPullAnalyzeFromText,
  FilmPullAnalyzeCanceledError,
} from "@/lib/ecom/ecom-film-pull-analyze";
import {
  getEcomFilmPullProject,
  saveFilmPullAnalyzeResult,
} from "@/lib/ecom/ecom-film-pull-service";
import { isEcomFilmPullAnalyzeActive } from "@/lib/ecom/ecom-film-pull-types";
import { ecomGwChatStream } from "@/lib/gateway/ecom-tool-gateway-client";
import { pipeGatewaySseChatToTextPlain } from "@/lib/gateway/ecom-gw-chat-stream-collect";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

function buildVideoUserContent(
  prompt: string,
  ossUrl: string,
): Array<{ type: "video_url"; video_url: { url: string } } | { type: "text"; text: string }> {
  return [
    { type: "video_url", video_url: { url: ossUrl } },
    { type: "text", text: prompt },
  ];
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id: projectId } = await ctx.params;

  let body: { prompt?: unknown; modelKey?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty */
  }

  let analyzeCtx: Awaited<ReturnType<typeof beginFilmPullAnalyzeRun>> | null = null;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    analyzeCtx = await beginFilmPullAnalyzeRun({
      userId: auth.userId,
      projectId,
      prompt: typeof body.prompt === "string" ? body.prompt : undefined,
      modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
    });

    const gw = await ecomGwChatStream(auth.userId, {
      modelKey: analyzeCtx.modelKey,
      messages: [
        { role: "system", content: analyzeCtx.systemPrompt },
        {
          role: "user",
          content: buildVideoUserContent(analyzeCtx.userPrompt, analyzeCtx.media.ossUrl),
        },
      ],
      clientPage: analyzeCtx.clientPage,
    });

    const ctxSnapshot = analyzeCtx;
    const readable = pipeGatewaySseChatToTextPlain(gw.body, {
      signal: analyzeCtx.abortSignal,
      onFullText: async (fullText) => {
        await finalizeFilmPullAnalyzeFromText({
          ctx: ctxSnapshot,
          fullText,
          retryOnParseError: false,
        });
      },
      onFinally: () => {
        endFilmPullAnalyzeRun(ctxSnapshot);
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    if (analyzeCtx) {
      endFilmPullAnalyzeRun(analyzeCtx);
    }
    if (e instanceof FilmPullAnalyzeCanceledError) {
      const project = await getEcomFilmPullProject(auth.userId, projectId);
      return NextResponse.json({ error: e.message, project }, { status: 499 });
    }
    const message = e instanceof Error ? e.message : "拉片失败";
    let project = await getEcomFilmPullProject(auth.userId, projectId);
    if (project && isEcomFilmPullAnalyzeActive(project)) {
      project = await saveFilmPullAnalyzeResult(auth.userId, projectId, {
        rawText: project.analyzeResult?.rawText ?? "",
        structured: null,
        parseError: message,
        completedAt: new Date().toISOString(),
      });
    }
    return NextResponse.json({ error: message, project }, { status: 502 });
  }
}
