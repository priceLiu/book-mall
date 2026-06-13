import { describe, expect, it } from "vitest";
import { exportNodeToProjectAssetDraft } from "@/lib/canvas/project-asset-export";
import {
  collectProjectAssetMediaItems,
  mediaUrlFromNodeData,
} from "@/lib/canvas/project-asset-media-url";
import { projectAssetHeroUrl } from "@/lib/canvas/project-asset-preview";
import type { ProjectAssetRecord } from "@/lib/canvas/project-asset-types";

describe("project-asset-media-url", () => {
  it("reads ossUrl from pro2 three-view node data", () => {
    expect(
      mediaUrlFromNodeData({
        label: "李诚",
        ossUrl: "https://cdn.example.com/tv.png",
        dockInput: "少年剑客",
      }),
    ).toBe("https://cdn.example.com/tv.png");
  });

  it("falls back to nodeSnapshot in payload for hero preview", () => {
    const asset: ProjectAssetRecord = {
      id: "a1",
      tenantId: null,
      ownerUserId: "u1",
      visibility: "PRIVATE",
      kind: "CHARACTER",
      displayName: "李诚",
      description: "",
      thumbnailUrl: "",
      sourceProjectId: null,
      sourceNodeId: null,
      sourceEdition: "pro2",
      locked: false,
      editLockUserId: null,
      editLockExpiresAt: null,
      version: 1,
      payload: {
        nodeSnapshot: {
          label: "李诚",
          ossUrl: "https://cdn.example.com/tv.png",
        },
      },
      refs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(projectAssetHeroUrl(asset)).toBe("https://cdn.example.com/tv.png");
  });

  it("collects all layout child images for group bundle", () => {
    const asset: ProjectAssetRecord = {
      id: "g1",
      tenantId: null,
      ownerUserId: "u1",
      visibility: "PRIVATE",
      kind: "GROUP_BUNDLE",
      displayName: "三视图 · 脚本 1",
      description: "",
      thumbnailUrl: "https://cdn.example.com/a.png",
      sourceProjectId: null,
      sourceNodeId: null,
      sourceEdition: "pro2",
      locked: false,
      editLockUserId: null,
      editLockExpiresAt: null,
      version: 1,
      payload: {
        layout: {
          nodes: [
            {
              id: "n1",
              type: "story-pro2-three-view",
              data: { label: "李城", ossUrl: "https://cdn.example.com/a.png" },
            },
            {
              id: "n2",
              type: "story-pro2-three-view",
              data: { label: "王敏", ossUrl: "https://cdn.example.com/b.png" },
            },
          ],
          edges: [],
        },
      },
      refs: [
        {
          id: "r1",
          slotKey: "n1",
          label: "李城",
          mediaUrl: "https://cdn.example.com/a.png",
          mimeType: null,
          meta: null,
          sortOrder: 0,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const items = collectProjectAssetMediaItems(asset);
    expect(items.map((i) => i.url)).toEqual([
      "https://cdn.example.com/a.png",
      "https://cdn.example.com/b.png",
    ]);
  });
});

describe("project-asset-export", () => {
  it("exports CHARACTER with thumbnail and refs for three-view", () => {
    const draft = exportNodeToProjectAssetDraft(
      {
        projectId: "p1",
        edition: "pro2",
        nodeId: "n1",
        nodeType: "story-pro2-three-view",
        data: {
          label: "李诚",
          characterKey: "李诚",
          ossUrl: "https://cdn.example.com/tv.png",
          dockInput: "少年剑客，黑发",
        },
      },
      "CHARACTER",
    );
    expect(draft.thumbnailUrl).toBe("https://cdn.example.com/tv.png");
    expect(draft.refs).toEqual([
      {
        slotKey: "three_view",
        mediaUrl: "https://cdn.example.com/tv.png",
      },
    ]);
    expect(draft.payload.nodeSnapshot).toMatchObject({
      label: "李诚",
      ossUrl: "https://cdn.example.com/tv.png",
      dockInput: "少年剑客，黑发",
    });
  });
});
