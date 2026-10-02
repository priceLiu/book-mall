import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { isBrandViStepId } from "@/lib/ecom/ecom-brand-vi-steps";
import {
  patchBrandViSlotPrompts,
  resetBrandViStepSlots,
} from "@/lib/ecom/ecom-brand-vi-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; stepId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id, stepId } = await ctx.params;
  if (!isBrandViStepId(stepId)) {
    return ecomJson({ error: "未知步骤" }, { status: 400 });
  }

  let body: { items?: unknown; reset?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return ecomJson({ error: "invalid_json" }, { status: 400 });
  }

  try {
    if (body.reset === true) {
      const project = await resetBrandViStepSlots(auth.userId, id, stepId);
      return ecomJson({ project });
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
      return ecomJson({ error: "缺少 items" }, { status: 400 });
    }

    const project = await patchBrandViSlotPrompts(auth.userId, id, stepId, items);
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}
