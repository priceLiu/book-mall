import { describe, expect, it } from "vitest";

import { isPublicCanvasPath } from "@/lib/canvas-public-paths";

describe("isPublicCanvasPath", () => {
  it("allows homepage and auth entry without login", () => {
    expect(isPublicCanvasPath("/")).toBe(true);
    expect(isPublicCanvasPath("/login")).toBe(true);
    expect(isPublicCanvasPath("/register")).toBe(true);
    expect(isPublicCanvasPath("/auth/sso/callback")).toBe(true);
    expect(isPublicCanvasPath("/sso-error")).toBe(true);
  });

  it("requires login for personal canvas routes", () => {
    expect(isPublicCanvasPath("/projects")).toBe(false);
    expect(isPublicCanvasPath("/canvas/abc")).toBe(false);
    expect(isPublicCanvasPath("/gallery")).toBe(false);
    expect(isPublicCanvasPath("/assets")).toBe(false);
    expect(isPublicCanvasPath("/admin/portal")).toBe(false);
  });
});
