import { describe, expect, it } from "vitest";

import {
  appendReplicaReference,
  buildReplicaMentionCatalog,
  listReplicaModelRefs,
  listReplicaProductRefs,
  removeReplicaReference,
} from "@/lib/ecom/ecom-media-decompose-replica-refs";
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
});
