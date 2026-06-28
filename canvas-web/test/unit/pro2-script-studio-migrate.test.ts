import { describe, expect, it } from "vitest";
import { applyScriptPackageToNewPro2Graph } from "@/lib/canvas/pro2-new-project-script-package";
import { migrateLegacyPro2ScriptStudioGraph } from "@/lib/canvas/pro2-script-studio-migrate";
import { findScriptStudioHub } from "@/lib/canvas/script-studio-run-apply";
import { pro2CreateNeedsScriptPackageStep } from "@/lib/canvas/pro2-create-script-package-step";
import {
  STORY_PRO2_PRODUCTION_BUILTIN_TEMPLATE_ID,
  STORY_PRO2_SCRIPT_BUILTIN_TEMPLATE_ID,
} from "@/lib/canvas/project-edition";

describe("migrateLegacyPro2ScriptStudioGraph", () => {
  it("promotes script studio data from starter to new hub", () => {
    const { nodes } = migrateLegacyPro2ScriptStudioGraph(
      [
        {
          id: "starter-1",
          type: "story-pro2-starter",
          position: { x: 100, y: 100 },
          data: {
            scriptStudioMode: true,
            scriptStudioThemeInput: "测试主题",
            scriptStudioBatchIndex: 2,
            scriptStudioCompletedBatchesMd: "# 批次1",
            providerId: "p1",
            modelKey: "m1",
          },
        },
      ],
      [],
    );

    const hub = findScriptStudioHub(nodes);
    expect(hub).toBeDefined();
    expect((hub?.data as { scriptStudioThemeInput?: string }).scriptStudioThemeInput).toBe(
      "测试主题",
    );
    expect(
      (nodes.find((n) => n.id === "starter-1")?.data as { scriptStudioMode?: boolean })
        .scriptStudioMode,
    ).toBeUndefined();
  });

  it("skips when script studio hub already exists", () => {
    const input = [
      {
        id: "hub-1",
        type: "story-pro2-script-hub",
        position: { x: 0, y: 0 },
        data: { scriptStudioMode: true, outlineMd: "ok" },
      },
    ];
    const { nodes } = migrateLegacyPro2ScriptStudioGraph(input, []);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.id).toBe("hub-1");
  });

  it("does not spawn hub for linked script package on starter", () => {
    const { nodes } = migrateLegacyPro2ScriptStudioGraph(
      [
        {
          id: "starter-collab",
          type: "story-pro2-starter",
          position: { x: 0, y: 0 },
          data: {
            workspaceIds: { linkedScriptPackageAssetId: "pkg-1" },
            linkedScriptPackageMarkdown: "# 剧本",
            scriptStudioFrameRows: [
              { key: "f1", episodeNo: 1, shotNo: 1, description: "镜1" },
            ],
            crewBulletin: {
              scriptTitle: "协作",
              totalEpisodes: 1,
              publishedAt: "2026-01-01T00:00:00.000Z",
              tasks: [
                {
                  id: "f1",
                  kind: "frame",
                  label: "镜1",
                  rowKey: "f1",
                  status: "unclaimed",
                },
              ],
            },
          },
        },
      ],
      [],
    );
    expect(findScriptStudioHub(nodes)).toBeUndefined();
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.type).toBe("story-pro2-starter");
  });
});

describe("applyScriptPackageToNewPro2Graph", () => {
  it("creates empty canvas with graph.meta bulletin anchor", () => {
    const graph = applyScriptPackageToNewPro2Graph(
      {
        schemaVersion: 3,
        nodes: [{ id: "s", type: "story-pro2-starter", position: { x: 0, y: 0 }, data: {} }],
        edges: [],
        meta: { edition: "pro2" },
      },
      {
        id: "pkg-new",
        displayName: "剧本包 · 新",
        payload: {
          markdown: "# 剧本",
          totalEpisodes: 2,
          scriptStudioFrameRows: [
            { key: "f1", episodeNo: 1, shotNo: 1, description: "镜1" },
          ],
        },
      },
    );
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
    expect(graph.meta?.crewBulletinAnchor?.linkedScriptPackageAssetId).toBe(
      "pkg-new",
    );
    expect(
      graph.meta?.crewBulletinAnchor?.crewBulletin.tasks.length,
    ).toBeGreaterThan(0);
  });
});

describe("pro2CreateNeedsScriptPackageStep", () => {
  it("requires step for production template but not script studio", () => {
    expect(
      pro2CreateNeedsScriptPackageStep(
        { kind: "builtin", id: STORY_PRO2_PRODUCTION_BUILTIN_TEMPLATE_ID },
        [],
      ),
    ).toBe(true);
    expect(
      pro2CreateNeedsScriptPackageStep(
        { kind: "builtin", id: STORY_PRO2_SCRIPT_BUILTIN_TEMPLATE_ID },
        [],
      ),
    ).toBe(false);
  });
});
