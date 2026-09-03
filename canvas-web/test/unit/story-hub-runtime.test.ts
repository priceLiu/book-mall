import { describe, expect, it, vi } from "vitest";

import { pickPreferredCanvasTaskForScope } from "@/lib/canvas/task-pick";
import type { CanvasTaskRecord } from "@/lib/canvas-api";
import {
  clearCanvasNodeRunSession,
  markCanvasNodeRunSession,
} from "@/lib/canvas/canvas-run-session";
import { storyApplyTaskResult } from "@/lib/canvas/story-run-apply";
import {
  hubAggregateStatus,
  hubSectionCountsAsInflight,
  hubSectionHasTerminalError,
  hubSectionIsReady,
  hubSectionIsRunning,
  clearHubSectionMdForForceFresh,
  clearHubSectionRuntimesForForceFresh,
  hubShowsGeneratingUi,
  shouldSkipHubSectionInflightTaskApply,
  stripStaleHubGenerateIntent,
  outlineTextHasEmbeddedProductionPack,
  hubEmbeddedPackSectionsStale,
  buildHubEmbeddedPackRepairPatch,
  buildHubStoryboardBackfillPatch,
  promoteEmbeddedPackFromOutline,
  resolveHubStoryboardMd,
  resolvePro2StoryboardMdFromPackSource,
  hubNodeRepairPatchIfChanged,
} from "@/lib/canvas/story-hub-runtime";
import type { CanvasFlowNode } from "@/lib/canvas/types";
import { parseStoryboardRows } from "@/lib/canvas/parse-md-tables";
import { PRO2_FIXTURE_FULL_PACK } from "../fixtures/pro2-production-script-fixture";

function hubNode(
  data: Record<string, unknown>,
  id = "hub-1",
): CanvasFlowNode {
  return {
    id,
    type: "story-pro2-script-hub",
    position: { x: 0, y: 0 },
    data,
  };
}

describe("hubSectionIsRunning", () => {
  it("pending without taskId counts as running (optimistic enqueue)", () => {
    const node = hubNode({
      storyboardRuntime: { status: "pending" },
      storyboardMd: "",
    });
    expect(hubSectionIsRunning(node, "storyboard")).toBe(true);
    expect(hubAggregateStatus(node)).toBe("running");
  });

  it("pending with taskId counts as running", () => {
    const node = hubNode({
      storyboardRuntime: { status: "pending", taskId: "t-1" },
    });
    expect(hubSectionIsRunning(node, "storyboard")).toBe(true);
  });

  it("queued counts as running", () => {
    const node = hubNode({
      outlineRuntime: { status: "queued", taskId: "t-q" },
    });
    expect(hubSectionIsRunning(node, "outline")).toBe(true);
  });

  it("aggregate running when sequential chain has pending sections", () => {
    const node = hubNode({
      outlineRuntime: { status: "done", taskId: "t-outline" },
      outlineMd: "# 大纲",
      characterRuntime: { status: "pending" },
      sceneRuntime: { status: "pending" },
      storyboardRuntime: { status: "pending" },
      storyboardMd: "| 镜号 | 场景 |\n| --- | --- |",
    });
    expect(hubAggregateStatus(node)).toBe("running");
  });
});

describe("hubSectionHasTerminalError", () => {
  it("detects section error runtime", () => {
    const node = hubNode({ characterRuntime: { status: "error" } });
    expect(hubSectionHasTerminalError(node, "character")).toBe(true);
    expect(hubSectionHasTerminalError(node, "scene")).toBe(false);
  });
});

describe("hubSectionCountsAsInflight", () => {
  it("counts pending without taskId for poll targeting (sequential chain / optimistic)", () => {
    expect(hubSectionCountsAsInflight({ status: "pending" })).toBe(true);
    expect(
      hubSectionCountsAsInflight({ status: "pending", taskId: "t1" }),
    ).toBe(true);
  });
});

describe("clearHubSectionRuntimesForForceFresh", () => {
  it("clears only requested sections", () => {
    expect(
      clearHubSectionRuntimesForForceFresh(["character", "storyboard"]),
    ).toEqual({
      characterRuntime: undefined,
      storyboardRuntime: undefined,
    });
  });
});

describe("clearHubSectionMdForForceFresh", () => {
  it("clears only requested section markdown fields", () => {
    expect(
      clearHubSectionMdForForceFresh(["character", "storyboard"]),
    ).toEqual({
      characterMd: "",
      storyboardMd: "",
    });
  });
});

describe("hubSectionIsReady", () => {
  it("does not treat outline-embedded pack as complete when dedicated fields are empty", () => {
    const node = hubNode({
      outlineMd: [
        "# 故事大纲",
        "",
        "## 角色设定",
        "| 角色 | 描述 |",
        "| --- | --- |",
        "| 女主 | 测试 |",
      ].join("\n"),
      characterMd: "",
      sceneMd: "",
      storyboardMd: "",
    });
    expect(hubSectionIsReady(node, "character")).toBe(false);
    expect(hubSectionIsReady(node, "scene")).toBe(false);
    expect(hubSectionIsReady(node, "storyboard")).toBe(false);
    expect(hubAggregateStatus(node)).toBe("idle");
  });

  it("returns true when dedicated markdown exists and runtime is idle", () => {
    const header = `| 镜号 | 景别 | 运镜 | 画面描述（含起始→终止站位） | 对白 | 时长(秒) | AI生图提示词(英文) | AI视频提示词(英文) | 口型/配音备注 |
|------|------|------|---------------------------|------|----------|---------------------|---------------------|---------------|`;
    const rows = Array.from({ length: 12 }, (_, i) => {
      const n = i + 1;
      return `| ${n} | 中景 | 固定 | 【起始】镜${n}起始。【结束】镜${n}终止。 | — | 10 | img ${n} | vid ${n} | 备注 ${n} |`;
    });
    const node = hubNode({
      outlineMd: "预计时长 | 3分钟",
      characterMd: "| 角色 | 描述 |\n| --- | --- |\n| 女主 | 测试 |",
      sceneMd: "| 场景 | 描述 |\n| --- | --- |\n| 堂屋 | 测试 |",
      storyboardMd: `${header}\n${rows.join("\n")}`,
    });
    expect(hubSectionIsReady(node, "character")).toBe(true);
    expect(hubSectionIsReady(node, "scene")).toBe(true);
    expect(hubSectionIsReady(node, "storyboard")).toBe(true);
  });

  it("rejects 2-shot storyboard for 3-minute outline", () => {
    const header = `| 镜号 | 景别 | 运镜 | 画面描述（含起始→终止站位） | 对白 | 时长(秒) | AI生图提示词(英文) | AI视频提示词(英文) | 口型/配音备注 |
|------|------|------|---------------------------|------|----------|---------------------|---------------------|---------------|`;
    const node = hubNode({
      outlineMd: "预计时长 | 3分钟",
      storyboardMd: `${header}
| 1 | 中景 | 固定 | 【起始】…【结束】… | — | 10 | img | vid | — |
| 2 | 近景 | 固定 | 【起始】…【结束】… | — | 8 | img | vid | — |`,
      storyboardRuntime: { status: "done", taskId: "t-1" },
    });
    expect(hubSectionIsReady(node, "storyboard")).toBe(false);
  });
});

describe("outlineTextHasEmbeddedProductionPack", () => {
  it("detects full production pack LLM output", () => {
    expect(
      outlineTextHasEmbeddedProductionPack(
        "## 视觉风格总纲\n\n## 角色视觉辞典\n\n| 姓名 |",
      ),
    ).toBe(true);
    expect(outlineTextHasEmbeddedProductionPack("## 仅大纲\n\n无角色表")).toBe(
      false,
    );
  });

  it("promote replaces old character when full-pack sections are stale", () => {
    const oldChar =
      "| 姓名 | 身份 | 外貌/服装/标志性动作 | 性格 | AI生图提示词(英文) |\n| 旧 | 旧 | 旧 | 旧 | A stunning 20-year-old |";
    const fullPack = `## 视觉风格总纲\n\n## 角色视觉辞典\n\n| 姓名 | 身份 | 外貌/服装/标志性动作 | 性格 | AI生图提示词(英文) |\n| --- | --- | --- | --- | --- |\n| 沈知意 | 女主 | 鹅蛋脸 | 嘴硬 | 20岁中国女子，电影级写实人像，暖金侧光，2K |`;
    const hubData = {
      outlineMd: "## 故事大纲\n\n已剥离",
      outlineRuntime: {
        status: "done" as const,
        taskId: "new-outline",
        textOutput: fullPack,
      },
      characterMd: oldChar,
      characterRuntime: { status: "done" as const, taskId: "old-char" },
    };
    expect(hubEmbeddedPackSectionsStale(hubData)).toBe(true);
    const patch = buildHubEmbeddedPackRepairPatch(hubData);
    expect(patch.characterMd).toContain("沈知意");
    expect(patch.characterMd).not.toContain("A stunning");
    expect(patch.characterRuntime?.taskId).toBe("new-outline");
  });

  it("resolveHubStoryboardMd falls back to outline textOutput when storyboard stale", () => {
    const oldSb = `| 镜号 | 景别 | 运镜 | 画面描述（含起始→终止站位） | 对白 | 时长(秒) | AI生图提示词(英文) | AI视频提示词(英文) | 口型/配音备注 |
|------|------|------|---------------------------|------|----------|---------------------|---------------------|---------------|
| 1 | 全景 | 固定 | 旧 | — | 10 | Cinematic extreme wide shot ancient street | Old english video | — |`;
    const fullPack = `## 分镜脚本\n\n| 镜号 | 景别 | 运镜 | 画面描述（含起始→终止站位） | 对白 | 时长(秒) | AI生图提示词(英文) | AI视频提示词(英文) | 口型/配音备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 全景 | 缓推 | 新画面 | — | 12 | 电影级全景建立镜头，古代长安鸟瞰 | 镜头缓慢右摇，展现繁华古代长安 | BGM |`;
    const hubData = {
      storyboardMd: oldSb,
      storyboardRuntime: { status: "done" as const, taskId: "old-sb" },
      outlineRuntime: {
        status: "done" as const,
        taskId: "new-outline",
        textOutput: fullPack,
      },
    };
    const md = resolveHubStoryboardMd(hubData);
    expect(md).toContain("电影级全景建立镜头");
    expect(md).not.toContain("Cinematic extreme wide");
  });
});

describe("pickPreferredCanvasTaskForScope · hub regenerate", () => {
  it("does not pick old SUCCEEDED when local section is pending", () => {
    const pick = pickPreferredCanvasTaskForScope(
      [
        {
          id: "old-char",
          nodeId: "hub-1",
          status: "SUCCEEDED",
          storyScope: { llmSection: "character" },
          model: "test",
          textOutput: "| 角色 | 描述 |",
          createdAt: "2026-07-16T10:00:00.000Z",
          updatedAt: "2026-07-16T10:05:00.000Z",
        } as CanvasTaskRecord,
      ],
      { llmSection: "character" },
      { status: "pending" },
    );
    expect(pick).toBeUndefined();
  });

  it("picks session SUCCEEDED when local pending and Gateway already returned", () => {
    markCanvasNodeRunSession("hub-2");
    const pick = pickPreferredCanvasTaskForScope(
      [
        {
          id: "old-char",
          nodeId: "hub-2",
          status: "SUCCEEDED",
          storyScope: { llmSection: "character" },
          model: "test",
          textOutput: "| 角色 | 旧 |",
          createdAt: "2026-07-16T09:00:00.000Z",
          updatedAt: "2026-07-16T09:05:00.000Z",
        } as CanvasTaskRecord,
        {
          id: "new-char",
          nodeId: "hub-2",
          status: "SUCCEEDED",
          storyScope: { llmSection: "character" },
          model: "test",
          textOutput: "| 角色 | 新 |",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as CanvasTaskRecord,
      ],
      { llmSection: "character" },
      { status: "pending" },
      "hub-2",
    );
    expect(pick?.id).toBe("new-char");
    clearCanvasNodeRunSession("hub-2");
  });
});

describe("shouldSkipHubSectionInflightTaskApply", () => {
  it("does not skip when run session active and section already has content", () => {
    markCanvasNodeRunSession("hub-1");
    const node = hubNode({
      outlineMd: "# 旧大纲",
      outlineRuntime: { status: "done", taskId: "old-task" },
    });
    expect(
      shouldSkipHubSectionInflightTaskApply(node, "outline", {
        id: "new-task",
        status: "SUBMITTED",
      }),
    ).toBe(false);
    clearCanvasNodeRunSession("hub-1");
  });

  it("skips stale inflight poll for same task on completed section", () => {
    const node = hubNode({
      outlineMd: "# 旧大纲",
      outlineRuntime: { status: "done", taskId: "same-task" },
    });
    expect(
      shouldSkipHubSectionInflightTaskApply(node, "outline", {
        id: "same-task",
        status: "SUBMITTED",
      }),
    ).toBe(true);
  });

  it("does not skip when server task id differs after refresh", () => {
    const node = hubNode({
      outlineMd: "# 旧大纲",
      outlineRuntime: { status: "done", taskId: "old-task" },
    });
    expect(
      shouldSkipHubSectionInflightTaskApply(node, "outline", {
        id: "new-task",
        status: "PENDING",
      }),
    ).toBe(false);
  });

  it("storyApplyTaskResult syncs running when regen over ready section", () => {
    markCanvasNodeRunSession("hub-1");
    const node = hubNode({
      outlineMd: '{"tier":"pro2"}',
      outlineRuntime: { status: "done", taskId: "old-task" },
    });
    const task = {
      id: "new-task",
      status: "SUBMITTED",
      nodeId: "hub-1",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    } as CanvasTaskRecord;
    const updateNodeData = vi.fn();

    storyApplyTaskResult(
      node,
      task,
      { nodeId: "hub-1", llmSection: "outline" },
      updateNodeData,
      [node],
    );

    expect(updateNodeData).toHaveBeenCalledWith(
      "hub-1",
      expect.objectContaining({
        outlineRuntime: expect.objectContaining({
          status: "running",
          taskId: "new-task",
        }),
      }),
    );
    clearCanvasNodeRunSession("hub-1");
  });
});

describe("hubShowsGeneratingUi · stale hubGenerateIntent", () => {
  it("keeps sweep while hubGenerateIntent is set even if sections look done", () => {
    const node = hubNode({
      hubGenerateIntent: true,
      outlineRuntime: { status: "done", taskId: "t1" },
      characterRuntime: { status: "done", taskId: "t2" },
      sceneRuntime: { status: "done", taskId: "t3" },
      storyboardRuntime: { status: "done", taskId: "t4" },
      storyboardMd: `| 镜号 | 景别 | 运镜 | 画面描述（含起始→终止站位） | 对白 | 时长(秒) | AI生图提示词(英文) | AI视频提示词(英文) | 口型/配音备注 |
|------|------|------|---------------------------|------|----------|---------------------|---------------------|---------------|
| 1 | 中景 | 固定 | 【起始】…【结束】… | 台词 | 10 | img | vid | — |`,
    });
    // 终态清 intent 前保持扫光，避免校验重试窗口闪回空态
    expect(hubShowsGeneratingUi(node, true)).toBe(true);
  });

  it("shows generating when intent persisted during active run session", () => {
    markCanvasNodeRunSession("hub-1");
    const node = hubNode(
      {
        hubGenerateIntent: true,
        outlineRuntime: { status: "done", taskId: "t1" },
        characterRuntime: { status: "done", taskId: "t2" },
        sceneRuntime: { status: "done", taskId: "t3" },
        storyboardRuntime: { status: "done", taskId: "t4" },
      },
      "hub-1",
    );
    expect(hubShowsGeneratingUi(node, true)).toBe(true);
    clearCanvasNodeRunSession("hub-1");
  });

  it("stripStaleHubGenerateIntent clears intent when no section running", () => {
    const nodes = stripStaleHubGenerateIntent([
      hubNode({
        hubGenerateIntent: true,
        outlineRuntime: { status: "done", taskId: "t1" },
        characterRuntime: { status: "done", taskId: "t2" },
        sceneRuntime: { status: "done", taskId: "t3" },
        storyboardRuntime: { status: "done", taskId: "t4" },
        storyboardMd: `| 镜号 | 景别 | 运镜 | 画面描述（含起始→终止站位） | 对白 | 时长(秒) | AI生图提示词(英文) | AI视频提示词(英文) | 口型/配音备注 |
|------|------|------|---------------------------|------|----------|---------------------|---------------------|---------------|
| 1 | 中景 | 固定 | 【起始】…【结束】… | 台词 | 10 | img | vid | — |`,
      }),
    ]);
    expect(
      (nodes[0]!.data as { hubGenerateIntent?: boolean }).hubGenerateIntent,
    ).toBeUndefined();
  });

  it("stripStaleHubGenerateIntent keeps intent while section pending", () => {
    const nodes = stripStaleHubGenerateIntent([
      hubNode({
        hubGenerateIntent: true,
        outlineRuntime: { status: "pending" },
      }),
    ]);
    expect(
      (nodes[0]!.data as { hubGenerateIntent?: boolean }).hubGenerateIntent,
    ).toBe(true);
  });

  it("shows generating when forceFresh keeps old MD and outlineRuntime is pending", () => {
    const node = hubNode({
      outlineMd: "| 大纲 | 旧内容 |",
      outlineRuntime: { status: "pending" },
      hubGenerateIntent: undefined,
    });
    expect(hubShowsGeneratingUi(node, false)).toBe(true);
  });

  it("shows generating when server task inflight but local runtimes are done", () => {
    const node = hubNode({
      outlineRuntime: { status: "done", taskId: "old" },
      characterRuntime: { status: "done", taskId: "old" },
      storyboardRuntime: { status: "done", taskId: "old" },
      storyboardMd: "| 镜号 | 画面 |",
    });
    expect(hubShowsGeneratingUi(node, false, true)).toBe(true);
    expect(hubShowsGeneratingUi(node, false, false)).toBe(false);
  });

  it("shows generating when retrying after section error with hubGenerateIntent", () => {
    const node = hubNode({
      hubGenerateIntent: true,
      outlineRuntime: {
        status: "error",
        taskId: "failed-kimi",
        failMessage: "引擎繁忙",
      },
    });
    expect(hubShowsGeneratingUi(node, true)).toBe(true);
  });
});

describe("pro2 human pack · storyboard promote", () => {
  it("promoteEmbeddedPackFromOutline extracts tab-separated storyboard", () => {
    const raw = [
      "视觉风格总纲",
      "维度\t内容",
      "故事背景\t测试",
      "分镜脚本",
      "镜号\t景别\t光影\t运镜\t画面描述（含起始→终止站位）\t道具\t对白\t时长(秒)\t音效\t口型/配音备注",
      "1\t特写\t冷蓝光影\t固定机位缓慢推进\t【起始】A【结束】B\t电脑\t—\t5\t键盘声\t—",
    ].join("\n");
    const promoted = promoteEmbeddedPackFromOutline(raw);
    expect(parseStoryboardRows(promoted.storyboardMd).length).toBe(1);
    expect(resolvePro2StoryboardMdFromPackSource(raw)).toContain("分镜脚本");
  });

  it("buildHubStoryboardBackfillPatch fills empty storyboardMd from outlineRuntime", () => {
    const raw = [
      "分镜脚本",
      "镜号\t景别\t光影\t运镜\t画面描述（含起始→终止站位）\t道具\t对白\t时长(秒)\t音效\t口型/配音备注",
      "1\t特写\t冷蓝\t固定机位缓慢推进\t【起始】A【结束】B\t—\t—\t5\t—\t—",
    ].join("\n");
    const patch = buildHubStoryboardBackfillPatch({
      outlineMd: "视觉风格",
      storyboardMd: "",
      outlineRuntime: { status: "done", taskId: "t1", textOutput: raw },
    } as never);
    expect(patch.storyboardMd).toContain("分镜脚本");
    expect(parseStoryboardRows(patch.storyboardMd ?? "").length).toBe(1);
  });

  it("resolveHubStoryboardMd merges JSON prop/sfx when stored storyboardMd is stale v1", () => {
    const staleV1 = `| 镜号 | 景别 | 运镜 | 画面描述（含起始→终止站位） | 对白 | 时长(秒) | AI生图提示词(英文) | AI视频提示词(英文) | 口型/配音备注 |
|------|------|------|---------------------------|------|----------|---------------------|---------------------|---------------|
| 1 | 全景 | 固定 | 【起始】旧画面【结束】旧结束 | — | 10 | img | vid | — |`;
    const hubData = {
      storyboardMd: staleV1,
      productionScript: PRO2_FIXTURE_FULL_PACK.patch,
    };
    const md = resolveHubStoryboardMd(hubData);
    const rows = parseStoryboardRows(md);
    const shot1 = rows.find((r) => r.frameIndex === 1);
    expect(shot1?.propNames).toMatch(/明黄婚书/);
    expect(shot1?.sfxNote).toMatch(/人群议论/);
  });

  it("hubNodeRepairPatchIfChanged returns null when patch is identical", () => {
    const data = { outlineMd: "a", storyboardMd: "b" };
    expect(hubNodeRepairPatchIfChanged(data, { outlineMd: "a" })).toBeNull();
    expect(
      hubNodeRepairPatchIfChanged(data, { storyboardMd: "c" }),
    ).toEqual({ storyboardMd: "c" });
  });
});
