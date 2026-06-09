import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  cloneGatewayCredential,
  createGatewayCredential,
  deleteGatewayCredential,
  GATEWAY_PROVIDER_KINDS,
  listGatewayCredentials,
  setDefaultGatewayCredential,
  testGatewayCredential,
  updateGatewayCredential,
} from "@/lib/gateway/credential-service";
import { resolveGatewayCredentialScope } from "@/lib/gateway/platform-credential-delegate";
import { requireGatewaySessionUser } from "@/lib/gateway/session";

export const dynamic = "force-dynamic";

const providerKindSchema = z.enum(GATEWAY_PROVIDER_KINDS);

export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const scope = await resolveGatewayCredentialScope(user);
  const credentials = await listGatewayCredentials(scope.effectiveGatewayUserId);
  return NextResponse.json({
    credentials,
    platformPoolDelegate: scope.isPlatformPoolDelegate
      ? { canonicalOwnerEmail: scope.canonicalOwnerEmail }
      : null,
  });
}

const createSchema = z.object({
  alias: z.string().min(1).max(60),
  providerKind: providerKindSchema,
  apiKey: z.string().min(8),
  baseUrl: z.string().url().optional().nullable(),
  channel: z.string().max(60).optional().nullable(),
  sortOrder: z.number().int().optional(),
  isDefaultForProvider: z.boolean().optional(),
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
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }
  try {
    const row = await createGatewayCredential({
      userId: scope.effectiveGatewayUserId,
      ...parsed.data,
    });
    return NextResponse.json({ credential: { id: row.id, alias: row.alias } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  alias: z.string().min(1).max(60).optional(),
  baseUrl: z.string().url().nullable().optional(),
  active: z.boolean().optional(),
  apiKey: z.string().min(8).optional(),
  channel: z.string().max(60).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isDefaultForProvider: z.boolean().optional(),
  /** action=setDefault：设为该厂商默认凭证 */
  action: z.literal("setDefault").optional(),
});

export async function PATCH(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const scope = await resolveGatewayCredentialScope(user);
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }
  const { id, action, ...patch } = parsed.data;
  if (action === "setDefault") {
    const ok = await setDefaultGatewayCredential(scope.effectiveGatewayUserId, id);
    if (!ok) return NextResponse.json({ error: "未找到" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  const row = await updateGatewayCredential(scope.effectiveGatewayUserId, id, patch);
  if (!row) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const scope = await resolveGatewayCredentialScope(user);
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  const ok = await deleteGatewayCredential(scope.effectiveGatewayUserId, id);
  if (!ok) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
