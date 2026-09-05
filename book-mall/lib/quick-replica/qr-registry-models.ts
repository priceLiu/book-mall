/**
 * QuickReplica · 从 Gateway 统一注册表拉取模型（模型运营中心）
 */
import type { CanvasModelRole } from "@prisma/client";

export type QrRegistryModel = {
  modelKey: string;
  displayName: string;
  description: string;
  role: CanvasModelRole;
  sourceLabel: string;
  sortOrder: number;
  canonicalModelKey: string;
};

export async function fetchQrRegistryModels(input: {
  baseUrl: string;
  bearerToken: string;
  sceneKey?: string;
  role?: "LLM" | "IMAGE" | "VIDEO";
}): Promise<QrRegistryModel[]> {
  const qs = new URLSearchParams({ app: "quick-replica" });
  if (input.sceneKey) qs.set("sceneKey", input.sceneKey);
  if (input.role) qs.set("role", input.role);
  const r = await fetch(`${input.baseUrl}/api/sso/tools/gateway/models/registry?${qs}`, {
    headers: { Authorization: `Bearer ${input.bearerToken}` },
    cache: "no-store",
  });
  if (!r.ok) return [];
  const data = (await r.json()) as { models?: QrRegistryModel[] };
  return data.models ?? [];
}
