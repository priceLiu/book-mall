/**
 * 场景模板（规则层）——与厂商路由完全分离。
 * 见 book-mall/doc/product/24-model-scene-templates.md
 */
import type { CreditCostUnit, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const SCENE_TEMPLATE_IDS = [
  "text",
  "t2i",
  "i2i",
  "t2v",
  "i2v",
  "v2v",
] as const;

export type SceneTemplateId = (typeof SCENE_TEMPLATE_IDS)[number];

export const SCENE_TEMPLATE_DEFAULTS: Array<{
  id: SceneTemplateId;
  title: string;
  sortOrder: number;
  rulesJson: Record<string, unknown>;
}> = [
  {
    id: "text",
    title: "文本模型",
    sortOrder: 10,
    rulesJson: { unitHint: "PER_KTOKEN" },
  },
  {
    id: "t2i",
    title: "文生图",
    sortOrder: 20,
    rulesJson: { maxRefImages: 0, unitHint: "PER_IMAGE" },
  },
  {
    id: "i2i",
    title: "图生图",
    sortOrder: 30,
    rulesJson: { maxRefImages: 9, unitHint: "PER_IMAGE" },
  },
  {
    id: "t2v",
    title: "文生视频",
    sortOrder: 40,
    rulesJson: { durationMin: 4, durationMax: 15, maxRefImages: 0, unitHint: "PER_SEC" },
  },
  {
    id: "i2v",
    title: "图生视频",
    sortOrder: 50,
    rulesJson: { durationMin: 4, durationMax: 15, maxRefImages: 9, unitHint: "PER_SEC" },
  },
  {
    id: "v2v",
    title: "视频生视频",
    sortOrder: 60,
    rulesJson: { durationMin: 4, durationMax: 15, maxRefVideos: 1, unitHint: "PER_SEC" },
  },
];

export type TemplateBindGateResult =
  | { ok: true }
  | { ok: false; error: string };

/** 绑定模板 / 对外选模前置：Gateway 路由 + 成本 + 已发布积分价 + Offering ACTIVE */
export async function assertCanonicalReadyForTemplate(
  canonicalModelKey: string,
): Promise<TemplateBindGateResult> {
  const key = canonicalModelKey.trim();
  if (!key) return { ok: false, error: "canonicalModelKey 为空" };

  const route = await prisma.gatewayModelRoute.findFirst({
    where: { canonicalModelKey: key, active: true },
    select: { id: true },
  });
  if (!route) {
    return { ok: false, error: `无生效 Gateway 路由：${key}` };
  }

  const cost = await prisma.modelCostProfile.findFirst({
    where: { canonicalModelKey: key, active: true },
    select: { id: true },
  });
  if (!cost) {
    return { ok: false, error: `无生效成本档 ModelCostProfile：${key}` };
  }

  const price = await prisma.modelCreditPrice.findFirst({
    where: { canonicalModelKey: key, active: true },
    select: { id: true, creditsPerUnit: true },
  });
  if (!price) {
    return { ok: false, error: `未发布积分价 ModelCreditPrice：${key}` };
  }

  const offering = await prisma.appModelOffering.findUnique({
    where: { canonicalModelKey: key },
    select: { status: true, activeModelKey: true },
  });
  if (!offering || offering.status !== "ACTIVE") {
    return { ok: false, error: `AppModelOffering 未 ACTIVE：${key}` };
  }
  if (!offering.activeModelKey?.trim()) {
    return { ok: false, error: `Offering 缺少 activeModelKey：${key}` };
  }

  return { ok: true };
}

export async function ensureDefaultSceneTemplates(): Promise<void> {
  for (const def of SCENE_TEMPLATE_DEFAULTS) {
    await prisma.sceneTemplate.upsert({
      where: { id: def.id },
      create: {
        id: def.id,
        title: def.title,
        sortOrder: def.sortOrder,
        status: "ACTIVE",
        rulesJson: def.rulesJson as Prisma.InputJsonValue,
      },
      update: {
        title: def.title,
        sortOrder: def.sortOrder,
      },
    });
  }
}

export async function listSceneTemplatesAdmin() {
  const templates = await prisma.sceneTemplate.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      models: {
        orderBy: [{ sortOrder: "asc" }, { canonicalModelKey: "asc" }],
      },
    },
  });
  return templates.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    sortOrder: t.sortOrder,
    rulesJson: t.rulesJson,
    models: t.models.map((m) => ({
      id: m.id,
      canonicalModelKey: m.canonicalModelKey,
      status: m.status,
      sortOrder: m.sortOrder,
      rulesOverrideJson: m.rulesOverrideJson,
    })),
  }));
}

export async function bindCanonicalToTemplate(input: {
  templateId: string;
  canonicalModelKey: string;
  sortOrder?: number;
  skipGate?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const templateId = input.templateId.trim();
  const canonical = input.canonicalModelKey.trim();
  if (!SCENE_TEMPLATE_IDS.includes(templateId as SceneTemplateId)) {
    return { ok: false, error: `未知模板 id：${templateId}` };
  }
  await ensureDefaultSceneTemplates();

  if (!input.skipGate) {
    const gate = await assertCanonicalReadyForTemplate(canonical);
    if (!gate.ok) return gate;
  }

  await prisma.sceneTemplateModel.upsert({
    where: {
      templateId_canonicalModelKey: { templateId, canonicalModelKey: canonical },
    },
    create: {
      templateId,
      canonicalModelKey: canonical,
      status: "ACTIVE",
      sortOrder: input.sortOrder ?? 0,
    },
    update: {
      status: "ACTIVE",
      sortOrder: input.sortOrder ?? 0,
    },
  });
  return { ok: true };
}

export async function setTemplateModelStatus(input: {
  templateId: string;
  canonicalModelKey: string;
  status: "ACTIVE" | "HIDDEN" | "DEPRECATED";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await prisma.sceneTemplateModel.findUnique({
    where: {
      templateId_canonicalModelKey: {
        templateId: input.templateId,
        canonicalModelKey: input.canonicalModelKey,
      },
    },
  });
  if (!row) return { ok: false, error: "绑定不存在" };
  await prisma.sceneTemplateModel.update({
    where: { id: row.id },
    data: { status: input.status },
  });
  return { ok: true };
}

export async function setSceneTemplateStatus(input: {
  templateId: string;
  status: "ACTIVE" | "DEPRECATED";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = await prisma.sceneTemplate.findUnique({ where: { id: input.templateId } });
  if (!t) return { ok: false, error: "模板不存在" };
  await prisma.sceneTemplate.update({
    where: { id: input.templateId },
    data: { status: input.status },
  });
  return { ok: true };
}

function mergeRules(
  base: unknown,
  override: unknown,
): Record<string, unknown> {
  const a =
    base && typeof base === "object" && !Array.isArray(base)
      ? (base as Record<string, unknown>)
      : {};
  const b =
    override && typeof override === "object" && !Array.isArray(override)
      ? (override as Record<string, unknown>)
      : {};
  return { ...a, ...b };
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

export type CatalogPayload = {
  version: string;
  publishedAt: string;
  templates: Array<{
    id: string;
    title: string;
    status: string;
    rules: Record<string, unknown>;
    models: Array<{
      canonicalModelKey: string;
      displayName: string;
      unit: CreditCostUnit | string;
      creditsPerUnit: number;
      tiers: Array<{ tierRaw: string; creditsPerUnit: number }>;
      rules: Record<string, unknown>;
      resolved: {
        modelKey: string;
        vendor: string;
        providerKind: string;
      };
    }>;
  }>;
};

/** 组装并写入版本化静态目录 */
export async function publishModelTemplateCatalog(input?: {
  publishedBy?: string;
  version?: string;
}): Promise<{ version: string; modelCount: number }> {
  await ensureDefaultSceneTemplates();

  const templates = await prisma.sceneTemplate.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      models: {
        where: { status: "ACTIVE" },
        orderBy: [{ sortOrder: "asc" }, { canonicalModelKey: "asc" }],
      },
    },
  });

  const canonicals = [
    ...new Set(templates.flatMap((t) => t.models.map((m) => m.canonicalModelKey))),
  ];

  const [offerings, prices, catalogs, routes] = await Promise.all([
    prisma.appModelOffering.findMany({
      where: { canonicalModelKey: { in: canonicals } },
    }),
    prisma.modelCreditPrice.findMany({
      where: { canonicalModelKey: { in: canonicals }, active: true },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.modelCatalog.findMany({
      where: { canonicalKey: { in: canonicals } },
      select: { canonicalKey: true, displayName: true },
    }),
    prisma.gatewayModelRoute.findMany({
      where: { canonicalModelKey: { in: canonicals }, active: true },
      orderBy: [{ sortOrder: "asc" }],
    }),
  ]);

  const offeringBy = new Map(offerings.map((o) => [o.canonicalModelKey, o]));
  const catalogBy = new Map(catalogs.map((c) => [c.canonicalKey, c]));
  const routeByCanonical = new Map<string, (typeof routes)[0]>();
  for (const r of routes) {
    if (!routeByCanonical.has(r.canonicalModelKey)) {
      routeByCanonical.set(r.canonicalModelKey, r);
    }
  }
  const pricesByCanonical = new Map<string, typeof prices>();
  for (const p of prices) {
    const list = pricesByCanonical.get(p.canonicalModelKey) ?? [];
    list.push(p);
    pricesByCanonical.set(p.canonicalModelKey, list);
  }

  const now = new Date();
  const version =
    input?.version?.trim() ||
    `${now.toISOString().slice(0, 10).replace(/-/g, "")}.${now.getUTCHours()}${String(now.getUTCMinutes()).padStart(2, "0")}`;

  let modelCount = 0;
  const payloadTemplates: CatalogPayload["templates"] = [];

  for (const t of templates) {
    const modelsOut: CatalogPayload["templates"][0]["models"] = [];
    for (const m of t.models) {
      const offering = offeringBy.get(m.canonicalModelKey);
      const route = routeByCanonical.get(m.canonicalModelKey);
      const modelKey =
        (offering?.status === "ACTIVE" && offering.activeModelKey?.trim()) ||
        route?.modelKey ||
        "";
      if (!modelKey) continue;

      const priceRows = pricesByCanonical.get(m.canonicalModelKey) ?? [];
      if (priceRows.length === 0) continue;

      const primary =
        priceRows.find((p) => !p.tierRaw?.trim()) ?? priceRows[0]!;
      const tiers = priceRows.map((p) => ({
        tierRaw: p.tierRaw?.trim() || "",
        creditsPerUnit: num(p.creditsPerUnit) ?? 0,
      }));

      modelsOut.push({
        canonicalModelKey: m.canonicalModelKey,
        displayName:
          offering?.displayName ||
          catalogBy.get(m.canonicalModelKey)?.displayName ||
          m.canonicalModelKey,
        unit: primary.unit,
        creditsPerUnit: num(primary.creditsPerUnit) ?? 0,
        tiers,
        rules: mergeRules(t.rulesJson, m.rulesOverrideJson),
        resolved: {
          modelKey,
          vendor:
            (offering?.status === "ACTIVE" && offering.activeVendor) ||
            route?.vendor ||
            "",
          providerKind:
            (offering?.status === "ACTIVE" && offering.activeProviderKind) ||
            route?.providerKind ||
            "",
        },
      });
      modelCount += 1;
    }

    payloadTemplates.push({
      id: t.id,
      title: t.title,
      status: t.status,
      rules: mergeRules(t.rulesJson, null),
      models: modelsOut,
    });
  }

  const payload: CatalogPayload = {
    version,
    publishedAt: now.toISOString(),
    templates: payloadTemplates,
  };

  await prisma.modelTemplateCatalogSnapshot.upsert({
    where: { version },
    create: {
      version,
      publishedAt: now,
      publishedBy: input?.publishedBy ?? null,
      payloadJson: payload as unknown as Prisma.InputJsonValue,
    },
    update: {
      publishedAt: now,
      publishedBy: input?.publishedBy ?? null,
      payloadJson: payload as unknown as Prisma.InputJsonValue,
    },
  });

  return { version, modelCount };
}

export async function getLatestTemplateCatalog(): Promise<CatalogPayload | null> {
  const row = await prisma.modelTemplateCatalogSnapshot.findFirst({
    orderBy: { publishedAt: "desc" },
  });
  if (!row) return null;
  return row.payloadJson as CatalogPayload;
}

export async function getTemplateCatalogByVersion(
  version: string,
): Promise<CatalogPayload | null> {
  const row = await prisma.modelTemplateCatalogSnapshot.findUnique({
    where: { version },
  });
  if (!row) return null;
  return row.payloadJson as CatalogPayload;
}

/** modelKey → canonical（种子用） */
export async function resolveCanonicalFromModelKey(
  modelKey: string,
): Promise<string | null> {
  const k = modelKey.trim();
  if (!k) return null;
  const route = await prisma.gatewayModelRoute.findFirst({
    where: { modelKey: k, active: true },
    select: { canonicalModelKey: true },
  });
  if (route) return route.canonicalModelKey;
  const byCanonical = await prisma.modelCatalog.findUnique({
    where: { canonicalKey: k },
    select: { canonicalKey: true },
  });
  return byCanonical?.canonicalKey ?? null;
}
