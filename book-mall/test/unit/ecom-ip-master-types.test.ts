import { describe, expect, it } from "vitest";

import { IP_MASTER_STEPS } from "@/lib/ecom/ecom-ip-master-steps";
import {
  buildIpMasterConstraintBlock,
  bumpIpMasterVersion,
} from "@/lib/ecom/ecom-ip-master-types";

describe("bumpIpMasterVersion", () => {
  it("increments by 0.1", () => {
    expect(bumpIpMasterVersion(undefined)).toBe("V0.1");
    expect(bumpIpMasterVersion("V1.0")).toBe("V1.1");
    expect(bumpIpMasterVersion("V1.9")).toBe("V2.0");
  });
});

describe("buildIpMasterConstraintBlock", () => {
  it("includes rigid anchor preamble and body", () => {
    const block = buildIpMasterConstraintBlock("## 角色\n测试");
    expect(block).toContain("【IP 母版约束】");
    expect(block).toContain("刚性锚点");
    expect(block).toContain("## 角色");
  });

  it("returns empty for blank markdown", () => {
    expect(buildIpMasterConstraintBlock("  ")).toBe("");
  });
});

describe("IP_MASTER_STEPS", () => {
  it("has no step unlock requires", () => {
    for (const step of IP_MASTER_STEPS) {
      expect(step.requires).toEqual([]);
    }
  });
});
