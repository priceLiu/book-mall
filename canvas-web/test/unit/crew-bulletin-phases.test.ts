import { describe, expect, it } from "vitest";
import { computeCrewProductionPhases } from "@/lib/canvas/crew-bulletin-phases";
import type { CrewBulletinState } from "@/lib/canvas/crew-bulletin-types";

describe("computeCrewProductionPhases", () => {
  it("marks asset phase in_progress when tasks are unclaimed", () => {
    const bulletin: CrewBulletinState = {
      publishedAt: new Date().toISOString(),
      hubNodeId: "hub-1",
      scriptTitle: "测试剧",
      totalEpisodes: 5,
      tasks: [
        {
          id: "script:hub-1",
          kind: "script",
          rowKey: "hub-1",
          label: "测试剧",
          status: "done",
        },
        {
          id: "character:a",
          kind: "character",
          rowKey: "a",
          label: "张三",
          status: "unclaimed",
        },
      ],
    };

    const phases = computeCrewProductionPhases(bulletin);
    expect(phases.find((p) => p.id === "character")?.status).toBe(
      "in_progress",
    );
  });

  it("aggregates phase status from bulletin tasks", () => {
    const bulletin: CrewBulletinState = {
      publishedAt: new Date().toISOString(),
      hubNodeId: "hub-1",
      scriptTitle: "测试剧",
      totalEpisodes: 5,
      tasks: [
        {
          id: "script:hub-1",
          kind: "script",
          rowKey: "hub-1",
          label: "测试剧",
          status: "done",
        },
        {
          id: "character:a",
          kind: "character",
          rowKey: "a",
          label: "张三",
          status: "done",
        },
        {
          id: "character:b",
          kind: "character",
          rowKey: "b",
          label: "李四",
          status: "generating",
        },
        {
          id: "frame:1",
          kind: "frame",
          rowKey: "f1",
          label: "镜1",
          status: "unclaimed",
        },
      ],
    };

    const phases = computeCrewProductionPhases(bulletin);
    const script = phases.find((p) => p.id === "script");
    const character = phases.find((p) => p.id === "character");
    const frame = phases.find((p) => p.id === "frame");

    expect(script?.status).toBe("done");
    expect(character?.status).toBe("in_progress");
    expect(character?.doneCount).toBe(1);
    expect(character?.totalCount).toBe(2);
    expect(frame?.status).toBe("not_started");
  });

  it("adds script package as last phase tab", () => {
    const bulletin: CrewBulletinState = {
      publishedAt: new Date().toISOString(),
      hubNodeId: "hub-1",
      scriptTitle: "测试剧",
      totalEpisodes: 5,
      tasks: [
        {
          id: "script:hub-1",
          kind: "script",
          rowKey: "hub-1",
          label: "测试剧",
          status: "done",
        },
      ],
    };

    const phases = computeCrewProductionPhases(bulletin, {
      frame: [
        {
          id: "snap-1",
          taskId: "frame:1",
          kind: "frame",
          label: "镜1",
          completedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(phases.at(-1)?.id).toBe("scriptPackage");
    expect(phases.at(-1)?.doneCount).toBe(1);
  });
});
