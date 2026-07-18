import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";

import { type NextRequest, NextResponse } from "next/server";

import {
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  hasMediaRenderLocalOutput,
  mediaRenderLocalOutputPath,
} from "@/lib/media/media-render-local-output";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ jobId: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** 剪辑完成后、OSS 上传前：流式下载本地成片，不阻塞云端同步。 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { jobId } = await ctx.params;

  const job = await prisma.mediaRenderJob.findFirst({
    where: { id: jobId, userId: guard.user.id },
    select: { id: true, status: true, resultOssUrl: true },
  });
  if (!job) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "剪辑任务不存在" },
      { status: 404, headers: jsonHeaders(request) },
    );
  }

  if (!(await hasMediaRenderLocalOutput(jobId))) {
    if (job.resultOssUrl?.trim()) {
      return NextResponse.redirect(job.resultOssUrl, 302);
    }
    return NextResponse.json(
      { error: "NOT_READY", message: "成片尚未就绪" },
      { status: 404, headers: jsonHeaders(request) },
    );
  }

  const filePath = mediaRenderLocalOutputPath(jobId);
  const st = await stat(filePath);
  const stream = createReadStream(filePath);
  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      ...jsonHeaders(request),
      "Content-Type": "video/mp4",
      "Content-Length": String(st.size),
      "Content-Disposition": `attachment; filename="media-render-${jobId.slice(0, 8)}.mp4"`,
      "Cache-Control": "private, no-store",
    },
  });
}
