import { describe, expect, it } from "vitest";

import { buildReplicaMentionRefs } from "@/lib/media-decompose-replica-refs";

describe("buildReplicaMentionRefs", () => {
  it("numbers model refs before product refs", () => {
    const refs = buildReplicaMentionRefs([
      {
        id: "ref-replica-model-1",
        ossUrl: "https://example.com/model.jpg",
        label: "模特 A",
        role: "replica-model",
      },
      {
        id: "ref-replica-product-1",
        ossUrl: "https://example.com/product.jpg",
        label: "产品 B",
        role: "replica-product",
      },
    ]);
    expect(refs).toHaveLength(2);
    expect(refs[0]?.token).toBe("@图片1");
    expect(refs[0]?.kind).toBe("model");
    expect(refs[1]?.token).toBe("@图片2");
    expect(refs[1]?.kind).toBe("product");
  });
});
