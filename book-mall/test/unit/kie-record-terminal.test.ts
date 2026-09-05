import { describe, expect, it } from "vitest";

import {
  isKieRecordComplete,
  isKieRecordFail,
  isKieRecordSuccess,
} from "@/lib/story/kie-client";

describe("kie record terminal detection", () => {
  it("accepts success and succeeded", () => {
    expect(isKieRecordSuccess("success")).toBe(true);
    expect(isKieRecordSuccess("SUCCEEDED")).toBe(true);
    expect(isKieRecordSuccess("waiting")).toBe(false);
  });

  it("accepts fail and failed", () => {
    expect(isKieRecordFail("fail")).toBe(true);
    expect(isKieRecordFail("FAILED")).toBe(true);
    expect(isKieRecordFail("waiting")).toBe(false);
  });

  it("treats completeTime + resultJson as complete even when state lags", () => {
    expect(
      isKieRecordComplete({
        taskId: "t1",
        model: "nano-banana-pro",
        state: "waiting",
        completeTime: Date.now(),
        resultJson: '{"resultUrls":["https://x/a.png"]}',
      }),
    ).toBe(true);
  });

  it("accepts non-canonical vendor state strings", () => {
    expect(
      isKieRecordComplete({
        state: "SUCCEEDED",
        completeTime: undefined,
        resultJson: undefined,
      }),
    ).toBe(true);
    expect(
      isKieRecordComplete({
        state: "running",
        completeTime: Date.now(),
        resultJson: '{"resultUrls":["https://x/a.png"]}',
      }),
    ).toBe(true);
  });
});
