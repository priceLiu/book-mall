/** 与 canvas-web/lib/canvas/project-asset-provenance.ts 字段对齐 */

export const PROJECT_ASSET_PROVENANCE_SCHEMA_VERSION = 1;

export type ProjectAssetProvenance = {
  schemaVersion: number;
  prompt: string;
  savedAt?: string;
  savedAtClient?: string;
  source: {
    channel: "canvas";
    edition: string;
    projectId: string | null;
    nodeId: string;
    nodeType: string;
    displayName?: string;
  };
  media: {
    kind: string;
    primaryUrl?: string;
    posterUrl?: string;
  };
  firstOrigin?: string;
};

export function stampProjectAssetProvenanceOnCreate(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...payload };
  const raw = next.assetProvenance;
  const base =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? ({ ...(raw as Record<string, unknown>) } as ProjectAssetProvenance)
      : ({
          schemaVersion: PROJECT_ASSET_PROVENANCE_SCHEMA_VERSION,
          prompt: "",
          source: {
            channel: "canvas",
            edition: "",
            projectId: null,
            nodeId: "",
            nodeType: "",
          },
          media: { kind: "unknown" },
        } as ProjectAssetProvenance);

  const prompt =
    (typeof base.prompt === "string" && base.prompt.trim()) ||
    (typeof next.prompt === "string" && next.prompt.trim()) ||
    "";

  next.assetProvenance = {
    ...base,
    schemaVersion: PROJECT_ASSET_PROVENANCE_SCHEMA_VERSION,
    prompt,
    savedAt: new Date().toISOString(),
  };
  if (prompt && typeof next.prompt !== "string") {
    next.prompt = prompt;
  }
  return next;
}
