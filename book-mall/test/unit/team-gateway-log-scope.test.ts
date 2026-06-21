import { describe, expect, it } from "vitest";

import {
  buildTeamGatewayLogScopeFromContext,
  resolveTeamTenantIdsForGatewayLog,
  type TeamGatewayScopeContext,
} from "@/lib/gateway/log-query-scope";

describe("resolveTeamTenantIdsForGatewayLog", () => {
  const ctx: TeamGatewayScopeContext = {
    tenantIds: ["team-a", "team-b"],
    memberIds: ["member-1", "member-2"],
    apiKeyIds: ["key-team-a"],
    teamsByUser: new Map([
      ["member-1", ["team-a"]],
      ["member-2", ["team-b"]],
    ]),
    apiKeyToTenantIds: new Map([["key-team-a", ["team-a"]]]),
    canvasProjectIds: [],
    canvasProjectToTenant: new Map(),
  };

  it("attributes by tenantId, member actor, and team apiKey independently", () => {
    expect(
      resolveTeamTenantIdsForGatewayLog(
        { tenantId: "team-a", actorBookUserId: null, apiKeyId: null },
        ctx,
      ),
    ).toEqual(["team-a"]);

    expect(
      resolveTeamTenantIdsForGatewayLog(
        { tenantId: null, actorBookUserId: "member-2", apiKeyId: null },
        ctx,
      ),
    ).toEqual(["team-b"]);

    expect(
      resolveTeamTenantIdsForGatewayLog(
        { tenantId: null, actorBookUserId: null, apiKeyId: "key-team-a" },
        ctx,
      ),
    ).toEqual(["team-a"]);
  });

  it("still attributes member actor when tenantId points elsewhere", () => {
    expect(
      resolveTeamTenantIdsForGatewayLog(
        {
          tenantId: "personal-tenant",
          actorBookUserId: "member-1",
          apiKeyId: null,
        },
        ctx,
      ),
    ).toEqual(["team-a"]);
  });

  it("attributes canvas project under team when log tenantId is missing", () => {
    const ctxWithCanvas: TeamGatewayScopeContext = {
      ...ctx,
      canvasProjectIds: ["proj-team-a"],
      canvasProjectToTenant: new Map([["proj-team-a", "team-a"]]),
    };
    expect(
      resolveTeamTenantIdsForGatewayLog(
        {
          tenantId: null,
          actorBookUserId: null,
          apiKeyId: null,
          clientPage: "canvas/proj-team-a/story-pro",
        },
        ctxWithCanvas,
      ),
    ).toEqual(["team-a"]);
  });
});

describe("buildTeamGatewayLogScopeFromContext", () => {
  it("includes tenantId, actors, team api keys, and canvas clientPage", () => {
    const scope = buildTeamGatewayLogScopeFromContext({
      tenantIds: ["team-a"],
      memberIds: ["u1"],
      apiKeyIds: ["sk-team"],
      teamsByUser: new Map(),
      apiKeyToTenantIds: new Map(),
      canvasProjectIds: ["proj-1"],
      canvasProjectToTenant: new Map([["proj-1", "team-a"]]),
    });

    expect(scope).toEqual({
      OR: [
        { tenantId: { in: ["team-a"] } },
        { actorBookUserId: { in: ["u1"] } },
        { apiKeyId: { in: ["sk-team"] } },
        { clientPage: { startsWith: "canvas/proj-1/" } },
        { clientPage: "canvas/proj-1" },
      ],
    });
  });

  it("includes tenantId, actors, and team api keys", () => {
    const scope = buildTeamGatewayLogScopeFromContext({
      tenantIds: ["team-a"],
      memberIds: ["u1"],
      apiKeyIds: ["sk-team"],
      teamsByUser: new Map(),
      apiKeyToTenantIds: new Map(),
      canvasProjectIds: [],
      canvasProjectToTenant: new Map(),
    });

    expect(scope).toEqual({
      OR: [
        { tenantId: { in: ["team-a"] } },
        { actorBookUserId: { in: ["u1"] } },
        { apiKeyId: { in: ["sk-team"] } },
      ],
    });
  });
});
