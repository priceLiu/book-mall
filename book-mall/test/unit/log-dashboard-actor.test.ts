import { describe, expect, it } from "vitest";

import {
  parseActorPhoneQuery,
  resolveBookUserIdsByPhoneQuery,
} from "@/lib/gateway/log-dashboard-actor";

describe("parseActorPhoneQuery", () => {
  it("trims phone input", () => {
    expect(parseActorPhoneQuery(" 13800138000 ")).toBe("13800138000");
  });
});

describe("resolveBookUserIdsByPhoneQuery", () => {
  it("returns empty for short partial", async () => {
    await expect(resolveBookUserIdsByPhoneQuery("138")).resolves.toEqual([]);
  });
});
