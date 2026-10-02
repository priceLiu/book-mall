import { describe, expect, it } from "vitest";

import {
  ECOM_COUNTRY_OPTIONS,
  ECOM_LANGUAGE_OPTIONS,
  ECOM_PLATFORM_OPTIONS,
  normalizeEcomLanguageValue,
  normalizeEcomPlatformValue,
} from "@/lib/ecom-generation-settings/constants";
import { ECOM_DETAIL_TEMPLATE_OPTIONS } from "@/lib/ecom-generation-settings/detail-template";

describe("ecom-generation-settings", () => {
  it("lists match product mock counts", () => {
    expect(ECOM_PLATFORM_OPTIONS).toHaveLength(16);
    expect(ECOM_COUNTRY_OPTIONS).toHaveLength(11);
    expect(ECOM_LANGUAGE_OPTIONS).toHaveLength(11);
    expect(ECOM_DETAIL_TEMPLATE_OPTIONS).toHaveLength(7);
  });

  it("normalizes legacy platform and language", () => {
    expect(normalizeEcomPlatformValue("taobao")).toBe("taobao-tmall-1688");
    expect(normalizeEcomLanguageValue("西班牙语")).toBe("西语");
  });
});
