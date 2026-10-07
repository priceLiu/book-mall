import type { EcomCatalogScope } from "@/lib/ecom/ecom-catalog-scope";

/** 列表可见性 OR 条件（platform + 本人 user + 可选 team / 当前项目 project） */
export function buildCatalogViewerScopeOr(args: {
  userId: string;
  tenantId?: string | null;
  projectId?: string | null;
}): Array<Record<string, unknown>> {
  const or: Array<Record<string, unknown>> = [
    { scope: "platform" },
    { scope: "user", userId: args.userId },
  ];
  const tenant = args.tenantId?.trim();
  if (tenant) {
    or.push({ scope: "team", tenantId: tenant });
  }
  const projectId = args.projectId?.trim();
  if (projectId) {
    or.push({ scope: "project", sourceProjectId: projectId });
  }
  return or;
}

export function normalizeCatalogScope(raw: string | null | undefined): EcomCatalogScope {
  if (raw === "user" || raw === "team" || raw === "project") return raw;
  return "platform";
}

export function catalogScopePersistFields(
  scope: EcomCatalogScope,
  args: {
    actorUserId: string;
    tenantId?: string | null;
    sourceProjectId?: string | null;
  },
): {
  scope: EcomCatalogScope;
  userId: string | null;
  tenantId: string | null;
  sourceProjectId: string | null;
} {
  return {
    scope,
    userId: scope === "platform" ? null : args.actorUserId,
    tenantId: scope === "team" ? args.tenantId?.trim() ?? null : null,
    sourceProjectId: scope === "project" ? args.sourceProjectId?.trim() ?? null : null,
  };
}
