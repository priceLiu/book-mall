import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { runPosterAutoPlan } from "@/lib/ecom/ecom-poster-service";
import type { PosterEasyPath } from "@/lib/ecom/ecom-poster-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return ecomJson({ error: "invalid_json" }, { status: 400 });
  }
  const easyPath = body.easyPath as PosterEasyPath;
  if (easyPath !== "A" && easyPath !== "B" && easyPath !== "C" && easyPath !== "D") {
    return ecomJson({ error: "easyPath 无效" }, { status: 400 });
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await runPosterAutoPlan(auth.userId, params.id, {
      easyPath,
      festivalId: typeof body.festivalId === "string" ? body.festivalId : undefined,
      oneLineBrief: typeof body.oneLineBrief === "string" ? body.oneLineBrief : undefined,
    });
    return ecomJson({ project });
  } catch (e) {
    return ecomJson({ error: e instanceof Error ? e.message : "策划失败" }, { status: 400 });
  }
}
