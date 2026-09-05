import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import {
  createPin,
  deletePin,
  isAiSpacePinError,
  listPins,
  updatePinCaption,
} from "@/lib/ai-space/ai-space-pin-service";
import { isAiSpacePinSourceType } from "@/lib/ai-space/ai-space-pin-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 作品墙列表 */
export async function GET(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const rawType = url.searchParams.get("sourceType")?.trim();
  if (rawType && !isAiSpacePinSourceType(rawType)) {
    return NextResponse.json({ error: "不支持的 sourceType" }, { status: 400 });
  }

  try {
    const entries = await listPins(auth.actor.userId, {
      sourceType: rawType && isAiSpacePinSourceType(rawType) ? rawType : undefined,
    });
    return NextResponse.json({ entries });
  } catch (e) {
    console.error("[ai-space/pins] GET failed", e);
    return NextResponse.json({ error: "读取作品墙失败" }, { status: 500 });
  }
}

/** 展示到作品墙 */
export async function POST(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const sourceType = body.sourceType;
  if (!isAiSpacePinSourceType(sourceType)) {
    return NextResponse.json({ error: "不支持的 sourceType" }, { status: 400 });
  }
  const sourceId = typeof body.sourceId === "string" ? body.sourceId.trim() : "";
  if (!sourceId) {
    return NextResponse.json({ error: "缺少 sourceId" }, { status: 400 });
  }

  try {
    const res = await createPin({
      userId: auth.actor.userId,
      sourceType,
      sourceId,
      sourceApp: typeof body.sourceApp === "string" ? body.sourceApp : undefined,
      caption: typeof body.caption === "string" ? body.caption : null,
    });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    if (isAiSpacePinError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/pins] POST failed", e);
    return NextResponse.json({ error: "展示失败" }, { status: 500 });
  }
}

/** 改展示标题 */
export async function PATCH(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }
  const pinId = typeof body.pinId === "string" ? body.pinId.trim() : "";
  if (!pinId) return NextResponse.json({ error: "缺少 pinId" }, { status: 400 });

  try {
    await updatePinCaption(
      auth.actor.userId,
      pinId,
      typeof body.caption === "string" ? body.caption : null,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isAiSpacePinError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/pins] PATCH failed", e);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

/** 取消展示（不删源作品） */
export async function DELETE(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const pinId = url.searchParams.get("pinId")?.trim();
  if (!pinId) return NextResponse.json({ error: "缺少 pinId" }, { status: 400 });

  try {
    await deletePin(auth.actor.userId, pinId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isAiSpacePinError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/pins] DELETE failed", e);
    return NextResponse.json({ error: "取消展示失败" }, { status: 500 });
  }
}
