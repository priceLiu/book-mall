import { describe, expect, it } from "vitest";

import {
  CANVAS_PORTAL_PUBLIC_GET_PATHS,
  isPublicCanvasTemplatesListScope,
} from "@/lib/canvas/portal-public-read";

describe("portal-public-read", () => {
  it("lists anonymous portal GET paths", () => {
    expect(CANVAS_PORTAL_PUBLIC_GET_PATHS).toContain(
      "api/canvas/projects/portal-featured",
    );
    expect(CANVAS_PORTAL_PUBLIC_GET_PATHS).toContain(
      "api/canvas/projects/portal-film-showcase",
    );
  });

  it("allows public and featured template scopes only", () => {
    expect(isPublicCanvasTemplatesListScope("public")).toBe(true);
    expect(isPublicCanvasTemplatesListScope("featured")).toBe(true);
    expect(isPublicCanvasTemplatesListScope("my")).toBe(false);
    expect(isPublicCanvasTemplatesListScope("all")).toBe(false);
    expect(isPublicCanvasTemplatesListScope(null)).toBe(false);
  });
});
