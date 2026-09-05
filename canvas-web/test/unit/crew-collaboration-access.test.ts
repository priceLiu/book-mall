import { describe, expect, it } from "vitest";
import { crewCollaborationAccessFromIntrospect } from "@/lib/canvas/crew-collaboration-access";

describe("crewCollaborationAccessFromIntrospect", () => {
  it("grants publish to platform admin in personal tenant", () => {
    const access = crewCollaborationAccessFromIntrospect({
      tools_role: "admin",
      tenant_type: "PERSONAL",
      role_type: "OWNER",
    });
    expect(access.isPlatformAdmin).toBe(true);
    expect(access.canPublishScript).toBe(true);
    expect(access.canUseCrewBulletin).toBe(true);
    expect(access.canTeamShareOnPublish).toBe(false);
  });

  it("grants publish and team share to platform admin in team tenant", () => {
    const access = crewCollaborationAccessFromIntrospect({
      tools_role: "admin",
      tenant_type: "TEAM",
      role_type: "MEMBER",
    });
    expect(access.canPublishScript).toBe(true);
    expect(access.canTeamShareOnPublish).toBe(true);
  });

  it("grants publish to team admin without platform admin", () => {
    const access = crewCollaborationAccessFromIntrospect({
      tools_role: "member",
      tenant_type: "TEAM",
      role_type: "ADMIN",
    });
    expect(access.isPlatformAdmin).toBe(false);
    expect(access.canPublishScript).toBe(true);
    expect(access.canTeamShareOnPublish).toBe(true);
  });

  it("denies publish for team member without platform admin", () => {
    const access = crewCollaborationAccessFromIntrospect({
      tools_role: "member",
      tenant_type: "TEAM",
      role_type: "MEMBER",
    });
    expect(access.canPublishScript).toBe(false);
    expect(access.canUseCrewBulletin).toBe(true);
  });
});
