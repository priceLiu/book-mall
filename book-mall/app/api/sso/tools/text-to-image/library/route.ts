import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { TOOL_IMAGE_LIBRARY_DEFAULT_MAX } from "@/lib/tool-library-quota";
import { prismaErrorCode } from "@/lib/ai-fit-db-error";
import { deleteManagedOssObjectByUrl } from "@/lib/oss-delete-object";
import { prisma } from "@/lib/prisma";
import { requireToolsJwtSecret } from "@/lib/sso-tools-env";
import { verifyToolsAccessToken, type VerifiedToolsToken } from "@/lib/tools-sso-token";
import {
  resolveTenantContextForUser,
  tenantContextFromClaims,
  type TenantContext,
} from "@/lib/tenant/context";
import {
  buildVisibleAssetWhere,
  setAssetVisibility,
  AssetAccessError,
} from "@/lib/tenant/asset-sharing-service";
import { TenantPermissionError } from "@/lib/tenant/permission";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_URL_LEN = 8192;
const MAX_PROMPT_LEN = 2000;

function verifyBearer(req: Request):
  | { ok: true; userId: string; token: VerifiedToolsToken }
  | { ok: false; res: NextResponse } {
  let jwtSecret: string;
  try {
    jwtSecret = requireToolsJwtSecret();
  } catch {
    return {
      ok: false,
      res: NextResponse.json({ error: "JWT 密钥未配置" }, { status: 503 }),
    };
  }
  const auth = req.headers.get("authorization");
  const raw =
    auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!raw) {
    return {
      ok: false,
      res: NextResponse.json({ error: "缺少 Bearer Token" }, { status: 401 }),
    };
  }
  const verified = verifyToolsAccessToken(raw, jwtSecret);
  if (!verified) {
    return {
      ok: false,
      res: NextResponse.json({ error: "无效或过期的工具令牌" }, { status: 401 }),
    };
  }
  return { ok: true, userId: verified.sub, token: verified };
}

/** 由 JWT 声明构造租户上下文，旧 token 回落 DB 解析。 */
async function resolveCtx(token: VerifiedToolsToken): Promise<TenantContext | null> {
  return (
    tenantContextFromClaims(token) ??
    (await resolveTenantContextForUser(token.sub))
  );
}

function coerceHttpsAliyun(raw: string): string {
  try {
    const u = new URL(raw.trim());
    if (u.protocol === "http:" && /\.aliyuncs\.com$/i.test(u.hostname)) {
      u.protocol = "https:";
      return u.href;
    }
    return u.href;
  } catch {
    return raw.trim();
  }
}

function takeHttpsUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const coerced = coerceHttpsAliyun(raw);
  const t = coerced.trim();
  if (!t) return null;
  if (t.length > MAX_URL_LEN) return null;
  if (!/^https:\/\//i.test(t)) return null;
  return t;
}

export async function GET(req: Request) {
  const v = verifyBearer(req);
  if (!v.ok) return v.res;

  try {
    const ctx = await resolveCtx(v.token);
    const isTeam = ctx?.tenantType === "TEAM";
    const where: Prisma.TextToImageLibraryItemWhereInput =
      isTeam && ctx
        ? buildVisibleAssetWhere<Prisma.TextToImageLibraryItemWhereInput>(ctx)
        : { userId: v.userId };
    const canManagePublic = ctx?.role === "OWNER" || ctx?.role === "ADMIN";

    const [rows, countAll] = await Promise.all([
      prisma.textToImageLibraryItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.textToImageLibraryItem.count({ where }),
    ]);

    return NextResponse.json({
      space: isTeam ? "TEAM" : "PERSONAL",
      canManagePublic,
      items: rows.map((r) => {
        const mine = (r.ownerUserId ?? r.userId) === v.userId;
        return {
          id: r.id,
          imageUrl: r.imageUrl,
          prompt: r.prompt ?? null,
          createdAt: r.createdAt.toISOString(),
          visibility: r.visibility,
          mine,
          canToggle: isTeam && (mine || canManagePublic),
        };
      }),
      quota: { max: TOOL_IMAGE_LIBRARY_DEFAULT_MAX, used: countAll },
    });
  } catch (e) {
    const code = prismaErrorCode(e);
    if (code === "P2021") {
      return NextResponse.json(
        { items: [], error: "数据库尚未迁移，请联系管理员执行 prisma migrate deploy。" },
        { status: 503 },
      );
    }
    console.error("[text-to-image/library] GET list failed", e);
    const msg =
      e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string"
        ? (e as Error).message
        : "读取图片库失败";
    return NextResponse.json({ items: [], error: msg }, { status: 500 });
  }
}

/** 保存一张文生图成片到图片库 */
export async function POST(req: Request) {
  const v = verifyBearer(req);
  if (!v.ok) return v.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const imageUrl = takeHttpsUrl(body.imageUrl);
  if (!imageUrl) {
    return NextResponse.json(
      {
        error:
          "imageUrl 须为 https 公网 URL（单条最长 8192 字符）；阿里云 OSS 的 http 链会自动升为 https",
      },
      { status: 400 },
    );
  }

  const promptRaw =
    typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_PROMPT_LEN) : "";
  const prompt = promptRaw.length > 0 ? promptRaw : null;

  try {
    const used = await prisma.textToImageLibraryItem.count({
      where: { userId: v.userId },
    });
    if (used >= TOOL_IMAGE_LIBRARY_DEFAULT_MAX) {
      return NextResponse.json(
        {
          error: "image_library_full",
          message: `我的图片库已满（上限 ${TOOL_IMAGE_LIBRARY_DEFAULT_MAX} 张）。可删除旧条目或申请扩容（即将支持）。`,
          max: TOOL_IMAGE_LIBRARY_DEFAULT_MAX,
          used,
        },
        { status: 409 },
      );
    }

    const ctx = await resolveCtx(v.token);
    const row = await prisma.textToImageLibraryItem.create({
      data: {
        userId: v.userId,
        imageUrl,
        prompt,
        tenantId: ctx?.tenantId ?? null,
        ownerUserId: v.userId,
        visibility: "PRIVATE",
      },
    });
    return NextResponse.json({
      item: {
        id: row.id,
        imageUrl: row.imageUrl,
        prompt: row.prompt ?? null,
        createdAt: row.createdAt.toISOString(),
        visibility: row.visibility,
      },
      quota: { max: TOOL_IMAGE_LIBRARY_DEFAULT_MAX, used: used + 1 },
    });
  } catch (e) {
    const code = prismaErrorCode(e);
    if (code === "P2021") {
      return NextResponse.json(
        { error: "数据库尚未迁移，请联系管理员执行 prisma migrate deploy。" },
        { status: 503 },
      );
    }
    if (code === "P2003") {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }
    console.error("[text-to-image/library] POST create failed", e);
    const msg =
      e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string"
        ? (e as Error).message
        : "保存失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** 删除一条记录（仅限本人） */
export async function DELETE(req: Request) {
  const v = verifyBearer(req);
  if (!v.ok) return v.res;

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  try {
    const ctx = await resolveCtx(v.token);
    const canManagePublic = ctx?.role === "OWNER" || ctx?.role === "ADMIN";
    const found = await prisma.textToImageLibraryItem.findUnique({
      where: { id },
      select: {
        id: true,
        imageUrl: true,
        userId: true,
        ownerUserId: true,
        tenantId: true,
        visibility: true,
      },
    });
    const mine = found && (found.ownerUserId ?? found.userId) === v.userId;
    const teamManageable =
      found &&
      ctx?.tenantType === "TEAM" &&
      found.tenantId === ctx.tenantId &&
      found.visibility === "TEAM_PUBLIC" &&
      canManagePublic;
    const row = found && (mine || teamManageable) ? found : null;
    if (!row) {
      return NextResponse.json({ error: "不存在或无权删除" }, { status: 404 });
    }

    const oss = await deleteManagedOssObjectByUrl(row.imageUrl);
    if (!oss.ok) {
      return NextResponse.json({ error: oss.error }, { status: 502 });
    }

    await prisma.textToImageLibraryItem.delete({ where: { id: row.id } });
    return NextResponse.json({ ok: true, ossDeleted: oss.deleted });
  } catch (e) {
    const code = prismaErrorCode(e);
    if (code === "P2021") {
      return NextResponse.json(
        { error: "数据库尚未迁移，请联系管理员执行 prisma migrate deploy。" },
        { status: 503 },
      );
    }
    console.error("[text-to-image/library] DELETE failed", e);
    const msg =
      e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string"
        ? (e as Error).message
        : "删除失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** 切换条目可见域（设为团队公共 / 收回私有）；仅团队空间可用。 */
export async function PATCH(req: Request) {
  const v = verifyBearer(req);
  if (!v.ok) return v.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const visibility = body.visibility === "TEAM_PUBLIC" ? "TEAM_PUBLIC" : "PRIVATE";
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const ctx = await resolveCtx(v.token);
  if (!ctx || ctx.tenantType !== "TEAM") {
    return NextResponse.json({ error: "个人空间无团队公共库" }, { status: 400 });
  }

  try {
    await setAssetVisibility({
      ctx,
      model: "textToImageLibraryItem",
      assetId: id,
      visibility,
    });
    return NextResponse.json({ ok: true, visibility });
  } catch (e) {
    if (e instanceof TenantPermissionError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof AssetAccessError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    console.error("[text-to-image/library] PATCH visibility failed", e);
    return NextResponse.json({ error: "切换可见域失败" }, { status: 500 });
  }
}
