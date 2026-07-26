import { describe, expect, it } from "vitest";

import {
  dashscopeSbv1T2vModelToR2v,
  upgradeDashscopeT2vModelWhenRefsPresent,
} from "@/lib/canvas/dashscope-sbv1-t2v";

describe("dashscopeSbv1T2vModelToR2v", () => {
  it("maps HappyHorse / Wan T2V to matching R2V keys", () => {
    expect(dashscopeSbv1T2vModelToR2v("happyhorse-1.1-t2v")).toBe(
      "happyhorse-1.1-r2v",
    );
    expect(dashscopeSbv1T2vModelToR2v("wan2.7-t2v-2026-04-25")).toBe(
      "wan2.7-r2v",
    );
  });
});

describe("upgradeDashscopeT2vModelWhenRefsPresent", () => {
  it("keeps T2V when no reference images", () => {
    expect(
      upgradeDashscopeT2vModelWhenRefsPresent("happyhorse-1.1-t2v", []),
    ).toBe("happyhorse-1.1-t2v");
  });

  it("upgrades to R2V when reference images are present", () => {
    expect(
      upgradeDashscopeT2vModelWhenRefsPresent("happyhorse-1.1-t2v", [
        "https://oss.example/a.png",
        "https://oss.example/b.png",
      ]),
    ).toBe("happyhorse-1.1-r2v");
  });

  it("leaves non-T2V models unchanged", () => {
    expect(
      upgradeDashscopeT2vModelWhenRefsPresent("doubao-seedance-2.0", [
        "https://oss.example/a.png",
      ]),
    ).toBe("doubao-seedance-2.0");
  });
});
