import { describe, expect, it } from "vitest";

import { applyStoryboardPickerTemplateFilter } from "@/lib/storyboard-model-type-filter";

describe("applyStoryboardPickerTemplateFilter", () => {
  const models = [
    { modelKey: "doubao-seedream-5-0-pro" },
    { modelKey: "wanx-background-generation-v2" },
  ];

  it("drops Wanx when a t2i template contains Seedream", () => {
    expect(
      applyStoryboardPickerTemplateFilter(models, ["doubao-seedream-5-0-pro"], false).map(
        (m) => m.modelKey,
      ),
    ).toEqual(["doubao-seedream-5-0-pro"]);
  });

  it("keeps Wanx for dedicated pickers that skip the template filter", () => {
    expect(
      applyStoryboardPickerTemplateFilter(models, ["doubao-seedream-5-0-pro"], true).map(
        (m) => m.modelKey,
      ),
    ).toEqual(["doubao-seedream-5-0-pro", "wanx-background-generation-v2"]);
  });
});
