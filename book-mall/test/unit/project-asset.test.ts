import { describe, expect, it } from "vitest";
import {
  defaultKindForNodeType,
  mapProjectAssetToCanvasInsert,
} from "@/lib/project-asset/project-asset-insert-map";
import { resolveAssetMediaUrl } from "@/lib/project-asset/project-asset-media-resolve";
import type { ProjectAssetRecord } from "@/lib/project-asset/project-asset-types";

describe("project-asset-media-resolve", () => {
  it("reads media from nodeSnapshot when thumbnail and refs are empty", () => {
    expect(
      resolveAssetMediaUrl({
        thumbnailUrl: "",
        refs: [],
        payload: {
          nodeSnapshot: { ossUrl: "https://cdn.example.com/tv.png" },
        },
        kind: "CHARACTER",
      }),
    ).toBe("https://cdn.example.com/tv.png");
  });
});

describe("project-asset-insert-map", () => {
  it("maps sbv1 image to sbv1-image node", () => {
    const asset: ProjectAssetRecord = {
      id: "a1",
      tenantId: null,
      ownerUserId: "u1",
      visibility: "PRIVATE",
      kind: "STORYBOARD_IMAGE",
      displayName: "镜1",
      description: "",
      thumbnailUrl: "https://example.com/a.png",
      sourceProjectId: null,
      sourceNodeId: null,
      sourceEdition: null,
      locked: false,
      editLockUserId: null,
      editLockExpiresAt: null,
      version: 1,
      payload: { prompt: "test" },
      refs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const insert = mapProjectAssetToCanvasInsert(asset, { edition: "sbv1" });
    expect(insert).toMatchObject({ nodeType: "sbv1-image" });
  });

  it("defaultKindForNodeType maps pro2 starter", () => {
    expect(defaultKindForNodeType("story-pro2-starter")).toBe("OUTLINE");
  });

  it("maps tts voice preset to story-pro2-audio with engine", () => {
    const asset: ProjectAssetRecord = {
      id: "a3",
      tenantId: null,
      ownerUserId: "u1",
      visibility: "PRIVATE",
      kind: "AUDIO",
      displayName: "女声 · 1.1x",
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
        assetSubtype: "tts_voice_preset",
        sampleText: "你好，这是试听。",
        engine: {
          providerId: "gw",
          modelKey: "speech-2.6-hd",
          params: { voice_id: "abc", speed: 1.1 },
        },
      },
      refs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const insert = mapProjectAssetToCanvasInsert(asset, { edition: "pro2" });
    expect(insert).toMatchObject({
      nodeType: "story-pro2-audio",
      data: {
        label: "女声 · 1.1x",
        dockInput: "你好，这是试听。",
        engine: {
          providerId: "gw",
          modelKey: "speech-2.6-hd",
          params: { voice_id: "abc", speed: 1.1 },
        },
      },
    });
  });

  it("merges nodeSnapshot ossUrl and dockInput for pro2 three-view", () => {
    const asset: ProjectAssetRecord = {
      id: "a2",
      tenantId: null,
      ownerUserId: "u1",
      visibility: "PRIVATE",
      kind: "CHARACTER",
      displayName: "李诚",
      description: "",
      thumbnailUrl: "https://example.com/three.png",
      sourceProjectId: null,
      sourceNodeId: null,
      sourceEdition: "pro2",
      locked: false,
      editLockUserId: null,
      editLockExpiresAt: null,
      version: 1,
      payload: {
        characterKey: "李诚",
        prompt: "少年剑客，黑发",
        nodeType: "story-pro2-three-view",
        nodeSnapshot: {
          label: "李诚",
          dockInput: "少年剑客，黑发",
        },
      },
      refs: [
        {
          id: "r1",
          slotKey: "three_view",
          label: "三视图",
          mediaUrl: "https://example.com/three.png",
          mimeType: "image/png",
          sortOrder: 0,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const insert = mapProjectAssetToCanvasInsert(asset, { edition: "pro2" });
    expect(insert).toMatchObject({
      nodeType: "story-pro2-three-view",
      data: {
        label: "李诚",
        ossUrl: "https://example.com/three.png",
        dockInput: "少年剑客，黑发",
        characterKey: "李诚",
      },
    });
  });
});
