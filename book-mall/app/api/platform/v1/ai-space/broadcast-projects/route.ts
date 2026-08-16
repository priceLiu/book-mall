import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import {
  AiSpaceBroadcastError,
  createAiSpaceBroadcastProject,
  deleteAiSpaceBroadcastProject,
  getAiSpaceBroadcastProject,
  listAiSpaceBroadcastProjects,
  updateAiSpaceBroadcastProject,
} from "@/lib/ai-space/ai-space-broadcast-service";
import type { BroadcastBrief } from "@/lib/ai-space/ai-space-broadcast-types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;
  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  try {
    if (id) {
      const project = await getAiSpaceBroadcastProject(auth.actor.userId, id);
      if (!project) {
        return NextResponse.json({ error: "项目不存在" }, { status: 404 });
      }
      return NextResponse.json({ project });
    }
    const projects = await listAiSpaceBroadcastProjects(auth.actor.userId);
    return NextResponse.json({ projects });
  } catch (e) {
    console.error("[ai-space/broadcast-projects] GET failed", e);
    return NextResponse.json({ error: "读取失败" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty ok */
  }
  try {
    const project = await createAiSpaceBroadcastProject({
      userId: auth.actor.userId,
      tenantId: auth.actor.tenantCtx?.tenantId ?? null,
      title: typeof body.title === "string" ? body.title : undefined,
      sourceText: typeof body.sourceText === "string" ? body.sourceText : undefined,
      brief: (body.brief ?? {}) as BroadcastBrief,
      targetDurationSec:
        typeof body.targetDurationSec === "number"
          ? body.targetDurationSec
          : undefined,
      aspectRatio:
        typeof body.aspectRatio === "string" ? body.aspectRatio : undefined,
    });
    return NextResponse.json({ ok: true, project });
  } catch (e) {
    if (e instanceof AiSpaceBroadcastError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/broadcast-projects] POST failed", e);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }
  try {
    const project = await updateAiSpaceBroadcastProject(auth.actor.userId, id, {
      title: typeof body.title === "string" ? body.title : undefined,
      sourceText: typeof body.sourceText === "string" ? body.sourceText : undefined,
      brief: body.brief as BroadcastBrief | undefined,
      targetDurationSec:
        body.targetDurationSec === null
          ? null
          : typeof body.targetDurationSec === "number"
            ? body.targetDurationSec
            : undefined,
      aspectRatio:
        typeof body.aspectRatio === "string" ? body.aspectRatio : undefined,
    });
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, project });
  } catch (e) {
    if (e instanceof AiSpaceBroadcastError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/broadcast-projects] PATCH failed", e);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  try {
    const ok = await deleteAiSpaceBroadcastProject(auth.actor.userId, id);
    if (!ok) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AiSpaceBroadcastError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/broadcast-projects] DELETE failed", e);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
