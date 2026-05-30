import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createGatewayApiKey,
  maskGatewayApiKey,
} from "@/lib/gateway/api-key-service";
import { resolveGatewayBookRole } from "@/lib/gateway/book-role";
import {
  PERSONAL_KEY_DEFAULT_NAME,
  PLATFORM_ADMIN_KEY_NAME,
} from "@/lib/gateway/key-scope";
import { requireGatewaySessionUser } from "@/lib/gateway/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const bookRole = await resolveGatewayBookRole(user);
  const rows = await prisma.gatewayApiKey.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: [{ scope: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({
    bookRole,
    apiKeys: rows.map((r) => ({
      id: r.id,
      name: r.name,
      scope: r.scope,
      keyMasked: maskGatewayApiKey(r.keyPrefix),
      createdAt: r.createdAt.toISOString(),
      spendLimitUsd: r.spendLimitUsd?.toString() ?? null,
      ipWhitelist: r.ipWhitelist,
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  scope: z.enum(["PLATFORM", "PERSONAL"]).optional(),
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

  const scope = parsed.data.scope ?? "PERSONAL";
  const bookRole = await resolveGatewayBookRole(user);

  if (scope === "PLATFORM" && bookRole !== "ADMIN") {
    return NextResponse.json(
      { error: "仅 Book 管理员可创建 Platform Admin 密钥" },
      { status: 403 },
    );
  }

  if (scope === "PLATFORM") {
    const existingPlatform = await prisma.gatewayApiKey.findFirst({
      where: { userId: user.id, scope: "PLATFORM", revokedAt: null },
      select: { id: true },
    });
    if (existingPlatform) {
      return NextResponse.json(
        { error: "已存在 Platform Admin 密钥，请先撤销后再创建" },
        { status: 409 },
      );
    }
  }

  const defaultName =
    scope === "PLATFORM" ? PLATFORM_ADMIN_KEY_NAME : PERSONAL_KEY_DEFAULT_NAME;
  const name = parsed.data.name?.trim() || defaultName;

  const { apiKey, rawKey } = await createGatewayApiKey({
    userId: user.id,
    name,
    scope,
    credentialIds: parsed.data.credentialIds,
    ipWhitelist: parsed.data.ipWhitelist,
    spendLimitUsd: parsed.data.spendLimitUsd ?? undefined,
  });
  return NextResponse.json({
    apiKey: {
      id: apiKey.id,
      name: apiKey.name,
      scope: apiKey.scope,
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

  const bookRole = await resolveGatewayBookRole(user);
  if (row.scope === "PLATFORM" && bookRole !== "ADMIN") {
    return NextResponse.json(
      { error: "仅 Book 管理员可撤销 Platform Admin 密钥" },
      { status: 403 },
    );
  }

  await prisma.gatewayApiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
