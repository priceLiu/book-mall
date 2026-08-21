/**
 * AI 小智 · 每日 AI 热闻简报（只读 DB，全平台共用）。
 */
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";
import { getPlatformAiNewsBrief } from "@/lib/platform-assistant/ai-news-service";
import { PlatformAssistantGatewayError } from "@/lib/platform-assistant/platform-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveUserId(request: Request): Promise<string | null> {
  const auth = verifyToolsBearer(request);
  if (auth.ok) return auth.userId;
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function GET(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return Response.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const result = await getPlatformAiNewsBrief();
    return Response.json({
      content: result.content,
      dateKey: result.dateKey,
      stale: result.stale,
      generatedAt: result.generatedAt,
      cached: result.cached,
    });
  } catch (e) {
    const status =
      e instanceof PlatformAssistantGatewayError ? e.httpStatus : 502;
    const msg =
      e instanceof PlatformAssistantGatewayError
        ? e.message
        : (e as Error).message;
    return Response.json({ error: msg || "热闻读取失败" }, { status });
  }
}
