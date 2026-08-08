import { describe, expect, it } from "vitest";

import {
  buildDashscopeSbv1T2vVideoBody,
  dashscopeSbv1T2vModelToR2v,
  isDashscopeSbv1TextToVideoModel,
  resolveDashscopeT2vRefMismatchMessage,
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

describe("wan3.0-video", () => {
  it("is registered as DashScope T2V", () => {
    expect(isDashscopeSbv1TextToVideoModel("wan3.0-video")).toBe(true);
  });

  it("builds wan3 body with 480P and 30s cap", () => {
    const body = buildDashscopeSbv1T2vVideoBody({
      prompt: "test",
      aspectRatio: "16:9",
      resolution: "480P",
      durationSec: 45,
      modelKey: "wan3.0-video",
    });
    expect(body.parameters.resolution).toBe("480P");
    expect(body.parameters.duration).toBe(30);
  });
});

describe("resolveDashscopeT2vRefMismatchMessage", () => {
  it("returns null when no reference images", () => {
    expect(
      resolveDashscopeT2vRefMismatchMessage("happyhorse-1.1-t2v", []),
    ).toBeNull();
  });

  it("returns mismatch message when T2V has reference images", () => {
    const msg = resolveDashscopeT2vRefMismatchMessage("happyhorse-1.1-t2v", [
      "https://oss.example/a.png",
      "https://oss.example/b.png",
    ]);
    expect(msg).toContain("happyhorse-1.1-t2v");
    expect(msg).toContain("happyhorse-1.1-r2v");
    expect(msg).toContain("2 张");
  });

  it("returns null for non-T2V models with refs", () => {
    expect(
      resolveDashscopeT2vRefMismatchMessage("doubao-seedance-2.0", [
        "https://oss.example/a.png",
      ]),
    ).toBeNull();
  });
});
