import { describe, expect, it } from "vitest";

import {
  ADMIN_TEMPLATE_PAGE_SIZE,
  parseAdminListPage,
  sliceAdminPage,
} from "@/lib/admin/admin-template-page";

describe("admin template list pagination", () => {
  it("defaults to 20 items from offset 0", () => {
    expect(parseAdminListPage(new URLSearchParams())).toEqual({
      limit: ADMIN_TEMPLATE_PAGE_SIZE,
      offset: 0,
    });
    expect(ADMIN_TEMPLATE_PAGE_SIZE).toBe(20);
  });

  it("clamps limit and offset", () => {
    expect(
      parseAdminListPage(new URLSearchParams("limit=999&offset=-3")),
    ).toEqual({ limit: 100, offset: 0 });
    expect(parseAdminListPage(new URLSearchParams("limit=0&offset=40"))).toEqual({
      limit: 1,
      offset: 40,
    });
  });

  it("slices a merged list without mutating", () => {
    const items = Array.from({ length: 45 }, (_, i) => i + 1);
    expect(sliceAdminPage(items, 0, 20)).toEqual({
      items: items.slice(0, 20),
      total: 45,
    });
    expect(sliceAdminPage(items, 20, 20)).toEqual({
      items: items.slice(20, 40),
      total: 45,
    });
    expect(sliceAdminPage(items, 40, 20)).toEqual({
      items: items.slice(40),
      total: 45,
    });
  });
});
