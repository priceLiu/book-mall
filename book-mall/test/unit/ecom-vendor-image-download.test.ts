import { describe, expect, it } from "vitest";

import { fetchEcomVendorImageBuffer } from "@/lib/ecom/ecom-vendor-image-download";

describe("fetchEcomVendorImageBuffer", () => {
  it("rejects empty url with actionable message", async () => {
    await expect(fetchEcomVendorImageBuffer("")).rejects.toThrow(/成图 URL 为空/);
  });

  it("rejects non-http url", async () => {
    await expect(fetchEcomVendorImageBuffer("ftp://example/a.png")).rejects.toThrow(
      /成图 URL 无效/,
    );
  });
});
