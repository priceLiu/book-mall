import { describe, expect, it } from "vitest";

import { isEcomBrowserNavMouseButton } from "@/lib/ecom-block-browser-nav";

describe("ecom-block-browser-nav", () => {
  it("detects browser back/forward mouse buttons", () => {
    expect(isEcomBrowserNavMouseButton(3)).toBe(true);
    expect(isEcomBrowserNavMouseButton(4)).toBe(true);
    expect(isEcomBrowserNavMouseButton(0)).toBe(false);
  });
});
