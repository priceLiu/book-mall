import { describe, expect, it, afterEach } from "vitest";

import { authorizeTrafficIngest } from "@/lib/site-traffic/ingest-auth";
import {
  pickTrafficIngestSecret,
  platformTrafficIngestSecrets,
} from "@/lib/platform-traffic/traffic-ingest-secret";
import { resolveBookMallOrigin } from "@/lib/platform-traffic/book-mall-origin";

function mockRequest(bearer?: string): Parameters<typeof authorizeTrafficIngest>[0] {
  return {
    headers: new Headers(bearer ? { authorization: `Bearer ${bearer}` } : {}),
  } as Parameters<typeof authorizeTrafficIngest>[0];
}

describe("platformTrafficIngestSecrets", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("dedupes TOOLS_SSO and GATEWAY_SSO when equal", () => {
    process.env = {
      ...env,
      TOOLS_SSO_SERVER_SECRET: "a".repeat(16),
      GATEWAY_SSO_SERVER_SECRET: "a".repeat(16),
    };
    expect(platformTrafficIngestSecrets()).toEqual(["a".repeat(16)]);
    expect(pickTrafficIngestSecret()).toBe("a".repeat(16));
  });

  it("accepts either secret on book ingest", () => {
    process.env = {
      ...env,
      TOOLS_SSO_SERVER_SECRET: "tools-secret-min-16",
      GATEWAY_SSO_SERVER_SECRET: "gateway-secret-min16",
    };
    expect(authorizeTrafficIngest(mockRequest("tools-secret-min-16"))).toEqual({ ok: true });
    expect(authorizeTrafficIngest(mockRequest("gateway-secret-min16"))).toEqual({ ok: true });
    expect(authorizeTrafficIngest(mockRequest("wrong-secret-min16"))).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("resolveBookMallOrigin falls back to NEXTAUTH_URL", () => {
    process.env = {
      ...env,
      MAIN_SITE_ORIGIN: "",
      NEXT_PUBLIC_BOOK_MALL_URL: "",
      NEXTAUTH_URL: "http://localhost:3000",
    };
    expect(resolveBookMallOrigin()).toBe("http://localhost:3000");
  });
});
