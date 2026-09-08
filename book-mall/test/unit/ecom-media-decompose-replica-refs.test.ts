import { describe, expect, it } from "vitest";

import {
  appendReplicaReference,
  buildReplicaMentionCatalog,
  listReplicaModelRefs,
  listReplicaProductImageRefs,
  listReplicaProductRefs,
  removeReplicaReference,
  sanitizeReplicaPromptTokens,
  upsertReplicaSlotReference,
} from "@/lib/ecom/ecom-media-decompose-replica-refs";
import { buildReplicaAssetPlanFromDecompose } from "@/lib/ecom/ecom-replica-asset-plan";
import type { SeedVideoReference } from "@/lib/ecom/ecom-seed-video-types";

describe("ecom-media-decompose-replica-refs", () => {
  it("appendReplicaReference adds multiple model and product refs", () => {
    let refs: SeedVideoReference[] = [];
    ({ references: refs } = appendReplicaReference(refs, "model", "https://a/1.png"));
    ({ references: refs } = appendReplicaReference(refs, "model", "https://a/2.png"));
    ({ references: refs } = appendReplicaReference(refs, "product", "https://a/p1.png"));

    expect(listReplicaModelRefs(refs)).toHaveLength(2);
    expect(listReplicaProductRefs(refs)).toHaveLength(1);
    const catalog = buildReplicaMentionCatalog(refs);
    expect(catalog.map((e) => e.token)).toEqual(["@图片1", "@图片2", "@图片3"]);
    expect(catalog[2]?.role).toBe("product");
  });

  it("removeReplicaReference drops by id", () => {
    let refs: SeedVideoReference[] = [];
    let added: SeedVideoReference;
    ({ references: refs, reference: added } = appendReplicaReference(
      refs,
      "product",
      "https://a/p.png",
    ));
    refs = removeReplicaReference(refs, added.id);
    expect(listReplicaProductRefs(refs)).toHaveLength(0);
  });

  it("listReplicaProductImageRefs resolves four-slot product uploads", () => {
    const plan = buildReplicaAssetPlanFromDecompose({
      mediaType: "image",
      action: "decompose_complete",
      elements: {
        subject: "模特",
        subjectPose: "",
        sceneEnvironment: "",
        spatialPerspective: "",
        composition: "",
        equivalentFocalLength: "",
        shootingAngle: "",
        lighting: {
          keyLight: "",
          fillLight: "",
          rimLight: "",
          ambientLight: "",
          direction: "",
          hardSoft: "",
          colorTemperature: "",
        },
        materialTexture: "",
        colorSystem: "",
        atmosphere: "",
        detailNotes: "",
      },
      positivePrompt: "p",
      negativePrompt: "",
      liveActionReplication: {
        sceneSetup: "",
        talentBlocking: "",
        compositionFraming: "",
        cameraPlacement: "",
        lightingSetup: "",
        props: "",
        cameraParams: "",
        postProcessing: "",
        shootingChecklist: "",
      },
      replicaAssetCatalog: {
        characterCount: 1,
        characters: [{ label: "人物A", description: "男孩" }],
        products: [{ label: "产品1", description: "红色 kite" }],
        props: [],
        scenes: [],
      },
    });
    const productSlot = plan.products[0]!;
    const { references } = upsertReplicaSlotReference([], productSlot, "https://cdn/product.png");
    expect(listReplicaProductRefs(references)).toHaveLength(0);
    expect(listReplicaProductImageRefs(references, plan)).toHaveLength(1);
    expect(listReplicaProductImageRefs(references, plan)[0]?.ossUrl).toContain("product.png");
  });

  it("sanitizeReplicaPromptTokens strips inherit slot tokens", () => {
    const allowed = new Set(["@人物A", "@产品1"]);
    const cleaned = sanitizeReplicaPromptTokens(
      "@人物A @人物B @产品1 中景，@道具2 在前景",
      allowed,
    );
    expect(cleaned).toContain("@人物A");
    expect(cleaned).toContain("@产品1");
    expect(cleaned).not.toContain("@人物B");
    expect(cleaned).not.toContain("@道具2");
  });
});
