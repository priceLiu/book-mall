import { NextResponse } from "next/server";
import { resolveBillablePriceMinor } from "@/lib/tool-billable-price";
import { requireToolsJwtSecret } from "@/lib/sso-tools-env";
import { verifyToolsAccessToken } from "@/lib/tools-sso-token";

export const dynamic = "force-dynamic";

const MAX_TOOL_KEY = 64;
const MAX_ACTION = 64;

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

/** 工具站展示用：当前生效的按次单价（分 / 元），与计费结算同源 `resolveBillablePriceMinor`。 */
export async function GET(req: Request) {
  const v = verifyBearer(req);
  if (!v.ok) return v.res;

  const url = new URL(req.url);
  const toolKey = url.searchParams.get("toolKey")?.trim() ?? "";
  const action = url.searchParams.get("action")?.trim() ?? "";

  if (!toolKey || toolKey.length > MAX_TOOL_KEY) {
    return NextResponse.json({ error: "toolKey 无效" }, { status: 400 });
  }
  if (!action || action.length > MAX_ACTION) {
    return NextResponse.json({ error: "action 无效" }, { status: 400 });
  }

  const priceMinor = await resolveBillablePriceMinor(toolKey, action);
  if (priceMinor == null) {
    return NextResponse.json(
      { error: "未找到当前生效单价，请在管理后台「工具管理」配置" },
      { status: 404 },
    );
  }

  const yuan = Math.round(priceMinor) / 100;
  return NextResponse.json({
    toolKey,
    action,
    priceMinor,
    yuan,
  });
}
