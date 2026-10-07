"use client";

import type { GlobalAssetSaveContext } from "@/docker-shared/global-asset-library/types";
import { getCachedToolsSession } from "@/lib/tools-session-client-cache";

export function buildCanvasGlobalAssetSaveContext(
  projectId: string | null | undefined,
  visionModelKey?: string,
  isPlatformAdmin?: boolean,
): GlobalAssetSaveContext | undefined {
  const pid = projectId?.trim();
  if (!pid) return undefined;

  const intro = getCachedToolsSession()?.introspect as Record<string, unknown> | undefined;
  const tenantType = typeof intro?.tenant_type === "string" ? intro.tenant_type : "";
  const tenantId =
    typeof intro?.tenant_id === "string" ? intro.tenant_id.trim() : "";
  const isTeamTenant = tenantType === "TEAM" && Boolean(tenantId);

  return {
    projectId: pid,
    tenantId: isTeamTenant ? tenantId : null,
    allowProjectScope: true,
    allowTeamShare: isTeamTenant,
    visionModelKey: visionModelKey?.trim() || undefined,
    isPlatformAdmin: isPlatformAdmin === true ? true : undefined,
  };
}
