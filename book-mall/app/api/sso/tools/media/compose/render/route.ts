import { MediaRenderSourceApp } from "@prisma/client";
import { NextResponse } from "next/server";

import { MediaRenderUnavailableError } from "@/lib/media/ffmpeg-preflight";
import {
  createMediaRenderJob,
  enqueueMediaRenderJob,
  getMediaRenderJobForUser,
} from "@/lib/media/media-render-service";
import {
  composeWorkbenchToRenderPayload,
  parsePlatformComposeWorkbenchFromMeta,
  type PlatformComposeWorkbenchState,
} from "@/lib/media/platform-compose-workbench";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = {
  workbench?: unknown;
  /** 工作台 profile 未指定 BGM 时的 preset id（业务侧解析 URL） */
  bgmPresetId?: string;
  bgmUrl?: string;
  sourceRef?: Record<string, unknown>;
};

/**
 * 平台简易剪辑台 · 统一合成入口（timeline + profile 由 workbench 生成）。
 * 与 POST /api/sso/tools/media/render 等价，但接受 composeWorkbench 快照。
 */
export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.workbench) {
    return NextResponse.json({ error: "缺少 workbench" }, { status: 400 });
  }

  const parsed = parsePlatformComposeWorkbenchFromMeta(body.workbench);
  if (!parsed?.orderedClipIds.length) {
    return NextResponse.json({ error: "workbench 无效或为空" }, { status: 400 });
  }

  let state: PlatformComposeWorkbenchState = parsed;
  const directBgm = body.bgmUrl?.trim();
  if (directBgm) {
    state = {
      ...state,
      profile: {
        ...state.profile,
        audio: { ...state.profile?.audio, bgmUrl: directBgm },
      },
    };
  }

  try {
    const { timeline, profile } = composeWorkbenchToRenderPayload(state, {
      fallbackBgmPresetId: body.bgmPresetId,
      resolveBgmPresetUrl: directBgm
        ? () => directBgm
        : undefined,
    });

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
    const status = /至少需要|Invalid|required/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
