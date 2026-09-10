import { NextResponse } from "next/server";

import {
  clearEcomVtonTextTryonEditor,
  patchEcomVtonTextTryonEditor,
} from "@/lib/ecom/ecom-vton-text-tryon";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  try {
    const project = await patchEcomVtonTextTryonEditor(auth.userId, id, {
      prompt: typeof body.prompt === "string" ? body.prompt : undefined,
      modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
    });
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = bodyFromReq(await req.json());
  } catch {
    body = {};
  }

  if (body.action === "clear") {
    try {
      const project = await clearEcomVtonTextTryonEditor(auth.userId, id);
      return NextResponse.json({ project });
    } catch (e) {
      const message = e instanceof Error ? e.message : "清空失败";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "未知 action" }, { status: 400 });
}

function bodyFromReq(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}
