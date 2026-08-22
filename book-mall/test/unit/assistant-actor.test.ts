import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(async () => null),
}));

vi.mock("@/lib/sso-tools-bearer", () => ({
  verifyToolsBearer: vi.fn(() => ({ ok: false })),
}));

import { resolveAssistantActor } from "@/lib/platform-assistant/assistant-actor";

describe("resolveAssistantActor", () => {
  it("returns guest actor when no session or bearer", async () => {
    const req = new Request("http://localhost/api/platform-assistant/chat", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });
    const actor = await resolveAssistantActor(req);
    expect(actor.isGuest).toBe(true);
    expect(actor.userId).toBeNull();
    expect(actor.rateLimitKey).toBe("guest:203.0.113.10");
  });
});
