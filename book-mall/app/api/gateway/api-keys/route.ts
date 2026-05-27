import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createGatewayApiKey,
  maskGatewayApiKey,
} from "@/lib/gateway/api-key-service";
import { requireGatewaySessionUser } from "@/lib/gateway/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const rows = await prisma.gatewayApiKey.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    apiKeys: rows.map((r) => ({
      id: r.id,
      name: r.name,
      keyMasked: maskGatewayApiKey(r.keyPrefix),
      createdAt: r.createdAt.toISOString(),
      spendLimitUsd: r.spendLimitUsd?.toString() ?? null,
      ipWhitelist: r.ipWhitelist,
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(60),
  credentialIds: z.array(z.string()).optional(),
  ipWhitelist: z.array(z.string()).optional(),
  spendLimitUsd: z.number().positive().optional().nullable(),
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
  const { apiKey, rawKey } = await createGatewayApiKey({
    userId: user.id,
    name: parsed.data.name,
    credentialIds: parsed.data.credentialIds,
    ipWhitelist: parsed.data.ipWhitelist,
    spendLimitUsd: parsed.data.spendLimitUsd ?? undefined,
  });
  return NextResponse.json({
    apiKey: {
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey,
      keyMasked: maskGatewayApiKey(apiKey.keyPrefix),
    },
  });
}

export async function DELETE(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  const row = await prisma.gatewayApiKey.findFirst({
    where: { id, userId: user.id, revokedAt: null },
  });
  if (!row) return NextResponse.json({ error: "未找到" }, { status: 404 });
  await prisma.gatewayApiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
