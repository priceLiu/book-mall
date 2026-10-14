import { describe, expect, it } from "vitest";

import { buildAdminUsersListWhere } from "@/lib/admin/admin-users-query";

describe("buildAdminUsersListWhere", () => {
  it("returns undefined when no filters", () => {
    expect(buildAdminUsersListWhere({})).toBeUndefined();
    expect(buildAdminUsersListWhere({ phone: "  ", name: "" })).toBeUndefined();
  });

  it("matches normalized phone exactly", () => {
    expect(buildAdminUsersListWhere({ phone: "+86 138 0013 8000" })).toEqual({
      phone: "13800138000",
    });
  });

  it("uses contains for partial phone digits", () => {
    expect(buildAdminUsersListWhere({ phone: "8000" })).toEqual({
      phone: { contains: "8000" },
    });
  });

  it("matches nickname case-insensitively", () => {
    expect(buildAdminUsersListWhere({ name: "Alice" })).toEqual({
      name: { contains: "Alice", mode: "insensitive" },
    });
  });

  it("combines phone and name with AND", () => {
    expect(
      buildAdminUsersListWhere({ phone: "13800138000", name: "张" }),
    ).toEqual({
      AND: [{ phone: "13800138000" }, { name: { contains: "张", mode: "insensitive" } }],
    });
  });
});
