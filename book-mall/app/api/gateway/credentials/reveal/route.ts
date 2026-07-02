import { NextResponse, type NextRequest } from "next/server";

import {
  getDecryptedCredentialApiKey,
  getGatewayCredentialForUser,
} from "@/lib/gateway/credential-service";
import { resolveGatewayCredentialScope } from "@/lib/gateway/platform-credential-delegate";
import { requireGatewaySessionUser } from "@/lib/gateway/session";

export const dynamic = "force-dynamic";

/** 查看厂商凭证完整 Key（仅凭证所属 Gateway 账号） */
export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const scope = await resolveGatewayCredentialScope(user);
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const row = await getGatewayCredentialForUser(scope.effectiveGatewayUserId, id);
  if (!row) return NextResponse.json({ error: "未找到" }, { status: 404 });

  const decrypted = await getDecryptedCredentialApiKey(id);
  if (!decrypted) {
    return NextResponse.json({ error: "凭证不可用" }, { status: 404 });
  }

  return NextResponse.json({ apiKey: decrypted.apiKey });
}
