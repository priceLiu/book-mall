import { describe, expect, it } from "vitest";

import {
  buildGenerationRecordsLibraryPath,
  ECOM_GENERATION_RECORD_LIBRARY_PATH,
} from "@/lib/ecom-generation-record-api";

describe("buildGenerationRecordsLibraryPath", () => {
  it("returns base path without query", () => {
    expect(buildGenerationRecordsLibraryPath()).toBe(ECOM_GENERATION_RECORD_LIBRARY_PATH);
    expect(buildGenerationRecordsLibraryPath({})).toBe(ECOM_GENERATION_RECORD_LIBRARY_PATH);
  });

  it("includes project filter params", () => {
    const href = buildGenerationRecordsLibraryPath({
      projectId: "proj_1",
      sourceModule: "detail-page-suite-hit",
      returnTo: "/ecom/detail-page-suite-hit",
      projectTitle: "冬季羽绒服",
    });
    expect(href.startsWith(`${ECOM_GENERATION_RECORD_LIBRARY_PATH}?`)).toBe(true);
    const q = new URLSearchParams(href.split("?")[1]);
    expect(q.get("projectId")).toBe("proj_1");
    expect(q.get("sourceModule")).toBe("detail-page-suite-hit");
    expect(q.get("returnTo")).toBe("/ecom/detail-page-suite-hit");
    expect(q.get("projectTitle")).toBe("冬季羽绒服");
  });
});
