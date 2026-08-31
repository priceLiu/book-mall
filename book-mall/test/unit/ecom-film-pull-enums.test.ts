import { describe, expect, it } from "vitest";

import {
  clampFilmPullDurationSec,
  normalizeCameraMovement,
  normalizeCutTransition,
  normalizeShotScale,
} from "@/lib/ecom/ecom-film-pull-enums";

describe("ecom-film-pull-enums", () => {
  it("normalizes shot scale aliases", () => {
    expect(normalizeShotScale("切至中景")).toBe("中景");
    expect(normalizeShotScale("")).toBe("中景");
  });

  it("normalizes cut transition", () => {
    expect(normalizeCutTransition("切")).toBe("硬切");
    expect(normalizeCutTransition("叠化转场")).toBe("叠化");
  });

  it("normalizes camera movement", () => {
    expect(normalizeCameraMovement("无")).toBe("固定机位");
    expect(normalizeCameraMovement("横移跟拍")).toBe("横移跟拍");
  });

  it("clamps duration", () => {
    expect(clampFilmPullDurationSec(0)).toBe(5);
    expect(clampFilmPullDurationSec(45)).toBe(30);
    expect(clampFilmPullDurationSec(2.333)).toBe(2.33);
  });
});
