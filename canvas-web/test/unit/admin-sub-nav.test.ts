import { describe, expect, it } from "vitest";

import { CANVAS_ADMIN_SUB_NAV } from "@/lib/site-config";

function isCanvasAdminSubNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

describe("CANVAS_ADMIN_SUB_NAV", () => {
  it("includes workflow, film, and templates routes", () => {
    const hrefs = CANVAS_ADMIN_SUB_NAV.map((i) => i.href);
    expect(hrefs).toContain("/admin/portal");
    expect(hrefs).toContain("/admin/film");
    expect(hrefs).toContain("/admin/templates");
  });
});

describe("admin sub-nav active matching", () => {
  it("matches exact and nested paths", () => {
    expect(isCanvasAdminSubNavActive("/admin/portal", "/admin/portal")).toBe(true);
    expect(isCanvasAdminSubNavActive("/admin/templates/extra", "/admin/templates")).toBe(
      true,
    );
    expect(isCanvasAdminSubNavActive("/admin", "/admin/portal")).toBe(false);
  });
});
