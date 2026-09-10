import { describe, expect, it } from "vitest";

import {
  buildEcomVtonTextTryonDemoRefs,
  VTON_TEXT_TRYON_DEMO_SLOTS,
} from "@/lib/ecom/ecom-vton-text-tryon-demo";

describe("ecom-vton-text-tryon-demo", () => {
  it("builds two demo refs with @图片1/@图片2 labels", () => {
    process.env.OSS_ACCESS_KEY_ID = "test-key";
    process.env.OSS_ACCESS_KEY_SECRET = "test-secret";
    process.env.OSS_BUCKET = "tool-mall";
    process.env.OSS_REGION = "oss-cn-guangzhou";
    delete process.env.OSS_PUBLIC_URL_BASE;

    const refs = buildEcomVtonTextTryonDemoRefs("2026-01-01T00:00:00.000Z");
    expect(refs).toHaveLength(VTON_TEXT_TRYON_DEMO_SLOTS.length);
    expect(refs[0]?.label).toBe("图片1");
    expect(refs[1]?.label).toBe("图片2");
    expect(refs[0]?.ossUrl).toContain("/ecom/text-tryon-demo/garment.");
    expect(refs[1]?.ossUrl).toContain("/ecom/text-tryon-demo/accessory-glasses.");
  });
});
