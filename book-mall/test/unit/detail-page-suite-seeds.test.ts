import { describe, expect, it } from "vitest";

import {
  CATEGORY_SEED_META,
  sumModuleMax,
} from "@/lib/ecom/detail-page-suite/category-seeds";
import { ECOM_DETAIL_PAGE_SUITE_GLOBAL_MAX } from "@/lib/ecom/detail-page-suite/types";

describe("detail-page-suite seeds", () => {
  it("three categories each sum to global max", () => {
    const keys = Object.keys(CATEGORY_SEED_META);
    expect(keys).toHaveLength(3);
    for (const meta of Object.values(CATEGORY_SEED_META)) {
      expect(meta.modules).toHaveLength(12);
      expect(sumModuleMax(meta.modules)).toBe(ECOM_DETAIL_PAGE_SUITE_GLOBAL_MAX);
    }
  });
});
