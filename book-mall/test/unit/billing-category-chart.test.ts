import { describe, expect, it } from "vitest";

import {
  isPortraitLibraryGatewayLog,
  resolveDashboardChartCategory,
  DASHBOARD_PORTRAIT_IMPORT_CATEGORY,
} from "@/lib/billing/billing-category";

describe("resolveDashboardChartCategory", () => {
  it("maps persisted OTHER video logs to IMAGE_TO_VIDEO", () => {
    expect(
      resolveDashboardChartCategory(
        { requestKind: "VIDEO", inputSummary: {} },
        "OTHER",
      ),
    ).toBe("IMAGE_TO_VIDEO");
  });

  it("maps portrait library OTHER logs to PORTRAIT_IMPORT", () => {
    expect(
      resolveDashboardChartCategory(
        {
          requestKind: "OTHER",
          model: "portrait:virtual",
          inputSummary: { model: "portrait:virtual" },
        },
        null,
      ),
    ).toBe(DASHBOARD_PORTRAIT_IMPORT_CATEGORY);
  });

  it("never returns OTHER", () => {
    expect(
      resolveDashboardChartCategory({ requestKind: "UNKNOWN" }, "OTHER"),
    ).not.toBe("OTHER");
  });
});

describe("isPortraitLibraryGatewayLog", () => {
  it("detects portrait model from inputSummary", () => {
    expect(
      isPortraitLibraryGatewayLog({
        requestKind: "OTHER",
        inputSummary: { model: "portrait:real" },
      }),
    ).toBe(true);
  });
});
