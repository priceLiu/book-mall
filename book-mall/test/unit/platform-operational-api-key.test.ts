import { describe, expect, it, vi, beforeEach } from "vitest";

const { findUnique } = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    gatewayApiKey: { findUnique },
  },
}));

import { isPlatformOperationalApiKey } from "@/lib/gateway/platform-operational-api-key";

describe("isPlatformOperationalApiKey", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("returns true for PLATFORM scope", async () => {
    findUnique.mockResolvedValue({ scope: "PLATFORM" });
    await expect(isPlatformOperationalApiKey("key-1")).resolves.toBe(true);
  });

  it("returns false for PERSONAL scope", async () => {
    findUnique.mockResolvedValue({ scope: "PERSONAL" });
    await expect(isPlatformOperationalApiKey("key-2")).resolves.toBe(false);
  });

  it("returns false when key missing", async () => {
    findUnique.mockResolvedValue(null);
    await expect(isPlatformOperationalApiKey("missing")).resolves.toBe(false);
  });
});
