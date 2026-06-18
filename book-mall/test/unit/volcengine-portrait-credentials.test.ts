import { describe, expect, it } from "vitest";
import { signVolcengineOpenApiRequest } from "@/lib/gateway/volcengine-open-api-sign";
import {
  buildVolcengineCredentialStorage,
  parseVolcengineGatewayCredential,
  parseVolcenginePortraitCredentialsFromApiKey,
  resolveVolcengineArkApiKey,
  resolveVolcenginePortraitCredentials,
  resolveVolcenginePortraitCredentialsFromEnv,
} from "@/lib/gateway/volcengine-gateway-credential";

describe("parseVolcengineGatewayCredential", () => {
  it("parses plain ark key", () => {
    expect(
      parseVolcengineGatewayCredential("ark-9b038b6a-aac6-41b4-aca5-26fa9f69fd0c-a2d2f"),
    ).toEqual({
      arkApiKey: "ark-9b038b6a-aac6-41b4-aca5-26fa9f69fd0c-a2d2f",
    });
  });

  it("parses combined ark + IAM JSON", () => {
    expect(
      parseVolcengineGatewayCredential(
        JSON.stringify({
          apiKey: "ark-combined",
          accessKeyId: "AKCOMBINED",
          secretAccessKey: "sk-combined",
        }),
      ),
    ).toEqual({
      arkApiKey: "ark-combined",
      portraitIam: {
        accessKeyId: "AKCOMBINED",
        secretAccessKey: "sk-combined",
      },
    });
  });

  it("parses legacy AK:SK only", () => {
    expect(parseVolcengineGatewayCredential("AKTEST123:secret-value")).toEqual({
      arkApiKey: "",
      portraitIam: {
        accessKeyId: "AKTEST123",
        secretAccessKey: "secret-value",
      },
    });
  });
});

describe("buildVolcengineCredentialStorage", () => {
  it("stores plain ark when no IAM", () => {
    expect(
      buildVolcengineCredentialStorage({ apiKey: "ark-only-key-12345678" }),
    ).toBe("ark-only-key-12345678");
  });

  it("stores JSON when ark + IAM", () => {
    const raw = buildVolcengineCredentialStorage({
      apiKey: "ark-combined",
      accessKeyId: "AKX",
      secretAccessKey: "SKX",
    });
    expect(JSON.parse(raw)).toEqual({
      apiKey: "ark-combined",
      accessKeyId: "AKX",
      secretAccessKey: "SKX",
    });
  });

  it("merges partial patch with existing JSON", () => {
    const existing = JSON.stringify({
      apiKey: "ark-old",
      accessKeyId: "AKOLD",
      secretAccessKey: "SKOLD",
    });
    const raw = buildVolcengineCredentialStorage({
      apiKey: "ark-new",
      existingRaw: existing,
    });
    expect(JSON.parse(raw)).toEqual({
      apiKey: "ark-new",
      accessKeyId: "AKOLD",
      secretAccessKey: "SKOLD",
    });
  });
});

describe("resolveVolcengineArkApiKey", () => {
  it("returns ark from combined blob", () => {
    expect(
      resolveVolcengineArkApiKey(
        JSON.stringify({ apiKey: "ark-x", accessKeyId: "AK", secretAccessKey: "SK" }),
      ),
    ).toBe("ark-x");
  });

  it("throws when only IAM configured", () => {
    expect(() =>
      resolveVolcengineArkApiKey("AKONLY:skonly"),
    ).toThrow(/ARK API Key/);
  });
});

describe("resolveVolcenginePortraitCredentials", () => {
  it("reads IAM from gateway JSON", () => {
    expect(
      resolveVolcenginePortraitCredentials(
        JSON.stringify({
          apiKey: "ark-x",
          accessKeyId: "AKJSON",
          secretAccessKey: "sk-json",
        }),
      ),
    ).toEqual({
      accessKeyId: "AKJSON",
      secretAccessKey: "sk-json",
    });
  });

  it("throws when ark-only credential", () => {
    expect(() =>
      resolveVolcenginePortraitCredentials("ark-only-key-12345678"),
    ).toThrow(/Gateway 火山凭证/);
  });
});

describe("parseVolcenginePortraitCredentialsFromApiKey", () => {
  it("parses AK:SK pair", () => {
    expect(
      parseVolcenginePortraitCredentialsFromApiKey("AKTEST123:secret-value"),
    ).toEqual({
      accessKeyId: "AKTEST123",
      secretAccessKey: "secret-value",
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
