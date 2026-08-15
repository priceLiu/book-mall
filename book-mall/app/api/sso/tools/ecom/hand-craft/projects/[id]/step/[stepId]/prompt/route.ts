import { NextResponse } from "next/server";

import { isHandCraftStepId } from "@/lib/ecom/ecom-hand-craft-steps";
import {
  patchHandCraftSlotPrompts,
  resetHandCraftStepSlots,
} from "@/lib/ecom/ecom-hand-craft-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; stepId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id, stepId } = await ctx.params;
  if (!isHandCraftStepId(stepId)) {
    return NextResponse.json({ error: "未知步骤" }, { status: 400 });
  }

  let body: { items?: unknown; reset?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    if (body.reset === true) {
      const project = await resetHandCraftStepSlots(auth.userId, id, stepId);
      return NextResponse.json({ project });
    }

    const items = Array.isArray(body.items)
      ? body.items.flatMap((raw) => {
          if (!raw || typeof raw !== "object") return [];
          const r = raw as Record<string, unknown>;
          const index = Number(r.index);
          if (!Number.isInteger(index) || index <= 0) return [];
          return [
            {
              index,
              title: typeof r.title === "string" ? r.title : undefined,
              prompt: typeof r.prompt === "string" ? r.prompt : undefined,
            },
          ];
        })
      : [];
    if (items.length === 0) {
      return NextResponse.json({ error: "缺少 items" }, { status: 400 });
    }

    const project = await patchHandCraftSlotPrompts(auth.userId, id, stepId, items);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
