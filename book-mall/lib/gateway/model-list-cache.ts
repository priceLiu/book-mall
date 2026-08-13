import type { GatewayProviderKind } from "@prisma/client";

import type { ListModelsForAppInput, RegistryModelRow } from "@/lib/gateway/model-registry";

/** Gateway 模型清单进程内缓存：有新 canonical 同步时失效，否则 TTL 内复用 */
export const GATEWAY_MODEL_LIST_CACHE_TTL_MS = 5 * 60 * 1000;

type RoutesRow = Awaited<
  ReturnType<typeof import("@/lib/gateway/model-registry").listActiveRoutesUncached>
>[number];

const listCache = new Map<string, { at: number; rows: RegistryModelRow[] }>();
let routesCache: { at: number; routes: RoutesRow[] } | null = null;

function listModelsCacheKey(input: ListModelsForAppInput): string {
  const kinds = [...input.boundKinds].sort().join(",");
  return `${input.appTag}:${input.role ?? "*"}:${input.persona}:${kinds}`;
}

export function getCachedModelsForApp(input: ListModelsForAppInput): RegistryModelRow[] | null {
  const hit = listCache.get(listModelsCacheKey(input));
  if (!hit || Date.now() - hit.at > GATEWAY_MODEL_LIST_CACHE_TTL_MS) return null;
  return hit.rows;
}

export function setCachedModelsForApp(
  input: ListModelsForAppInput,
  rows: RegistryModelRow[],
): void {
  listCache.set(listModelsCacheKey(input), { at: Date.now(), rows });
}

export function getCachedActiveRoutes(): RoutesRow[] | null {
  if (!routesCache || Date.now() - routesCache.at > GATEWAY_MODEL_LIST_CACHE_TTL_MS) {
    return null;
  }
  return routesCache.routes;
}

export function setCachedActiveRoutes(routes: RoutesRow[]): void {
  routesCache = { at: Date.now(), routes };
}

/** canonical 注册表落库或 Gateway 模型变更后调用 */
export function invalidateGatewayModelListCache(): void {
  listCache.clear();
  routesCache = null;
}

export type { GatewayProviderKind };
