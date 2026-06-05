import { NextResponse } from "next/server";

import { resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import {
  listEcomStoryboardChatModels,
  listEcomStoryboardImageModels,
  listEcomStoryboardVideoModels,
} from "@/lib/gateway/ecom-storyboard-chat-models";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const gw = await resolveEcomGatewayAuthForUser(auth.userId);
  const boundKinds = gw?.credentials.map((c) => c.providerKind) ?? [];

  return NextResponse.json({
    chatModels: listEcomStoryboardChatModels(boundKinds),
    imageModels: listEcomStoryboardImageModels(boundKinds),
    videoModels: listEcomStoryboardVideoModels(boundKinds),
  });
}
