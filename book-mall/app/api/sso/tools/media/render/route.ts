import { MediaRenderSourceApp } from "@prisma/client";
import { NextResponse } from "next/server";

import { MediaRenderUnavailableError } from "@/lib/media/ffmpeg-preflight";
import {
  createMediaRenderJob,
  enqueueMediaRenderJob,
  getMediaRenderJobForUser,
} from "@/lib/media/media-render-service";
import {
  parseMediaTimelineV1,
  parseRenderProfile,
} from "@/lib/media/timeline-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    clips?: unknown;
    timeline?: unknown;
    profile?: unknown;
    sourceRef?: Record<string, unknown>;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  try {
    const timeline = parseMediaTimelineV1(
      body.timeline ?? { version: 1, clips: body.clips },
    );
    const profile = parseRenderProfile(body.profile);
    const job = await createMediaRenderJob({
      userId: auth.userId,
      sourceApp: MediaRenderSourceApp.api,
      sourceRef: body.sourceRef,
      timeline,
      profile,
    });
    enqueueMediaRenderJob(job.id);
    const dto = await getMediaRenderJobForUser(job.id, auth.userId);
    return NextResponse.json({ job: dto });
  } catch (e) {
    if (e instanceof MediaRenderUnavailableError) {
      return NextResponse.json(
        { error: e.code, message: e.userMessage },
        { status: 503 },
      );
    }
    const message = e instanceof Error ? e.message : "提交剪辑失败";
    const status = /不能超过|至少需要|须为 HTTPS|过长|Invalid|required/i.test(
      message,
    )
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
