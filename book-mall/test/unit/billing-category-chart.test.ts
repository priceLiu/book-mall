import { describe, expect, it } from "vitest";

import { resolveDashboardChartCategory } from "@/lib/billing/billing-category";

describe("resolveDashboardChartCategory", () => {
  it("maps persisted OTHER video logs to IMAGE_TO_VIDEO", () => {
    expect(
      resolveDashboardChartCategory(
        { requestKind: "VIDEO", inputSummary: {} },
        "OTHER",
      ),
    ).toBe("IMAGE_TO_VIDEO");
  });

  it("never returns OTHER", () => {
    expect(
      resolveDashboardChartCategory({ requestKind: "UNKNOWN" }, "OTHER"),
    ).not.toBe("OTHER");
  });
});
