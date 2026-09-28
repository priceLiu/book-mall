import { beforeEach, describe, expect, it } from "vitest";
import { __test__ } from "@/lib/canvas/pro2-wizard-canvas-live-sync";
import { wizardShotDraftKey } from "@/lib/canvas/pro2-production-wizard-shot-drafts";
import { wizardAssetDraftKey } from "@/lib/canvas/pro2-production-wizard-assets";
import { storyProSceneRowKey } from "@/lib/canvas/story-pro-scene-asset-catalog";
import { useCanvasStore } from "@/lib/canvas/store";
import { applyWizardVideoPromptsToCells } from "@/lib/canvas/pro2-video-cell-wizard-prompt";

const HUB = "hub-1";
const FRAME_COL = "frame-col";
const VIDEO_COL = "video-col";
const OSS_A = "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/canvas/node-video/p/a.mp4";
const OSS_B = "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/canvas/node-video/p/b.mp4";

type Nodes = ReturnType<typeof useCanvasStore.getState>["nodes"];

function seed(opts: {
  videoRuntime?: Record<string, unknown>;
  videoPrompt?: string;
  framePrompt?: string;
  shotDrafts?: Record<string, unknown>;
  withAssetNodes?: boolean;
}) {
  const assetNodes = opts.withAssetNodes
    ? [
        {
          id: "char-node",
          type: "story-pro2-three-view",
          position: { x: 0, y: 0 },
          data: { pro2HubNodeId: HUB, pro2RowKey: "c1" },
        },
        {
          id: "scene-node",
          type: "story-pro2-image",
          position: { x: 0, y: 0 },
          data: {
            pro2HubNodeId: HUB,
            pro2MediaRole: "scene",
            pro2RowKey: storyProSceneRowKey(HUB, "书房"),
          },
        },
        {
          id: "prop-node",
          type: "story-pro2-prop",
          position: { x: 0, y: 0 },
          data: { hubNodeId: HUB, scriptStudioSourceRowKey: "p1" },
        },
      ]
    : [];
  useCanvasStore.setState({
    edges: [],
    nodes: [
      ...assetNodes,
      {
        id: HUB,
        type: "story-pro2-script-hub",
        position: { x: 0, y: 0 },
        data: {
          productionScript: {
            characters: [{ id: "c1", name: "沈昭昭" }],
            scenes: opts.withAssetNodes
              ? [{ id: "s1", name: "书房", environmentTimeMood: "", imagePrompt: "" }]
              : [],
            props: opts.withAssetNodes ? [{ id: "p1", name: "现代电脑" }] : [],
            shots: [{ index: 1 }],
          },
          scriptStudioFrameRows: [{ key: "1", frameIndex: 1, prompt: "" }],
          scriptStudioVideoRows: [{ key: "1", frameIndex: 1, videoPrompt: "" }],
          productionWizardShotDrafts: opts.shotDrafts ?? {},
        },
      },
      {
        id: FRAME_COL,
        type: "story-pro2-frame-column",
        position: { x: 0, y: 0 },
        data: { hubNodeId: HUB, rows: [{ key: "1", frameIndex: 1, prompt: "" }] },
      },
      {
        id: VIDEO_COL,
        type: "story-pro2-video-column",
        position: { x: 0, y: 0 },
        data: {
          hubNodeId: HUB,
          rows: [{ key: "1", frameIndex: 1, videoPrompt: "" }],
        },
      },
      {
        id: "frame-cell",
        type: "story-pro2-image",
        position: { x: 0, y: 0 },
        data: {
          pro2MediaRole: "frame",
          pro2ControllerNodeId: FRAME_COL,
          pro2RowKey: "1",
          dockInput: opts.framePrompt ?? "",
        },
      },
      {
        id: "video-cell",
        type: "sbv1-video-engine",
        position: { x: 0, y: 0 },
        data: {
          pro2MediaRole: "video",
          pro2ControllerNodeId: VIDEO_COL,
          pro2RowKey: "1",
          prompt: opts.videoPrompt ?? "",
          dockInput: opts.videoPrompt ?? "",
          runtime: opts.videoRuntime,
        },
      },
    ] as unknown as Nodes,
  });
}

function patchNode(id: string, patch: Record<string, unknown>) {
  useCanvasStore.setState({
    nodes: useCanvasStore
      .getState()
      .nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
  });
}

function shotDraft(kind: "frame" | "video", index: number) {
  const hub = useCanvasStore.getState().nodes.find((n) => n.id === HUB);
  return (
    hub?.data as { productionWizardShotDrafts?: Record<string, Record<string, unknown>> }
  ).productionWizardShotDrafts?.[wizardShotDraftKey(kind, index)];
}

function pass(media: Map<string, string>, prompt: Map<string, { wiz: string; node: string }>) {
  __test__.runLiveSyncPass(media, prompt);
}

describe("pro2 wizard ⇄ canvas live sync", () => {
  let media: Map<string, string>;
  let prompt: Map<string, { wiz: string; node: string }>;

  beforeEach(() => {
    media = new Map();
    prompt = new Map();
  });

  it("pushes a new canvas video result into the wizard shot draft", () => {
    seed({ videoRuntime: { status: "done", ossUrl: OSS_A } });
    pass(media, prompt);
    expect(shotDraft("video", 1)?.previewUrl).toBe(OSS_A);

    patchNode("video-cell", { runtime: { status: "done", ossUrl: OSS_B, taskId: "t-b" } });
    pass(media, prompt);
    expect(shotDraft("video", 1)).toMatchObject({ previewUrl: OSS_B, taskId: "t-b" });
  });

  it("does not overwrite an existing wizard preview on first observation", () => {
    seed({
      videoRuntime: { status: "done", ossUrl: OSS_B },
      shotDrafts: {
        [wizardShotDraftKey("video", 1)]: {
          mediaKind: "video",
          shotIndex: 1,
          previewUrl: OSS_A,
        },
      },
    });
    pass(media, prompt);
    expect(shotDraft("video", 1)?.previewUrl).toBe(OSS_A);
  });

  it("ignores in-flight and vendor-temporary results", () => {
    seed({ videoRuntime: { status: "running" } });
    pass(media, prompt);
    patchNode("video-cell", {
      runtime: { status: "done", ossUrl: "https://tempfile.aiquickdraw.com/x.mp4" },
    });
    pass(media, prompt);
    expect(shotDraft("video", 1)?.previewUrl).toBeUndefined();
  });

  it("syncs a wizard video prompt edit to the cell and its column row", () => {
    seed({ videoPrompt: "旧提示词" });
    pass(media, prompt);
    const hub = useCanvasStore.getState().nodes.find((n) => n.id === HUB)!;
    patchNode(HUB, {
      productionWizardShotDrafts: {
        ...(hub.data as { productionWizardShotDrafts?: object }).productionWizardShotDrafts,
        [wizardShotDraftKey("video", 1)]: {
          mediaKind: "video",
          shotIndex: 1,
          prompt: "@<wiz-char-c1> 转身",
        },
      },
    });
    pass(media, prompt);
    const nodes = useCanvasStore.getState().nodes;
    const cell = nodes.find((n) => n.id === "video-cell")!.data as {
      prompt?: string;
      dockInput?: string;
    };
    // 画布无该角色节点 → 退化为纯文本名称
    expect(cell.prompt).toBe("@沈昭昭 转身");
    expect(cell.dockInput).toBe("@沈昭昭 转身");
    const col = nodes.find((n) => n.id === VIDEO_COL)!.data as {
      rows: { key: string; videoPrompt?: string }[];
    };
    expect(col.rows[0]?.videoPrompt).toBe("@沈昭昭 转身");
  });

  it("maps wizard video refs to upstream sbv1 refs and wires asset edges", () => {
    seed({ videoPrompt: "旧提示词", withAssetNodes: true });
    useCanvasStore.setState({
      edges: [
        {
          id: "e-frame-video",
          source: "frame-cell",
          target: "video-cell",
          sourceHandle: "image",
          targetHandle: "in_ref",
        },
        {
          id: "e-asset-video-stale",
          source: "prop-node",
          target: "video-cell",
          sourceHandle: "image",
          targetHandle: "in_ref",
        },
      ],
    });
    pass(media, prompt);
    const hub = useCanvasStore.getState().nodes.find((n) => n.id === HUB)!;
    patchNode(HUB, {
      productionWizardShotDrafts: {
        ...(hub.data as { productionWizardShotDrafts?: object }).productionWizardShotDrafts,
        [wizardShotDraftKey("video", 1)]: {
          mediaKind: "video",
          shotIndex: 1,
          prompt: "运镜：推近\n画面：@<wiz-char-c1> 走进 @<wiz-scene-s1>",
        },
      },
    });
    pass(media, prompt);
    const { nodes, edges } = useCanvasStore.getState();
    const cell = nodes.find((n) => n.id === "video-cell")!.data as { prompt?: string };
    expect(cell.prompt).toBe(
      "运镜：推近\n画面：@<sbv1-ref-char-node> 走进 @<sbv1-ref-scene-node>",
    );
    const into = edges.filter((e) => e.target === "video-cell").map((e) => e.source);
    expect(into[0]).toBe("frame-cell");
    expect(into).toContain("char-node");
    expect(into).toContain("scene-node");
    expect(into).not.toContain("prop-node");
  });

  it("maps canvas video Dock refs back to wizard tokens", () => {
    seed({ videoPrompt: "旧提示词", withAssetNodes: true });
    pass(media, prompt);
    patchNode("video-cell", {
      prompt: "@<sbv1-ref-prop-node> 放在桌上",
      dockInput: "@<sbv1-ref-prop-node> 放在桌上",
    });
    pass(media, prompt);
    expect(shotDraft("video", 1)?.prompt).toBe("@<wiz-prop-p1> 放在桌上");
  });

  it("mount hydrates plain-text names like the wizard studio does", () => {
    seed({ videoPrompt: "分镜图提示词", withAssetNodes: true });
    const hub = useCanvasStore.getState().nodes.find((n) => n.id === HUB)!;
    const script = (hub.data as { productionScript: Record<string, unknown> })
      .productionScript;
    patchNode(HUB, {
      productionScript: {
        ...script,
        shots: [{ index: 1, characterIds: ["c1"], propIds: ["p1"] }],
      },
      productionWizardShotDrafts: {
        [wizardShotDraftKey("video", 1)]: {
          mediaKind: "video",
          shotIndex: 1,
          prompt: "画面：沈昭昭抬头，看向现代电脑",
        },
      },
    });
    useCanvasStore.setState({ edges: [] });
    applyWizardVideoPromptsToCells(HUB);
    const { nodes, edges } = useCanvasStore.getState();
    const dock = (nodes.find((n) => n.id === "video-cell")!.data as {
      dockInput?: string;
    }).dockInput!;
    expect(dock).toContain("@<sbv1-ref-char-node>抬头");
    expect(dock).toContain("@<sbv1-ref-prop-node>");
    expect(dock).not.toContain("沈昭昭");
    const into = edges.filter((e) => e.target === "video-cell").map((e) => e.source);
    expect(into.sort()).toEqual(["char-node", "prop-node"]);
  });

  it("mount applies wizard video prompts including props", () => {
    seed({ videoPrompt: "分镜图提示词", withAssetNodes: true });
    patchNode(HUB, {
      productionWizardShotDrafts: {
        [wizardShotDraftKey("video", 1)]: {
          mediaKind: "video",
          shotIndex: 1,
          prompt: "@<wiz-char-c1> 打开 @<wiz-prop-p1>",
        },
      },
    });
    useCanvasStore.setState({ edges: [] });
    applyWizardVideoPromptsToCells(HUB);
    const { nodes, edges } = useCanvasStore.getState();
    const cell = nodes.find((n) => n.id === "video-cell")!.data as {
      prompt?: string;
      dockInput?: string;
    };
    expect(cell.dockInput).toBe("@<sbv1-ref-char-node> 打开 @<sbv1-ref-prop-node>");
    const hubRows = (nodes.find((n) => n.id === HUB)!.data as {
      scriptStudioVideoRows: { videoPrompt?: string }[];
    }).scriptStudioVideoRows;
    expect(hubRows[0]?.videoPrompt).toBe(cell.dockInput);
    const into = edges.filter((e) => e.target === "video-cell").map((e) => e.source);
    expect(into.sort()).toEqual(["char-node", "prop-node"]);
  });

  it("pushes a canvas scene image into the wizard asset draft and hub sceneRows", () => {
    const sceneKey = storyProSceneRowKey(HUB, "皇宫大殿");
    const IMG = "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/canvas/node-image/p/s.png";
    useCanvasStore.setState({
      nodes: [
        {
          id: HUB,
          type: "story-pro2-script-hub",
          position: { x: 0, y: 0 },
          data: {
            productionScript: {
              characters: [],
              scenes: [
                {
                  id: "s1",
                  name: "皇宫大殿",
                  environmentTimeMood: "室内 · 白天 · 庄严",
                  imagePrompt: "金色大殿",
                },
              ],
              shots: [],
            },
            sceneRows: [{ key: sceneKey, name: "皇宫大殿" }],
          },
        },
        {
          id: "scene-cell",
          type: "story-pro2-image",
          position: { x: 0, y: 0 },
          data: {
            pro2MediaRole: "scene",
            pro2HubNodeId: HUB,
            pro2RowKey: sceneKey,
            dockInput: "大殿",
          },
        },
      ] as unknown as Nodes,
    });
    pass(media, prompt);
    patchNode("scene-cell", { ossUrl: IMG, runtime: { status: "done", ossUrl: IMG } });
    pass(media, prompt);

    const hub = useCanvasStore.getState().nodes.find((n) => n.id === HUB)!.data as {
      productionWizardAssetDrafts?: Record<string, { previewUrl?: string }>;
      sceneRows: { key: string; runtime?: { ossUrl?: string } }[];
    };
    expect(hub.productionWizardAssetDrafts?.[wizardAssetDraftKey("scene", "s1")]?.previewUrl).toBe(IMG);
    expect(hub.sceneRows.find((r) => r.key === sceneKey)?.runtime?.ossUrl).toBe(IMG);
  });

  it("syncs a canvas frame prompt edit back to the wizard draft", () => {
    seed({ framePrompt: "" });
    pass(media, prompt);
    patchNode("frame-cell", { dockInput: "@<ref-char-c1> 在电脑前" });
    pass(media, prompt);
    expect(shotDraft("frame", 1)?.prompt).toBe("@<wiz-char-c1> 在电脑前");
    const hub = useCanvasStore.getState().nodes.find((n) => n.id === HUB)!.data as {
      scriptStudioFrameRows: { key: string; prompt?: string }[];
    };
    expect(hub.scriptStudioFrameRows[0]?.prompt).toBe("@<ref-char-c1> 在电脑前");
  });
});
