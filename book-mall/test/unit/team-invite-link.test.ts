import { describe, expect, it } from "vitest";

import { pickTeamInviteUrlCode } from "@/lib/tenant/team-invite-link";

describe("pickTeamInviteUrlCode", () => {
  it("prefers stored urlCode over stale query code", () => {
    expect(
      pickTeamInviteUrlCode({ code: "111111" }, "222222"),
    ).toBe("222222");
  });

  it("falls back to query when stored is empty", () => {
    expect(pickTeamInviteUrlCode({ code: "333333" }, null)).toBe("333333");
  });

  it("returns null when neither is present", () => {
    expect(pickTeamInviteUrlCode({}, null)).toBeNull();
  });
});
