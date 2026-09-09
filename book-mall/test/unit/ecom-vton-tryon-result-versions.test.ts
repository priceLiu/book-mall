import { describe, expect, it } from "vitest";

import {
  appendVtonTryonResultVersion,
  normalizeVtonTryonResultVersions,
  resolveVtonTryonActiveOssUrl,
} from "@/lib/ecom/ecom-vton/tryon-result-versions";
import type { VtonTryonResult } from "@/lib/ecom/ecom-vton/types";

describe("ecom-vton tryon result versions", () => {
  it("appends versions without overwriting history", () => {
    const result: VtonTryonResult = {
      id: "r1",
      lookId: "l1",
      status: "success",
      ossUrl: "https://x/v1.jpg",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    appendVtonTryonResultVersion(result, "https://x/v2.jpg");
    expect(result.versions).toHaveLength(2);
    expect(result.versions?.[0]?.ossUrl).toBe("https://x/v1.jpg");
    expect(result.versions?.[1]?.ossUrl).toBe("https://x/v2.jpg");
    expect(result.activeVersionIndex).toBe(1);
    expect(resolveVtonTryonActiveOssUrl(result)).toBe("https://x/v2.jpg");
  });

  it("normalizes legacy single ossUrl as one version", () => {
    const versions = normalizeVtonTryonResultVersions({
      id: "r1",
      lookId: "l1",
      status: "success",
      ossUrl: "https://x/only.jpg",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(versions).toHaveLength(1);
    expect(versions[0]?.ossUrl).toBe("https://x/only.jpg");
  });
});
