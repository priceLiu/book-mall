import { describe, expect, it } from "vitest";

import {
  assertBatchLooksValid,
  expandTopBottomCartesianLooks,
  isVtonGarmentRefsReady,
  isVtonModelRefReady,
  isVtonRefsReadyForTryon,
  resolveLookTryonUrls,
  resolveVtonTryonInputs,
} from "@/lib/ecom/ecom-vton/validate";
import { ECOM_VTON_MAX_BATCH_LOOKS } from "@/lib/ecom/ecom-vton/types";
import {
  assertVtonReadyToFinalizeLock,
  lockVtonTryonResults,
  lockVtonUploadAsLook,
} from "@/lib/ecom/ecom-vton-project-mutations";
import { emptyVtonProjectMeta } from "@/lib/ecom/ecom-vton/meta";

describe("ecom-vton validate", () => {
  it("two_piece requires top and bottom", () => {
    expect(
      isVtonGarmentRefsReady("two_piece", {
        topGarment: { ossUrl: "https://x/top.jpg" },
        bottomGarment: { ossUrl: "https://x/bottom.jpg" },
      }),
    ).toBe(true);
    expect(
      isVtonGarmentRefsReady("two_piece", {
        topGarment: { ossUrl: "https://x/top.jpg" },
      }),
    ).toBe(false);
  });

  it("one_piece requires clothing", () => {
    expect(
      isVtonGarmentRefsReady("one_piece", {
        clothing: { ossUrl: "https://x/dress.jpg" },
      }),
    ).toBe(true);
  });

  it("resolveVtonTryonInputs passes both garment urls for two_piece", () => {
    const inputs = resolveVtonTryonInputs({
      outfitRefMode: "need_tryon",
      garmentMode: "two_piece",
      refs: {
        model: { ossUrl: "https://x/model.jpg" },
        topGarment: { ossUrl: "https://x/top.jpg" },
        bottomGarment: { ossUrl: "https://x/bottom.jpg" },
      },
    });
    expect(inputs.personImageUrl).toBe("https://x/model.jpg");
    expect(inputs.topGarmentUrl).toBe("https://x/top.jpg");
    expect(inputs.bottomGarmentUrl).toBe("https://x/bottom.jpg");
  });

  it("already_dressed uses model as person image", () => {
    const inputs = resolveVtonTryonInputs({
      outfitRefMode: "already_dressed",
      garmentMode: "two_piece",
      refs: { model: { ossUrl: "https://x/dressed.jpg" } },
    });
    expect(inputs.personImageUrl).toBe("https://x/dressed.jpg");
    expect(inputs.topGarmentUrl).toBe("https://x/dressed.jpg");
    expect(inputs.bottomGarmentUrl).toBeUndefined();
  });

  it("isVtonRefsReadyForTryon gates model + garments", () => {
    expect(isVtonModelRefReady({ model: { ossUrl: "https://x/m.jpg" } })).toBe(true);
    expect(
      isVtonRefsReadyForTryon({
        outfitRefMode: "need_tryon",
        garmentMode: "two_piece",
        refs: {
          model: { ossUrl: "https://x/m.jpg" },
          topGarment: { ossUrl: "https://x/t.jpg" },
          bottomGarment: { ossUrl: "https://x/b.jpg" },
        },
      }),
    ).toBe(true);
  });
});

describe("batch look validate", () => {
  const pool = [
    { id: "t1", kind: "top" as const, ossUrl: "https://x/top.jpg" },
    { id: "b1", kind: "bottom" as const, ossUrl: "https://x/bottom.jpg" },
    { id: "d1", kind: "one_piece" as const, ossUrl: "https://x/dress.jpg" },
    { id: "s1", kind: "full_set" as const, ossUrl: "https://x/set.jpg" },
  ];

  it("resolveLookTryonUrls maps four look kinds", () => {
    expect(
      resolveLookTryonUrls({
        look: { id: "l1", kind: "two_piece", topGarmentId: "t1", bottomGarmentId: "b1" },
        garmentPool: pool,
        modelUrl: "https://x/model.jpg",
      }),
    ).toMatchObject({
      lookKind: "two_piece",
      topGarmentUrl: "https://x/top.jpg",
      bottomGarmentUrl: "https://x/bottom.jpg",
    });

    expect(
      resolveLookTryonUrls({
        look: { id: "l2", kind: "one_piece", onePieceGarmentId: "d1" },
        garmentPool: pool,
        modelUrl: "https://x/model.jpg",
      }).topGarmentUrl,
    ).toBe("https://x/dress.jpg");

    expect(
      resolveLookTryonUrls({
        look: { id: "l3", kind: "top_only", topGarmentId: "t1" },
        garmentPool: pool,
        modelUrl: "https://x/model.jpg",
      }),
    ).toMatchObject({ lookKind: "top_only", topGarmentUrl: "https://x/top.jpg" });

    expect(
      resolveLookTryonUrls({
        look: { id: "l4", kind: "bottom_only", bottomGarmentId: "b1" },
        garmentPool: pool,
        modelUrl: "https://x/model.jpg",
      }),
    ).toMatchObject({ lookKind: "bottom_only", bottomGarmentUrl: "https://x/bottom.jpg" });

    expect(
      resolveLookTryonUrls({
        look: { id: "l5", kind: "full_set", fullSetGarmentId: "s1" },
        garmentPool: pool,
        modelUrl: "https://x/model.jpg",
      }),
    ).toMatchObject({ lookKind: "full_set", topGarmentUrl: "https://x/set.jpg" });

    expect(
      resolveLookTryonUrls({
        look: {
          id: "l6",
          kind: "top_only",
          fullSetGarmentId: "s1",
          topGarmentId: "t1",
        },
        garmentPool: pool,
        modelUrl: "https://x/model.jpg",
      }),
    ).toMatchObject({ lookKind: "full_set", topGarmentUrl: "https://x/set.jpg" });

    expect(
      resolveLookTryonUrls({
        look: { id: "l7", kind: "top_only", topGarmentId: "s1" },
        garmentPool: pool,
        modelUrl: "https://x/model.jpg",
      }),
    ).toMatchObject({ lookKind: "full_set", topGarmentUrl: "https://x/set.jpg" });
  });

  it("assertBatchLooksValid enforces 1-9 limit", () => {
    expect(() => assertBatchLooksValid([])).toThrow(/至少/);
    const tooMany = Array.from({ length: ECOM_VTON_MAX_BATCH_LOOKS + 1 }, (_, i) => ({
      id: `l${i}`,
      kind: "top_only" as const,
      topGarmentId: "t1",
    }));
    expect(() => assertBatchLooksValid(tooMany)).toThrow(/最多/);
  });

  it("expandTopBottomCartesianLooks truncates at 9", () => {
    const topIds = ["t1", "t1", "t1"];
    const bottomIds = ["b1", "b1", "b1", "b1"];
    const looks = expandTopBottomCartesianLooks({
      topIds,
      bottomIds,
      createId: () => "id",
    });
    expect(looks.length).toBe(ECOM_VTON_MAX_BATCH_LOOKS);
  });
});

describe("lock mutations", () => {
  it("lockVtonUploadAsLook for already_dressed", () => {
    const { meta } = lockVtonUploadAsLook(emptyVtonProjectMeta(), {
      ossUrl: "https://x/dressed.jpg",
      label: "已穿搭",
    });
    expect(meta.lockedLooks?.length).toBe(1);
    expect(meta.defaultLockedLookId).toBeTruthy();
  });

  it("assertVtonReadyToFinalizeLock requires locked looks for need_tryon", () => {
    expect(() => assertVtonReadyToFinalizeLock(emptyVtonProjectMeta(), "need_tryon")).toThrow(
      /至少 1 张/,
    );
  });

  it("lockVtonTryonResults from batch results", () => {
    const meta = {
      ...emptyVtonProjectMeta(),
      tryonBatch: {
        batchId: "b1",
        status: "done" as const,
        currentIndex: 1,
        total: 1,
        results: [
          {
            id: "r1",
            lookId: "l1",
            status: "success" as const,
            ossUrl: "https://x/tryon.jpg",
            createdAt: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      },
    };
    const { meta: locked } = lockVtonTryonResults(meta, ["r1"]);
    expect(locked.lockedLooks?.length).toBe(1);
    expect(locked.lockedLooks?.[0]?.ossUrl).toBe("https://x/tryon.jpg");
  });
});

describe("buildDashscopeCreateTaskInputForLog tryon", () => {
  it("includes garment urls in snapshot", async () => {
    const { buildDashscopeCreateTaskInputForLog } = await import(
      "@/lib/gateway/log-input-summary"
    );
    const snap = buildDashscopeCreateTaskInputForLog({
      jobKind: "tryon",
      personImageUrl: "https://example.com/person.jpg",
      topGarmentUrl: "https://example.com/top.jpg",
      bottomGarmentUrl: "https://example.com/bottom.jpg",
    });
    expect(snap).toMatchObject({
      jobKind: "tryon",
      personImageUrl: "https://example.com/person.jpg",
      topGarmentUrl: "https://example.com/top.jpg",
      bottomGarmentUrl: "https://example.com/bottom.jpg",
    });
  });
});
