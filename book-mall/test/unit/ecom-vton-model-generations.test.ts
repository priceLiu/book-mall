import { describe, expect, it } from "vitest";

import {
  appendModelGeneration,
  confirmModelGeneration,
  ensureModelGenerationsFromRefs,
  finalizeModelGenerationsMeta,
  resolveActiveModelGeneration,
  resolveConfirmedModelGenerations,
  resolvePreviewModelGeneration,
  setActiveModelGeneration,
  sortModelGenerationsNewestFirst,
} from "@/lib/ecom/ecom-vton/model-generations";
import { emptyVtonProjectMeta } from "@/lib/ecom/ecom-vton/meta";

describe("ecom-vton model-generations", () => {
  it("can append while keeping left preview on source portrait", () => {
    let meta = emptyVtonProjectMeta();
    const portrait = appendModelGeneration(meta, {
      ossUrl: "https://example.com/head.jpg",
      label: "模特库",
      source: "library",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    meta = portrait.meta;
    const expanded = appendModelGeneration(
      meta,
      {
        ossUrl: "https://example.com/full.jpg",
        label: "AI 全身模特",
        source: "ai-generate",
        createdAt: "2026-01-02T00:00:00.000Z",
      },
      { keepPreviewGenerationId: portrait.generation.id },
    );
    expect(expanded.meta.modelGenerations).toHaveLength(2);
    expect(expanded.meta.previewModelGenerationId).toBe(portrait.generation.id);
    expect(resolvePreviewModelGeneration(expanded.meta)?.ossUrl).toBe(
      "https://example.com/head.jpg",
    );
  });

  it("appends to candidate history without switching active try-on model", () => {
    let meta = emptyVtonProjectMeta();
    const first = appendModelGeneration(meta, {
      ossUrl: "https://example.com/a.jpg",
      label: "模特 A",
      source: "ai-generate",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    meta = confirmModelGeneration(first.meta, first.generation.id);
    const second = appendModelGeneration(meta, {
      ossUrl: "https://example.com/b.jpg",
      label: "模特 B",
      source: "ai-generate",
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    expect(second.meta.modelGenerations).toHaveLength(2);
    expect(second.meta.previewModelGenerationId).toBe(second.generation.id);
    expect(second.meta.activeModelGenerationId).toBe(first.generation.id);
    expect(resolveActiveModelGeneration(second.meta)?.ossUrl).toBe(
      "https://example.com/a.jpg",
    );
    expect(resolvePreviewModelGeneration(second.meta)?.ossUrl).toBe(
      "https://example.com/b.jpg",
    );
  });

  it("seeds from refs.model into left history without auto-confirm", () => {
    const meta = ensureModelGenerationsFromRefs(emptyVtonProjectMeta(), {
      model: { ossUrl: "https://example.com/m.jpg", label: "上传模特", source: "upload" },
    });
    expect(meta.modelGenerations).toHaveLength(1);
    expect(meta.confirmedModelGenerationIds).toBeUndefined();
    expect(resolveActiveModelGeneration(meta)).toBeNull();
    expect(resolveConfirmedModelGenerations(meta)).toHaveLength(0);
  });

  it("only lists user-confirmed generations in try-on queue", () => {
    let meta = emptyVtonProjectMeta();
    const appended = appendModelGeneration(meta, { ossUrl: "https://example.com/a.jpg" });
    meta = finalizeModelGenerationsMeta({
      ...appended.meta,
      confirmedModelGenerationIds: [appended.generation.id],
    });
    expect(resolveConfirmedModelGenerations(meta)).toHaveLength(0);

    meta = confirmModelGeneration(meta, appended.generation.id);
    expect(resolveConfirmedModelGenerations(meta)).toHaveLength(1);
    expect(meta.modelGenerations?.[0]?.confirmedAt).toBeTruthy();
  });

  it("switches active generation only within confirmed list", () => {
    let meta = emptyVtonProjectMeta();
    const a = appendModelGeneration(meta, { ossUrl: "https://example.com/a.jpg" });
    meta = confirmModelGeneration(a.meta, a.generation.id);
    const b = appendModelGeneration(meta, { ossUrl: "https://example.com/b.jpg" });
    meta = confirmModelGeneration(b.meta, b.generation.id);
    meta = setActiveModelGeneration(meta, a.generation.id);
    expect(resolveActiveModelGeneration(meta)?.ossUrl).toBe("https://example.com/a.jpg");
  });

  it("setActive does not change left preview selection", () => {
    let meta = emptyVtonProjectMeta();
    const a = appendModelGeneration(meta, { ossUrl: "https://example.com/a.jpg" });
    meta = confirmModelGeneration(a.meta, a.generation.id);
    const b = appendModelGeneration(meta, { ossUrl: "https://example.com/b.jpg" });
    meta = confirmModelGeneration(b.meta, b.generation.id);
    expect(meta.previewModelGenerationId).toBe(b.generation.id);
    meta = setActiveModelGeneration(meta, a.generation.id);
    expect(resolveActiveModelGeneration(meta)?.ossUrl).toBe("https://example.com/a.jpg");
    expect(resolvePreviewModelGeneration(meta)?.ossUrl).toBe("https://example.com/b.jpg");
  });

  it("sorts newest candidates first", () => {
    let meta = emptyVtonProjectMeta();
    meta = appendModelGeneration(meta, {
      ossUrl: "https://example.com/old.jpg",
      createdAt: "2026-01-01T00:00:00.000Z",
    }).meta;
    meta = appendModelGeneration(meta, {
      ossUrl: "https://example.com/new.jpg",
      createdAt: "2026-01-02T00:00:00.000Z",
    }).meta;
    const sorted = sortModelGenerationsNewestFirst(meta.modelGenerations ?? []);
    expect(sorted[0]?.ossUrl).toBe("https://example.com/new.jpg");
  });

  it("does not auto-confirm newly appended candidates", () => {
    const meta = finalizeModelGenerationsMeta({
      ...emptyVtonProjectMeta(),
      modelGenerations: [
        {
          id: "g1",
          ossUrl: "https://example.com/a.jpg",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      previewModelGenerationId: "g1",
    });
    expect(meta.confirmedModelGenerationIds).toBeUndefined();
    expect(meta.activeModelGenerationId).toBeUndefined();
  });

  it("ignores legacy active id without confirmedAt", () => {
    const meta = finalizeModelGenerationsMeta({
      ...emptyVtonProjectMeta(),
      modelGenerations: [
        {
          id: "g1",
          ossUrl: "https://example.com/a.jpg",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      activeModelGenerationId: "g1",
      confirmedModelGenerationIds: ["g1"],
    });
    expect(meta.confirmedModelGenerationIds).toBeUndefined();
    expect(meta.activeModelGenerationId).toBeUndefined();
    expect(resolveConfirmedModelGenerations(meta)).toHaveLength(0);
  });
});
