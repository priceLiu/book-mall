import { describe, expect, it } from "vitest";

import { formatAdminDocFileTime } from "@/lib/admin/format-doc-file-time";
import { getRepoDocFileTimes } from "@/lib/admin/read-repo-doc";

describe("formatAdminDocFileTime", () => {
  it("formats ISO timestamps in zh-CN", () => {
    const out = formatAdminDocFileTime("2026-06-04T14:58:26.000Z");
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/06/);
  });
});

describe("getRepoDocFileTimes", () => {
  it("returns times for docs/ep.md", async () => {
    const times = await getRepoDocFileTimes("docs/ep.md");
    expect(times).not.toBeNull();
    expect(times!.createdAt).toMatch(/^\d{4}-/);
    expect(times!.updatedAt).toMatch(/^\d{4}-/);
  });
});
