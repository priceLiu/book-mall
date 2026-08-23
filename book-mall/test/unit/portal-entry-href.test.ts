import { afterEach, describe, expect, it, vi } from "vitest";

import { buildPortalEntryHref } from "@private/federated-portal-nav";

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
