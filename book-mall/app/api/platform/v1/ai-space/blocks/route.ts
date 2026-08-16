import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import {
  createSpaceBlock,
  deleteSpaceBlock,
  isAiSpaceSpaceError,
  updateSpaceBlock,
} from "@/lib/ai-space/ai-space-space-service";
import type { AiSpaceBlockRefInput } from "@/lib/ai-space/ai-space-space-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 解析 refs 入参；非数组视为未传 */
function readRefs(raw: unknown): AiSpaceBlockRefInput[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    return {
      sourceType: o.sourceType as AiSpaceBlockRefInput["sourceType"],
      sourceId: typeof o.sourceId === "string" ? o.sourceId.trim() : "",
      sourceApp: typeof o.sourceApp === "string" ? o.sourceApp : undefined,
      slotKey: typeof o.slotKey === "string" ? o.slotKey : undefined,
      caption: typeof o.caption === "string" ? o.caption : null,
    };
  });
}

/** 新增块 / 挂件 */
export async function POST(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const blockType = typeof body.blockType === "string" ? body.blockType : "";
  if (!blockType) {
    return NextResponse.json({ error: "缺少 blockType" }, { status: 400 });
  }

  try {
    const block = await createSpaceBlock(auth.actor.userId, {
      blockType,
      sizeTier: typeof body.sizeTier === "string" ? body.sizeTier : undefined,
      config: "config" in body ? body.config : undefined,
      content: "content" in body ? body.content : undefined,
      refs: readRefs(body.refs),
      layoutX: typeof body.layoutX === "number" ? body.layoutX : undefined,
      layoutY: typeof body.layoutY === "number" ? body.layoutY : undefined,
    });
    return NextResponse.json({ ok: true, block });
  } catch (e) {
    if (isAiSpaceSpaceError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/blocks] POST failed", e);
    return NextResponse.json({ error: "新增块失败" }, { status: 500 });
  }
}

/** 改块：尺寸档位 / 配置 / 正文 / 引用素材 */
export async function PATCH(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "缺少块 id" }, { status: 400 });

  try {
    const block = await updateSpaceBlock(auth.actor.userId, {
      id,
      sizeTier: typeof body.sizeTier === "string" ? body.sizeTier : undefined,
      config: "config" in body ? body.config : undefined,
      content: "content" in body ? body.content : undefined,
      refs: readRefs(body.refs),
    });
    return NextResponse.json({ ok: true, block });
  } catch (e) {
    if (isAiSpaceSpaceError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/blocks] PATCH failed", e);
    return NextResponse.json({ error: "更新块失败" }, { status: 500 });
  }
}

/** 删块（不影响源素材与作品墙素材抽屉） */
export async function DELETE(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "缺少块 id" }, { status: 400 });

  try {
    await deleteSpaceBlock(auth.actor.userId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isAiSpaceSpaceError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/blocks] DELETE failed", e);
    return NextResponse.json({ error: "删除块失败" }, { status: 500 });
  }
}
