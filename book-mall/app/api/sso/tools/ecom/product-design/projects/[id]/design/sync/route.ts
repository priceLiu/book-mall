import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  getProductDesignProject,
  updateProductDesignProject,
} from "@/lib/ecom/ecom-product-design-service";
import { extractProductDesignJson } from "@/lib/ecom/ecom-product-design-types";
import { parseMarketingPlansFromMarkdown } from "@/lib/ecom/ecom-product-design-marketing-parse";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * 手动重解析：助手回复里的 product-design 围栏在流式落库时若被截断，
 * 用户可在右侧点「重新解析」，用最近一次原文重新提取结构化设计稿。
 */
export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* 允许空 body，回落到 meta.lastAssistantRaw */
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await getProductDesignProject(auth.userId, id);
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    const raw =
      typeof body.raw === "string" && body.raw.trim()
        ? body.raw
        : typeof project.meta?.lastAssistantRaw === "string"
          ? (project.meta.lastAssistantRaw as string)
          : project.chatHistory.filter((m) => m.role === "assistant").at(-1)?.content ?? "";

    const designPatch =
      extractProductDesignJson(raw) ??
      (() => {
        const plans = parseMarketingPlansFromMarkdown(raw);
        return plans.length ? { marketingPlans: plans } : null;
      })();

    if (!designPatch) {
      return NextResponse.json(
        { error: "未能从助手回复中解析出设计稿，请让助手重新输出" },
        { status: 422 },
      );
    }

    const updated = await updateProductDesignProject(auth.userId, id, { designPatch });
    return NextResponse.json({ project: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "解析失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
