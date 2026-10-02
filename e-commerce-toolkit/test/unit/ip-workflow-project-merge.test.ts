import { describe, expect, it } from "vitest";

import {
  applyEcomIpWorkflowProjectSnapshot,
  mergeEcomIpWorkflowProject,
} from "@/lib/ecom-ip-workflow-image-gen-dock";

describe("mergeEcomIpWorkflowProject", () => {
  it("keeps prior imageUrl when incoming snapshot omits it", () => {
    const prev = {
      updatedAt: "2026-10-02T12:00:01.000Z",
      plan: {
        steps: {
          emoji: {
            status: "ready",
            slots: [{ index: 1, title: "a", imageUrl: "https://oss/a.png" }],
          },
        },
      },
    };
    const incoming = {
      updatedAt: "2026-10-02T12:00:02.000Z",
      plan: {
        steps: {
          emoji: {
            status: "generating",
            slots: [{ index: 1, title: "a", prompt: "x" }],
          },
        },
      },
    };
    const merged = mergeEcomIpWorkflowProject(prev, incoming);
    expect(merged.plan.steps.emoji.slots[0]?.imageUrl).toBe("https://oss/a.png");
  });

  it("drops generating when merged slots are all filled", () => {
    const prev = {
      updatedAt: "2026-10-02T12:00:01.000Z",
      plan: {
        steps: {
          merch: {
            status: "generating",
            slots: [
              { index: 1, imageUrl: "https://oss/1.png" },
              { index: 2, imageUrl: "https://oss/2.png" },
            ],
          },
        },
      },
    };
    const incoming = {
      updatedAt: "2026-10-02T12:00:00.000Z",
      plan: {
        steps: {
          merch: {
            status: "generating",
            slots: [
              { index: 1, imageUrl: "https://oss/1.png" },
              { index: 2, imageUrl: "https://oss/2.png" },
            ],
          },
        },
      },
    };
    const merged = mergeEcomIpWorkflowProject(prev, incoming);
    expect(merged.plan.steps.merch.status).toBe("ready");
  });

  it("keeps slot urls from incoming when incoming updatedAt is older", () => {
    const prev = {
      updatedAt: "2026-10-02T12:00:02.000Z",
      plan: {
        steps: {
          merch: {
            status: "generating",
            slots: [{ index: 1 }, { index: 2 }],
          },
        },
      },
    };
    const incoming = {
      updatedAt: "2026-10-02T12:00:01.000Z",
      plan: {
        steps: {
          merch: {
            status: "pending",
            slots: [
              { index: 1, imageUrl: "https://oss/1.png" },
              { index: 2, imageUrl: "https://oss/2.png" },
            ],
          },
        },
      },
    };
    const merged = mergeEcomIpWorkflowProject(prev, incoming);
    expect(merged.plan.steps.merch.slots[0]?.imageUrl).toBe("https://oss/1.png");
    expect(merged.plan.steps.merch.status).toBe("pending");
  });

  it("applyEcomIpWorkflowProjectSnapshot favors incoming when merge drops new urls", () => {
    const prev = {
      id: "p1",
      updatedAt: "2026-10-02T12:00:02.000Z",
      plan: {
        steps: {
          emoji: {
            status: "generating",
            slots: [
              { index: 5, title: "a" },
              { index: 6, title: "b", imageUrl: "https://oss/6.png" },
            ],
          },
        },
      },
    };
    const incoming = {
      id: "p1",
      updatedAt: "2026-10-02T12:00:01.000Z",
      plan: {
        steps: {
          emoji: {
            status: "generating",
            slots: [
              { index: 5, title: "a", imageUrl: "https://oss/5.png" },
              { index: 6, title: "b", imageUrl: "https://oss/6.png" },
            ],
          },
        },
      },
    };
    const applied = applyEcomIpWorkflowProjectSnapshot(prev, incoming);
    expect(applied.plan.steps.emoji.slots.find((s) => s.index === 5)?.imageUrl).toBe(
      "https://oss/5.png",
    );
  });
});
