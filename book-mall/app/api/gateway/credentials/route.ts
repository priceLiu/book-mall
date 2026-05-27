import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createGatewayCredential,
  deleteGatewayCredential,
  listGatewayCredentials,
} from "@/lib/gateway/credential-service";
import { requireGatewaySessionUser } from "@/lib/gateway/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const credentials = await listGatewayCredentials(user.id);
  return NextResponse.json({ credentials });
}

const createSchema = z.object({
  alias: z.string().min(1).max(60),
  providerKind: z.enum(["KIE", "BAILIAN", "DEEPSEEK"]),
  apiKey: z.string().min(8),
  baseUrl: z.string().url().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }
  try {
    const row = await createGatewayCredential({
      userId: user.id,
      ...parsed.data,
    });
    return NextResponse.json({ credential: { id: row.id, alias: row.alias } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  const ok = await deleteGatewayCredential(user.id, id);
  if (!ok) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
