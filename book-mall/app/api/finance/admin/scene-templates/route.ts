import { NextRequest } from "next/server";

import { canManagePricing, canViewFinanceCost } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { prisma } from "@/lib/prisma";
import {
  bindCanonicalToTemplate,
  ensureDefaultSceneTemplates,
  listSceneTemplatesAdmin,
  publishModelTemplateCatalog,
  setSceneTemplateStatus,
  setTemplateModelStatus,
} from "@/lib/platform-model/scene-templates";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "场景模板仅财务管理员可见");
  }

  await ensureDefaultSceneTemplates();
  const templates = await listSceneTemplatesAdmin();

  const offerings = await prisma.appModelOffering.findMany({
    where: { status: "ACTIVE" },
    select: {
      canonicalModelKey: true,
      displayName: true,
      activeModelKey: true,
      publishedCreditsPerUnit: true,
    },
    orderBy: { canonicalModelKey: "asc" },
  });
  const priced = await prisma.modelCreditPrice.findMany({
    where: {
      active: true,
      canonicalModelKey: { in: offerings.map((o) => o.canonicalModelKey) },
    },
    select: { canonicalModelKey: true },
  });
  const pricedSet = new Set(priced.map((p) => p.canonicalModelKey));
  const bindableCanonicals = offerings
    .filter((o) => pricedSet.has(o.canonicalModelKey) && o.activeModelKey)
    .map((o) => ({
      canonicalModelKey: o.canonicalModelKey,
      displayName: o.displayName,
      activeModelKey: o.activeModelKey,
      creditsPerUnit:
        o.publishedCreditsPerUnit != null ? Number(o.publishedCreditsPerUnit) : null,
    }));

  return financeJson(request, { templates, bindableCanonicals });
}

export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canManagePricing(user.role)) {
    return financeForbidden(request, "需要定价管理员权限");
  }

  let body: {
    action?: string;
    templateId?: string;
    canonicalModelKey?: string;
    status?: string;
    sortOrder?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return financeJson(request, { ok: false, error: "invalid_json" }, { status: 400 });
  }

  const action = body.action?.trim();

  try {
    if (action === "ensure") {
      await ensureDefaultSceneTemplates();
      return financeJson(request, { ok: true });
    }

    if (action === "setTemplateStatus") {
      if (!body.templateId || (body.status !== "ACTIVE" && body.status !== "DEPRECATED")) {
        return financeJson(request, { ok: false, error: "参数无效" }, { status: 400 });
      }
      const r = await setSceneTemplateStatus({
        templateId: body.templateId,
        status: body.status,
      });
      return financeJson(request, r, { status: r.ok ? 200 : 400 });
    }

    if (action === "bind") {
      if (!body.templateId || !body.canonicalModelKey) {
        return financeJson(request, { ok: false, error: "参数无效" }, { status: 400 });
      }
      const r = await bindCanonicalToTemplate({
        templateId: body.templateId,
        canonicalModelKey: body.canonicalModelKey,
        sortOrder: body.sortOrder,
      });
      return financeJson(request, r, { status: r.ok ? 200 : 400 });
    }

    if (action === "setModelStatus") {
      if (
        !body.templateId ||
        !body.canonicalModelKey ||
        (body.status !== "ACTIVE" &&
          body.status !== "HIDDEN" &&
          body.status !== "DEPRECATED")
      ) {
        return financeJson(request, { ok: false, error: "参数无效" }, { status: 400 });
      }
      const r = await setTemplateModelStatus({
        templateId: body.templateId,
        canonicalModelKey: body.canonicalModelKey,
        status: body.status,
      });
      return financeJson(request, r, { status: r.ok ? 200 : 400 });
    }

    if (action === "publish") {
      const result = await publishModelTemplateCatalog({ publishedBy: user.id });
      return financeJson(request, { ok: true, ...result });
    }

    return financeJson(request, { ok: false, error: "未知 action" }, { status: 400 });
  } catch (e) {
    return financeJson(
      request,
      { ok: false, error: e instanceof Error ? e.message : "操作失败" },
      { status: 400 },
    );
  }
}
