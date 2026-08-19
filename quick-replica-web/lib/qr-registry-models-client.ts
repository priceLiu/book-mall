/**
 * QuickReplica · 客户端从 Gateway 统一注册表同步模型目录
 */

export type QrRegistryModel = {
  modelKey: string;
  displayName: string;
  description: string;
  role: string;
  sourceLabel: string;
  sortOrder: number;
  canonicalModelKey: string;
};

export async function fetchQrRegistryModelsClient(input: {
  registryUrl: string;
  sceneKey?: string;
  role?: "LLM" | "IMAGE" | "VIDEO";
}): Promise<QrRegistryModel[]> {
  const qs = new URLSearchParams({ app: "quick-replica" });
  if (input.sceneKey) qs.set("sceneKey", input.sceneKey);
  if (input.role) qs.set("role", input.role);
  const r = await fetch(`${input.registryUrl}?${qs}`, { credentials: "include" });
  if (!r.ok) return [];
  const data = (await r.json()) as { models?: QrRegistryModel[] };
  return data.models ?? [];
}
