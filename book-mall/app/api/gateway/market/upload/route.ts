import { NextResponse, type NextRequest } from "next/server";

import { marketPlaygroundUploadDataUrl } from "@/lib/gateway/market-playground-service";
import { requireGatewaySessionUser } from "@/lib/gateway/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: { dataUrl?: string; kind?: "image" | "video" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.dataUrl?.trim()) {
    return NextResponse.json({ error: "dataUrl required" }, { status: 400 });
  }

  const kind = body.kind === "video" ? "video" : "image";

  try {
    const result = await marketPlaygroundUploadDataUrl(user, {
      dataUrl: body.dataUrl,
      kind,
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
