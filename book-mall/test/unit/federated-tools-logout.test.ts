import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/app-web-origins", () => ({
  getCanvasWebOrigin: () => "https://canvas.example.com",
  getCommonToolsOrigin: () => "https://common-tools.example.com",
  getEcommerceWebOrigin: () => "https://ecom.example.com",
  getPromptOptimizerOrigin: () => "https://prompt.example.com",
  getQuickReplicaOrigin: () => "https://qr.example.com",
  getStoryWebOrigin: () => "https://story.example.com",
  buildAppWebUrl: (origin: string, path: string) =>
    `${origin.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`,
}));

vi.mock("@/lib/sso-tools-env", () => ({
  getToolsPublicOrigin: () => "https://tool.example.com",
}));

vi.mock("@/lib/gateway/env", () => ({
  getBookMallOrigin: () => "https://book.example.com",
}));

vi.mock("@/lib/platform-web-origins", () => ({
  listPlatformWebOrigins: () => [
    "https://book.example.com",
    "https://tool.example.com",
    "https://canvas.example.com",
  ],
}));

describe("federated-tools-logout", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("buildToolsLogoutHopUrl uses tools-logout with next", async () => {
    const { buildToolsLogoutHopUrl } = await import(
      "@/lib/federated-tools-logout"
    );
    const url = buildToolsLogoutHopUrl(
      "https://story.example.com",
      "https://book.example.com/api/auth/federated-logout?step=1",
    );
    expect(url).toBe(
      "https://story.example.com/api/tools-logout?next=https%3A%2F%2Fbook.example.com%2Fapi%2Fauth%2Ffederated-logout%3Fstep%3D1",
    );
  });

  it("production defaults to tool + canvas only when env unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.FEDERATED_TOOLS_LOGOUT_ORIGINS;
    const { listFederatedToolsLogoutOrigins } = await import(
      "@/lib/federated-tools-logout"
    );
    expect(listFederatedToolsLogoutOrigins()).toEqual([
      "https://tool.example.com",
      "https://canvas.example.com",
    ]);
  });

  it("respects FEDERATED_TOOLS_LOGOUT_ORIGINS when set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(
      "FEDERATED_TOOLS_LOGOUT_ORIGINS",
      "https://story.example.com,https://tool.example.com",
    );
    const { listFederatedToolsLogoutOrigins } = await import(
      "@/lib/federated-tools-logout"
    );
    expect(listFederatedToolsLogoutOrigins()).toEqual([
      "https://story.example.com",
      "https://tool.example.com",
    ]);
  });

  it("resolveBookMallCallbackUrl preserves allowed cross-origin final URLs", async () => {
    const { resolveBookMallCallbackUrl } = await import(
      "@/lib/federated-tools-logout"
    );
    expect(
      resolveBookMallCallbackUrl("https://canvas.example.com/canvas/proj_1"),
    ).toBe("https://canvas.example.com/canvas/proj_1");
    expect(resolveBookMallCallbackUrl("/account")).toBe(
      "https://book.example.com/account",
    );
    expect(resolveBookMallCallbackUrl("https://evil.example.com/")).toBe(
      "https://book.example.com/",
    );
  });
});
