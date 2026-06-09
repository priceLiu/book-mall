import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { testGatewayCredential } from "@/lib/gateway/credential-service";
import { resolveGatewayCredentialScope } from "@/lib/gateway/platform-credential-delegate";
import { requireGatewaySessionUser } from "@/lib/gateway/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  id: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const scope = await resolveGatewayCredentialScope(user);
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }
  const result = await testGatewayCredential(scope.effectiveGatewayUserId, parsed.data.id);
  if (!result.found) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
  return NextResponse.json({ ok: result.ok, message: result.message });
}
