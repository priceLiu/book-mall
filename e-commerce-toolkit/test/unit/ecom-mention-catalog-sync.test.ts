import { describe, expect, it } from "vitest";

import {
  buildMentionCatalogFromFilmPullRefs,
  syncFilmPullProductionShotsAfterRefChange,
  syncMentionText,
  syncRefIdList,
  syncSeedVideoShotsAfterRefChange,
} from "@/lib/ecom-mention-catalog-sync";

describe("syncMentionText", () => {
  const oldCatalog = [
    { refId: "m1", token: "@图片1", index: 1, role: "model" as const },
    { refId: "p1", token: "@图片2", index: 2, role: "product" as const },
  ];

  it("remaps tokens when product slot shifts after model removal", () => {
    const newCatalog = [{ refId: "p1", token: "@图片1", index: 1, role: "product" as const }];
    expect(syncMentionText("@图片1 @图片2 展示产品", oldCatalog, newCatalog)).toBe("@图片1 展示产品");
  });

  it("keeps token when ref id replaced at same slot", () => {
    const newCatalog = [
      { refId: "m2", token: "@图片1", index: 1, role: "model" as const },
      { refId: "p1", token: "@图片2", index: 2, role: "product" as const },
    ];
    expect(syncMentionText("@图片1 模特 @图片2 产品", oldCatalog, newCatalog)).toBe(
      "@图片1 模特 @图片2 产品",
    );
  });
});

describe("syncRefIdList", () => {
  const oldCatalog = [
    { refId: "m1", token: "@图片1", index: 1, role: "model" as const },
    { refId: "p1", token: "@图片2", index: 2, role: "product" as const },
  ];
  const newCatalog = [
    { refId: "m2", token: "@图片1", index: 1, role: "model" as const },
    { refId: "p1", token: "@图片2", index: 2, role: "product" as const },
  ];

  it("maps removed model id to replacement at same slot", () => {
    expect(syncRefIdList(["m1"], oldCatalog, newCatalog, "model")).toEqual(["m2"]);
  });
});

describe("syncFilmPullProductionShotsAfterRefChange", () => {
  it("updates prompts and ref ids together", () => {
    const oldCatalog = buildMentionCatalogFromFilmPullRefs([
      { id: "ref-film-pull-model-1", ossUrl: "https://example.com/m.jpg", label: "模特" },
      { id: "ref-film-pull-product-1", ossUrl: "https://example.com/p.jpg", label: "产品" },
    ]);
    const newCatalog = buildMentionCatalogFromFilmPullRefs([
      { id: "ref-film-pull-product-1", ossUrl: "https://example.com/p.jpg", label: "产品" },
    ]);
    const shots = syncFilmPullProductionShotsAfterRefChange(
      [
        {
          shotNo: 1,
          startTimeSec: 0,
          endTimeSec: 3,
          durationSec: 3,
          cutTransition: "硬切",
          shotScale: "中景",
          cameraAngle: "无",
          cameraMovement: "固定机位",
          focalLengthPerspective: "无",
          composition: "无",
          subjectBlocking: "无",
          sightDirection: "无",
          sceneEnvironment: "无",
          foreMidBackLayer: "无",
          dynamicProps: "无",
          lightingSetup: "无",
          toneContrast: "无",
          narrativeFunction: "无",
          audioInfo: {
            scriptSubtitle: "无",
            vocalEmotion: "无",
            ambientSound: "无",
            fxAndBgm: "无",
          },
          rhythmWeight: "无",
          visualMetaphor: "无",
          aiVisualPrompt: "无",
          productInteraction: "none",
          sellpointNote: "",
          modelRefIds: ["ref-film-pull-model-1"],
          productRefIds: ["ref-film-pull-product-1"],
          imagePrompt: "@图片1 @图片2",
          videoPrompt: "@图片2 特写",
          imageUrl: null,
          videoUrl: null,
          ttsUrl: null,
          status: "pending_script",
        },
      ],
      oldCatalog,
      newCatalog,
    );
    expect(shots[0]?.imagePrompt).toBe("@图片1");
    expect(shots[0]?.videoPrompt).toBe("@图片1 特写");
    expect(shots[0]?.modelRefIds).toEqual([]);
    expect(shots[0]?.productRefIds).toEqual(["ref-film-pull-product-1"]);
  });
});

describe("syncSeedVideoShotsAfterRefChange", () => {
  it("updates refImageId when model ref replaced", () => {
    const oldCatalog = [
      { refId: "ref-replica-model-a", token: "@图片1", index: 1, role: "model" as const },
    ];
    const newCatalog = [
      { refId: "ref-replica-model-b", token: "@图片1", index: 1, role: "model" as const },
    ];
    const shots = syncSeedVideoShotsAfterRefChange(
      [
        {
          index: 1,
          timeSlice: "0-3s",
          refImageId: "ref-replica-model-a",
          refImageLabel: "@图片1",
          sceneDescription: "展示",
          videoPrompt: "@图片1 模特展示",
          voiceover: "口播",
          durationSec: 3,
        },
      ],
      oldCatalog,
      newCatalog,
    );
    expect(shots[0]?.refImageId).toBe("ref-replica-model-b");
    expect(shots[0]?.videoPrompt).toBe("@图片1 模特展示");
  });
});
