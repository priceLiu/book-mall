import { NextResponse } from "next/server";

import type { EcomImageRatio } from "@/lib/ecom/ecom-platform-spec";
import {
  generateProductDesignImages,
  type ProductDesignImageTarget,
} from "@/lib/ecom/ecom-product-design-image";
import { getProductDesignProject } from "@/lib/ecom/ecom-product-design-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

const RATIOS: EcomImageRatio[] = ["1:1", "3:4", "4:5", "16:9"];

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
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const target: ProductDesignImageTarget = body.target === "detail" ? "detail" : "main";
  const indexes = Array.isArray(body.indexes)
    ? body.indexes
        .map((v) => (typeof v === "number" ? v : Number.parseInt(String(v), 10)))
        .filter((n) => Number.isFinite(n) && n > 0)
    : undefined;
  const modelKey = typeof body.modelKey === "string" ? body.modelKey : undefined;
  const ratio = RATIOS.includes(body.ratio as EcomImageRatio)
    ? (body.ratio as EcomImageRatio)
    : undefined;
  const concurrency =
    typeof body.concurrency === "number" && body.concurrency >= 1
      ? Math.min(5, Math.round(body.concurrency))
      : undefined;

  try {
    const result = await generateProductDesignImages({
      userId: auth.userId,
      projectId: id,
      target,
      indexes,
      modelKey,
      ratio,
      concurrency,
    });
    const project = await getProductDesignProject(auth.userId, id);
    return NextResponse.json({
      project,
      generated: result.generated,
      failures: result.failures,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    const status = message.includes("不存在") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
