import { NextResponse } from "next/server";
import { requireToolsJwtSecret } from "@/lib/sso-tools-env";
import { verifyToolsAccessToken } from "@/lib/tools-sso-token";
import { resolveSchemeARetailMultiplierForToolModel } from "@/lib/tool-scheme-a-resolve-retail-multiplier";

export const dynamic = "force-dynamic";

function verifyBearer(req: Request):
  | { ok: true; userId: string }
  | { ok: false; res: NextResponse } {
  let jwtSecret: string;
  try {
    jwtSecret = requireToolsJwtSecret();
  } catch {
    return {
      ok: false,
      res: NextResponse.json({ error: "JWT 密钥未配置" }, { status: 503 }),
    };
  }
  const auth = req.headers.get("authorization");
  const raw =
    auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!raw) {
    return {
      ok: false,
      res: NextResponse.json({ error: "缺少 Bearer Token" }, { status: 401 }),
    };
  }
  const verified = verifyToolsAccessToken(raw, jwtSecret);
  if (!verified) {
    return {
      ok: false,
      res: NextResponse.json({ error: "无效或过期的工具令牌" }, { status: 401 }),
    };
  }
  return { ok: true, userId: verified.sub };
}

/** 工具站方案 A：零售系数来自当前生效的 ToolBillablePrice（toolKey + schemeARefModelKey = modelKey）。须传 `toolKey` 与 `modelKey`。 */
export async function GET(req: Request) {
  const v = verifyBearer(req);
  if (!v.ok) return v.res;

  const url = new URL(req.url);
  const toolKey = url.searchParams.get("toolKey")?.trim() || undefined;
  const modelKey = url.searchParams.get("modelKey")?.trim() || undefined;

  const resolved = await resolveSchemeARetailMultiplierForToolModel(toolKey, modelKey);
  return NextResponse.json({
    multiplier: resolved.multiplier,
    billablePriceId: resolved.billablePriceId,
    toolKey: resolved.toolKey,
    modelKey: resolved.modelKey,
    effectiveFrom: resolved.effectiveFrom,
    effectiveTo: resolved.effectiveTo,
    source: resolved.source,
    /** @deprecated 已无全局规则表，恒为 null */
    ruleId: null,
    /** @deprecated 已无按模型覆盖表，恒为 null */
    overrideId: null,
  });
}
