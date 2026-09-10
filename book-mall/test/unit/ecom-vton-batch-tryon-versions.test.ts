import { describe, expect, it } from "vitest";

import {
  buildVtonBatchResultsForRun,
  mergeVtonBatchRunIntoResults,
} from "@/lib/ecom/ecom-vton/batch-tryon";
import { appendVtonTryonResultVersion } from "@/lib/ecom/ecom-vton/tryon-result-versions";
import type { VtonLookSpec, VtonTryonResult } from "@/lib/ecom/ecom-vton/types";

describe("ecom-vton batch tryon versions", () => {
  const looks: VtonLookSpec[] = [
    { id: "l1", kind: "full_set", fullSetGarmentId: "g1", label: "套装 1" },
    { id: "l2", kind: "top_only", topGarmentId: "g2", label: "仅上装 2" },
  ];

  it("buildVtonBatchResultsForRun skips never-tried non-target looks", () => {
    const built = buildVtonBatchResultsForRun({
      allLooks: looks,
      targetLooks: [looks[0]!],
      previousResults: [],
    });
    expect(built).toHaveLength(1);
    expect(built[0]?.lookId).toBe("l1");
  });

  it("buildVtonBatchResultsForRun preserves versions for target looks", () => {
    const previous: VtonTryonResult[] = [
      {
        id: "r1",
        lookId: "l1",
        status: "success",
        ossUrl: "https://x/v1.jpg",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const built = buildVtonBatchResultsForRun({
      allLooks: looks,
      targetLooks: [looks[0]!],
      previousResults: previous,
    });

    const row = built.find((r) => r.lookId === "l1");
    expect(row?.versions).toHaveLength(1);
    expect(row?.versions?.[0]?.ossUrl).toBe("https://x/v1.jpg");
    expect(row?.status).toBe("pending");
  });

  it("append after seed keeps history for regenerate", () => {
    const previous: VtonTryonResult[] = [
      {
        id: "r1",
        lookId: "l1",
        status: "success",
        ossUrl: "https://x/v1.jpg",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const built = buildVtonBatchResultsForRun({
      allLooks: looks,
      targetLooks: [looks[0]!],
      previousResults: previous,
    });
    const row = built.find((r) => r.lookId === "l1")!;
    appendVtonTryonResultVersion(row, "https://x/v2.jpg");

    expect(row.versions).toHaveLength(2);
    expect(row.versions?.[0]?.ossUrl).toBe("https://x/v1.jpg");
    expect(row.versions?.[1]?.ossUrl).toBe("https://x/v2.jpg");
    expect(row.activeVersionIndex).toBe(1);
  });

  it("mergeVtonBatchRunIntoResults updates target row by lookId", () => {
    const merged: VtonTryonResult[] = [
      {
        id: "r1",
        lookId: "l1",
        status: "pending",
        ossUrl: "https://x/v1.jpg",
        createdAt: "2026-01-01T00:00:00.000Z",
        versions: [{ ossUrl: "https://x/v1.jpg", createdAt: "2026-01-01T00:00:00.000Z", resultId: "r1" }],
      },
      {
        id: "r2",
        lookId: "l2",
        status: "success",
        ossUrl: "https://x/other.jpg",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const runResult: VtonTryonResult = {
      id: "r1-new",
      lookId: "l1",
      status: "success",
      ossUrl: "https://x/v2.jpg",
      createdAt: "2026-01-02T00:00:00.000Z",
      versions: [
        { ossUrl: "https://x/v1.jpg", createdAt: "2026-01-01T00:00:00.000Z", resultId: "r1-new" },
        { ossUrl: "https://x/v2.jpg", createdAt: "2026-01-02T00:00:00.000Z", resultId: "r1-new" },
      ],
      activeVersionIndex: 1,
    };

    const next = mergeVtonBatchRunIntoResults(merged, [runResult]);
    expect(next.find((r) => r.lookId === "l1")?.versions).toHaveLength(2);
    expect(next.find((r) => r.lookId === "l2")?.ossUrl).toBe("https://x/other.jpg");
  });
});
