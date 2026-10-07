import { describe, expect, it } from "vitest";

import { stampProjectAssetProvenanceOnCreate } from "@/lib/project-asset/project-asset-provenance";

describe("stampProjectAssetProvenanceOnCreate", () => {
  it("sets savedAt and keeps client prompt", () => {
    const out = stampProjectAssetProvenanceOnCreate({
      prompt: "hello",
      assetProvenance: {
        schemaVersion: 1,
        prompt: "hello",
        savedAtClient: "2026-01-01T00:00:00.000Z",
        source: {
          channel: "canvas",
          edition: "sbv1",
          projectId: "p1",
          nodeId: "n1",
          nodeType: "sbv1-image",
        },
        media: { kind: "image" },
      },
    });
    const prov = out.assetProvenance as { savedAt?: string; prompt?: string };
    expect(prov.prompt).toBe("hello");
    expect(prov.savedAt).toMatch(/^\d{4}-/);
  });
});
