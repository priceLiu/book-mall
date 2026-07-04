/** World Labs Marble world-generation models (upstream model ids). */
export const WORLDLABS_MARBLE_MODELS = [
  {
    modelKey: "marble-1.1-plus",
    displayName: "Marble 1.1 Plus",
    description: "Best for large scenes",
  },
  {
    modelKey: "marble-1.1",
    displayName: "Marble 1.1",
    description: "Improved quality",
  },
  {
    modelKey: "marble-1.0",
    displayName: "Marble 1.0 (legacy)",
    description: "Legacy model",
  },
  {
    modelKey: "marble-1.0-draft",
    displayName: "Marble 1.0 Draft",
    description: "Quickly explore ideas",
  },
] as const;

export type WorldlabsMarbleModelKey = (typeof WORLDLABS_MARBLE_MODELS)[number]["modelKey"];

export const WORLDLABS_DEFAULT_MARBLE_MODEL_KEY: WorldlabsMarbleModelKey = "marble-1.1";

const MARBLE_MODEL_KEYS = new Set<string>(WORLDLABS_MARBLE_MODELS.map((m) => m.modelKey));

export function isWorldlabsMarbleModelKey(modelKey: string): boolean {
  return MARBLE_MODEL_KEYS.has(modelKey.trim());
}

export function resolveWorldlabsMarbleModelKey(modelKey: string): WorldlabsMarbleModelKey {
  const key = modelKey.trim();
  if (isWorldlabsMarbleModelKey(key)) return key as WorldlabsMarbleModelKey;
  return WORLDLABS_DEFAULT_MARBLE_MODEL_KEY;
}
