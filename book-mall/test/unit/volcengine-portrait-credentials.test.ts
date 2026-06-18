import { describe, expect, it } from "vitest";
import { signVolcengineOpenApiRequest } from "@/lib/gateway/volcengine-open-api-sign";
import {
  parseVolcenginePortraitCredentialsFromApiKey,
  resolveVolcenginePortraitCredentialsFromEnv,
} from "@/lib/gateway/volcengine-portrait-credentials";

describe("parseVolcenginePortraitCredentialsFromApiKey", () => {
  it("parses AK:SK pair", () => {
    expect(
      parseVolcenginePortraitCredentialsFromApiKey(
        "AKTEST123:secret-value",
      ),
    ).toEqual({
      accessKeyId: "AKTEST123",
      secretAccessKey: "secret-value",
    });
  });

  it("parses JSON aksk blob", () => {
    expect(
      parseVolcenginePortraitCredentialsFromApiKey(
        JSON.stringify({
          accessKeyId: "AKJSON",
          secretAccessKey: "sk-json",
        }),
      ),
    ).toEqual({
      accessKeyId: "AKJSON",
      secretAccessKey: "sk-json",
    });
  });

  it("rejects ark bearer key", () => {
    expect(
      parseVolcenginePortraitCredentialsFromApiKey(
        "ark-9b038b6a-aac6-41b4-aca5-26fa9f69fd0c-a2d2f",
      ),
    ).toBeNull();
  });
});

describe("signVolcengineOpenApiRequest", () => {
  it("builds Authorization with HMAC-SHA256", () => {
    const headers = signVolcengineOpenApiRequest({
      method: "POST",
      path: "/open/ListAssetGroups",
      body: '{"GroupType":"AIGC"}',
      accessKeyId: "AKTEST",
      secretAccessKey: "SKTEST",
      host: "open.volcengineapi.com",
    });
    expect(headers.Authorization).toMatch(/^HMAC-SHA256 Credential=AKTEST\//);
    expect(headers.Authorization).toContain("SignedHeaders=host;x-date");
    expect(headers["X-Date"]).toMatch(/^\d{8}T\d{6}Z$/);
    expect(headers.Host).toBe("open.volcengineapi.com");
  });
});

describe("resolveVolcenginePortraitCredentialsFromEnv", () => {
  it("returns null when env unset", () => {
    const prevAk = process.env.VOLCENGINE_ACCESS_KEY;
    const prevSk = process.env.VOLCENGINE_SECRET_ACCESS_KEY;
    delete process.env.VOLCENGINE_ACCESS_KEY;
    delete process.env.VOLCENGINE_SECRET_ACCESS_KEY;
    expect(resolveVolcenginePortraitCredentialsFromEnv()).toBeNull();
    if (prevAk) process.env.VOLCENGINE_ACCESS_KEY = prevAk;
    if (prevSk) process.env.VOLCENGINE_SECRET_ACCESS_KEY = prevSk;
  });
});
