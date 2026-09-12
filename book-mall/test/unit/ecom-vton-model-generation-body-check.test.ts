import { describe, expect, it } from "vitest";

import { appendModelGeneration } from "@/lib/ecom/ecom-vton/model-generations";
import {
  canConfirmModelGenerationByBody,
  modelGenerationBodyBadge,
  prepareTryonModelGeneration,
  vtonGenerationBodyCheckForAi,
  vtonGenerationBodyCheckFromDetect,
} from "@/lib/ecom/ecom-vton/model-generation-body-check";
import { emptyVtonProjectMeta } from "@/lib/ecom/ecom-vton/meta";
import type { VtonModelGeneration } from "@/lib/ecom/ecom-vton/types";

function gen(partial: Partial<VtonModelGeneration> & Pick<VtonModelGeneration, "id" | "ossUrl">): VtonModelGeneration {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("ecom-vton model-generation-body-check", () => {
  it("marks AI generations as confirmable without VLM", () => {
    const g = gen({
      id: "g1",
      ossUrl: "https://example.com/a.jpg",
      source: "ai-generate",
      bodyCheck: vtonGenerationBodyCheckForAi(),
    });
    expect(canConfirmModelGenerationByBody(g)).toBe(true);
    expect(modelGenerationBodyBadge(g)?.label).toBe("AI 全身");
  });

  it("requires done full_body for upload confirm", () => {
    const full = gen({
      id: "g1",
      ossUrl: "https://example.com/a.jpg",
      source: "upload",
      bodyCheck: vtonGenerationBodyCheckFromDetect({
        ossUrl: "https://example.com/a.jpg",
        isFullBody: true,
        shotType: "full_body",
        checkedAt: "2026-01-01T00:00:00.000Z",
      }),
    });
    const portrait = gen({
      id: "g2",
      ossUrl: "https://example.com/b.jpg",
      source: "upload",
      bodyCheck: vtonGenerationBodyCheckFromDetect({
        ossUrl: "https://example.com/b.jpg",
        isFullBody: false,
        shotType: "portrait",
        checkedAt: "2026-01-01T00:00:00.000Z",
      }),
    });
    expect(canConfirmModelGenerationByBody(full)).toBe(true);
    expect(canConfirmModelGenerationByBody(portrait)).toBe(false);
    expect(modelGenerationBodyBadge(portrait)?.label).toBe("头像");
  });

  it("auto-confirms preview AI full-body when batch try-on has no active model", () => {
    let meta = emptyVtonProjectMeta();
    meta = appendModelGeneration(meta, {
      ossUrl: "https://example.com/head.jpg",
      source: "library",
      bodyCheck: vtonGenerationBodyCheckFromDetect({
        ossUrl: "https://example.com/head.jpg",
        isFullBody: false,
        shotType: "portrait",
        checkedAt: "2026-01-01T00:00:00.000Z",
      }),
    }).meta;
    meta = appendModelGeneration(meta, {
      ossUrl: "https://example.com/full.jpg",
      source: "ai-generate",
      bodyCheck: vtonGenerationBodyCheckForAi(),
    }).meta;

    const prepared = prepareTryonModelGeneration(meta);
    expect(prepared.didAutoConfirm).toBe(true);
    expect(prepared.generation.ossUrl).toBe("https://example.com/full.jpg");
    expect(prepared.meta.activeModelGenerationId).toBe(prepared.generation.id);
  });

  it("rejects portrait preview with actionable message", () => {
    const meta = appendModelGeneration(emptyVtonProjectMeta(), {
      ossUrl: "https://example.com/head.jpg",
      source: "upload",
      bodyCheck: vtonGenerationBodyCheckFromDetect({
        ossUrl: "https://example.com/head.jpg",
        isFullBody: false,
        shotType: "portrait",
        checkedAt: "2026-01-01T00:00:00.000Z",
      }),
    }).meta;

    expect(() => prepareTryonModelGeneration(meta)).toThrow(
      "当前试衣模特为头像/半身，请先「头像生成全身图」后再试衣。",
    );
  });
});
