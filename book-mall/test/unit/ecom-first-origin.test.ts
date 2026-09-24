import { describe, expect, it } from "vitest";

import {
  firstWriteOrigin,
  inferEcomFirstOriginFromUpload,
  parseEcomFirstOrigin,
} from "@/lib/ecom/ecom-first-origin";

describe("ecom firstOrigin", () => {
  it("infers paste vs local upload", () => {
    expect(inferEcomFirstOriginFromUpload("paste")).toBe("user-paste");
    expect(inferEcomFirstOriginFromUpload("drop")).toBe("user-upload");
    expect(inferEcomFirstOriginFromUpload()).toBe("user-upload");
  });

  it("writes first origin only once", () => {
    expect(firstWriteOrigin("user-paste", "ecom")).toBe("user-paste");
    expect(firstWriteOrigin(undefined, "ecom")).toBe("ecom");
    expect(parseEcomFirstOrigin("canvas")).toBe("canvas");
    expect(parseEcomFirstOrigin("nope")).toBeUndefined();
  });
});
