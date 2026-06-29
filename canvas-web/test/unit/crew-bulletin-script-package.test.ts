import { describe, expect, it } from "vitest";
import {
  crewBulletinFromScriptPackagePayload,
  freshLocalCrewBulletin,
  patchStarterFromScriptPackage,
} from "@/lib/canvas/crew-bulletin-script-package";
import type { CrewBulletinState } from "@/lib/canvas/crew-bulletin-types";
import { parseScriptPackageSnapshotsFromPayload } from "@/lib/canvas/script-package-snapshots";

describe("freshLocalCrewBulletin", () => {
  it("resets claim state but keeps script task done", () => {
    const bulletin: CrewBulletinState = {
      hubNodeId: "__crew_bulletin_meta__",
      scriptTitle: "测试",
      totalEpisodes: 10,
      publishedAt: "2026-01-01T00:00:00.000Z",
      tasks: [
        { id: "s1", kind: "script", label: "剧本", rowKey: "script", status: "done" },
        {
          id: "c1",
          kind: "character",
          label: "角色A",
          rowKey: "char-a",
          status: "done",
          assigneeDisplayName: "Alice",
        },
      ],
    };
    const next = freshLocalCrewBulletin(bulletin);
    expect(next.tasks[0]?.status).toBe("done");
    expect(next.tasks[1]?.status).toBe("unclaimed");
    expect(next.tasks[1]?.assigneeDisplayName).toBeUndefined();
  });
});

describe("crewBulletinFromScriptPackagePayload", () => {
  it("builds bulletin from row payload when crewBulletin missing", () => {
    const { bulletin } = crewBulletinFromScriptPackagePayload(
      "asset-1",
      "剧本包 · 5 集",
      {
        markdown: "# 大纲",
        totalEpisodes: 5,
        scriptStudioFrameRows: [
          {
            key: "f1",
            episodeNo: 1,
            shotNo: 1,
            description: "镜头1",
          },
        ],
      },
    );
    expect(bulletin.totalEpisodes).toBe(5);
    const frames = bulletin.tasks.filter((t) => t.kind === "frame");
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((t) => t.status === "unclaimed")).toBe(true);
  });

  it("resets stored crewBulletin for local canvas", () => {
    const stored: CrewBulletinState = {
      hubNodeId: "__crew_bulletin_meta__",
      scriptTitle: "已发布",
      totalEpisodes: 3,
      publishedAt: "2026-01-01T00:00:00.000Z",
      tasks: [
        { id: "s1", kind: "script", label: "剧本", rowKey: "script", status: "done" },
        {
          id: "f1",
          kind: "frame",
          label: "第1集 · 镜1",
          rowKey: "f1",
          episodeNo: 1,
          status: "claimed",
          assigneeDisplayName: "Bob",
        },
      ],
    };
    const { bulletin } = crewBulletinFromScriptPackagePayload(
      "asset-2",
      "剧本包",
      { crewBulletin: stored, markdown: "# x" },
    );
    expect(bulletin.tasks.find((t) => t.id === "f1")?.status).toBe("unclaimed");
  });
});

describe("patchStarterFromScriptPackage", () => {
  it("links bulletin without filling starter outline card", () => {
    const patch = patchStarterFromScriptPackage({
      id: "asset-3",
      displayName: "剧本包 · 测试",
      payload: {
        markdown: "# 完整剧本正文",
        totalEpisodes: 8,
        scriptStudioFrameRows: [
          { key: "f1", episodeNo: 1, shotNo: 1, description: "镜1" },
        ],
      },
    });
    expect(patch.linkedScriptPackageMarkdown).toContain("完整剧本");
    expect(patch.generatedOutlineMd).toBeUndefined();
    expect(patch.scriptStudioCompletedBatchesMd).toBeUndefined();
    expect(
      (patch.workspaceIds as { linkedScriptPackageAssetId?: string })
        ?.linkedScriptPackageAssetId,
    ).toBe("asset-3");
    expect(
      (patch.crewBulletin as CrewBulletinState | undefined)?.tasks.length,
    ).toBeGreaterThan(0);
  });
});

describe("crewBulletinFromScriptPackagePayload rebuild", () => {
  it("rebuilds character tasks from rows when stored bulletin only has frames", () => {
    const stored: CrewBulletinState = {
      hubNodeId: "__crew_bulletin_meta__",
      scriptTitle: "请帮我编写关于小胖子在校外吃西瓜的故事",
      totalEpisodes: 5,
      publishedAt: "2026-01-01T00:00:00.000Z",
      tasks: [
        { id: "s1", kind: "script", label: "剧本", rowKey: "script", status: "done" },
        {
          id: "f1",
          kind: "frame",
          label: "镜1",
          rowKey: "f1",
          episodeNo: 1,
          status: "unclaimed",
        },
      ],
    };
    const { bulletin } = crewBulletinFromScriptPackagePayload(
      "asset-x",
      "剧本包 · 小胖子吃西瓜",
      {
        crewBulletin: stored,
        markdown: "# 大纲",
        totalEpisodes: 5,
        scriptStudioCharacterRows: [
          { key: "c1", name: "小明", role: "学生", appearance: "圆脸" },
        ],
        sceneRows: [{ key: "s1", name: "校门外西瓜摊", description: "夏日" }],
      },
    );
    expect(bulletin.scriptTitle).toBe("小胖子吃西瓜");
    expect(bulletin.tasks.some((t) => t.kind === "character")).toBe(true);
    expect(bulletin.tasks.some((t) => t.kind === "scene")).toBe(true);
  });

  it("loads script package snapshots from payload", () => {
    const snapshots = parseScriptPackageSnapshotsFromPayload({
      scriptPackageSnapshots: {
        character: [
          {
            id: "snap-1",
            taskId: "character:a",
            kind: "character",
            label: "小明",
            completedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    });
    expect(snapshots.character?.length).toBe(1);
  });
});
