import { NextResponse, type NextRequest } from "next/server";

import { listGatewayCredentials } from "@/lib/gateway/credential-service";
import { buildGatewayModelCatalogFromDb } from "@/lib/gateway/model-registry";
import { requireGatewaySessionUser } from "@/lib/gateway/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const credentials = await listGatewayCredentials(user.id);
  const boundKinds = [...new Set(credentials.map((c) => c.providerKind))];

  const catalog = await buildGatewayModelCatalogFromDb(boundKinds);
  return NextResponse.json(catalog);
}
