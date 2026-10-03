import { describe, expect, it } from "vitest";

import {
  IP_MASTER_DEFAULT_BRIEF,
  buildIpMasterExtractUserMessage,
  isIpMasterInputCommitted,
  parseIpMasterInputMode,
  validateIpMasterInputForExtract,
} from "@/lib/ecom/ecom-ip-master-input-presets";

describe("ip master input modes", () => {
  it("parse mode defaults to 3", () => {
    expect(parseIpMasterInputMode(undefined)).toBe("3");
    expect(parseIpMasterInputMode("2")).toBe("2");
  });

  it("validates mode 1 requires image", () => {
    expect(
      validateIpMasterInputForExtract({
        mode: "1",
        hasBenchmark: false,
        briefText: "x",
      }),
    ).toMatch(/须上传/);
  });

  it("blocks mode 3 on fresh project (default brief, no image)", () => {
    expect(
      validateIpMasterInputForExtract({
        mode: "3",
        hasBenchmark: false,
        briefText: IP_MASTER_DEFAULT_BRIEF,
      }),
    ).toMatch(/须上传基准图/);
  });

  it("inputCommitted false on new project until user acts", () => {
    expect(
      isIpMasterInputCommitted({
        references: [],
        chatHistory: [],
        meta: { workflow: { inputCommitted: false } },
        brief: { description: IP_MASTER_DEFAULT_BRIEF },
      }),
    ).toBe(false);
  });

  it("extract message mentions mode", () => {
    expect(buildIpMasterExtractUserMessage("3")).toContain("模式 3");
  });

  it("mode 4 allows template generate without benchmark", () => {
    expect(
      validateIpMasterInputForExtract({
        mode: "4",
        hasBenchmark: false,
        briefText: IP_MASTER_DEFAULT_BRIEF,
      }),
    ).toBeNull();
  });
});
