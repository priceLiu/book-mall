import { afterEach, describe, expect, it, vi } from "vitest";

import { buildPortalEntryHref } from "@private/federated-portal-nav";

import { buildBookPortalNavItems } from "@/lib/portal-nav";

describe("buildPortalEntryHref", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses default e-commerce origin when env is missing", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(
      buildPortalEntryHref({
        bookOrigin: "http://localhost:3000",
        app: "e-commerce",
        appOrigin: null,
        redirect: "/",
      }),
    ).toBe("http://localhost:3007/");
  });

  it("does not force book re-enter for public browse apps", () => {
    vi.stubEnv("NODE_ENV", "production");
    const href = buildPortalEntryHref({
      bookOrigin: "https://book.ai-code8.com",
      app: "e-commerce",
      appOrigin: null,
      redirect: "/",
    });
    expect(href).toBe("https://ecom.ai-code8.com/");
    expect(href).not.toContain("re-enter");
  });
});

describe("buildBookPortalNavItems", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses SSO open pages when logged in", () => {
    vi.stubEnv("NODE_ENV", "development");
    const items = buildBookPortalNavItems("http://localhost:3000", true);
    const canvas = items.find((item) => item.key === "canvas");
    const tool = items.find((item) => item.key === "tool");
    expect(canvas?.href).toBe("/canvas-open?path=%2Fprojects");
    expect(tool?.href).toBe("/tools-open?redirect=%2Ffitting-room");
    expect(canvas?.href).not.toContain("localhost:3004");
  });

  it("uses direct sub-app origins when logged out", () => {
    vi.stubEnv("NODE_ENV", "development");
    const items = buildBookPortalNavItems("http://localhost:3000", false);
    const canvas = items.find((item) => item.key === "canvas");
    expect(canvas?.href).toBe("http://localhost:3004/");
  });
});
