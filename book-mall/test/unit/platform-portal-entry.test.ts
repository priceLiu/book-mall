import { describe, expect, it } from "vitest";

import { resolveBookAppOpenTargetUrl } from "@/lib/platform-portal-entry";

describe("platform-portal-entry", () => {
  it("anonymous public apps open direct portal origin", () => {
    expect(
      resolveBookAppOpenTargetUrl({
        app: "quick-replica",
        path: "/",
        loggedIn: false,
      }),
    ).toMatch(/^https?:\/\/.+\/$/);
    expect(
      resolveBookAppOpenTargetUrl({
        app: "e-commerce",
        path: "/",
        loggedIn: false,
      }),
    ).toMatch(/^https?:\/\/.+\/$/);
    expect(
      resolveBookAppOpenTargetUrl({
        app: "canvas",
        path: "/projects",
        loggedIn: false,
      }),
    ).toMatch(/^https?:\/\/.+\/projects$/);
  });

  it("logged-in users still use re-enter", () => {
    expect(
      resolveBookAppOpenTargetUrl({
        app: "quick-replica",
        path: "/",
        loggedIn: true,
      }),
    ).toBe("/api/sso/tools/re-enter?redirect=%2F&app=quick-replica");
    expect(
      resolveBookAppOpenTargetUrl({
        app: "canvas",
        path: "/projects",
        loggedIn: true,
      }),
    ).toBe("/api/sso/tools/re-enter?redirect=%2Fprojects&app=canvas");
  });
});
