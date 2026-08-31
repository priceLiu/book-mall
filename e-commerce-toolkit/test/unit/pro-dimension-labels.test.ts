import { describe, expect, it } from "vitest";

import { proCategoryChoiceLabel } from "@/lib/pro-vertical/categories";
import {
  buildProDimensionMessageLabels,
  buildProDimensionsFromChat,
} from "@/lib/pro-vertical/dimensions";

describe("pro dimension message labels", () => {
  it("skips category pick before mapping digital_3c dimension steps", () => {
    const messages = [
      { id: "u0", role: "user", content: proCategoryChoiceLabel("3C 数码") },
      { id: "u1", role: "user", content: "手机" },
      { id: "u2", role: "user", content: "通用" },
      { id: "u3", role: "user", content: "极简科技" },
    ];
    const labels = buildProDimensionMessageLabels("digital_3c", messages);
    expect(labels.get("u1")).toMatchObject({ label: "产品大类", progress: "1/7" });
    expect(labels.get("u2")).toMatchObject({ label: "产品细项", progress: "2/7" });
    expect(labels.get("u3")).toMatchObject({ label: "设计语言", progress: "3/7" });
  });

  it("builds dimensions from chat without consuming category pick as productCategory", () => {
    const messages = [
      { role: "user", content: proCategoryChoiceLabel("3C 数码") },
      { role: "user", content: "手机" },
      { role: "user", content: "旗舰机" },
    ];
    const dims = buildProDimensionsFromChat("digital_3c", messages);
    expect(dims.productCategory).toBe("手机");
    expect(dims.productSubCategory).toBe("旗舰机");
  });
});
