import { describe, expect, it } from "vitest";

import {
  getProductDesignRefUploadMaxBytes,
  PRODUCT_DESIGN_REF_STORE_MAX_BYTES,
  PRODUCT_DESIGN_STYLE_REF_UPLOAD_MAX_BYTES,
} from "@/lib/ecom/ecom-product-design-ref-upload-normalize";

describe("ecom-product-design-ref-upload-normalize", () => {
  it("allows 200MB upload for detail-style only", () => {
    expect(getProductDesignRefUploadMaxBytes("detail-style")).toBe(
      PRODUCT_DESIGN_STYLE_REF_UPLOAD_MAX_BYTES,
    );
    expect(getProductDesignRefUploadMaxBytes("main-style")).toBe(
      PRODUCT_DESIGN_STYLE_REF_UPLOAD_MAX_BYTES,
    );
    expect(getProductDesignRefUploadMaxBytes("product")).toBe(30 * 1024 * 1024);
  });

  it("store cap is 30MB", () => {
    expect(PRODUCT_DESIGN_REF_STORE_MAX_BYTES).toBe(30 * 1024 * 1024);
  });
});
