import { describe, expect, it, vi } from "vitest";

import {
  fetchToolbarPanelWithSwr,
  peekToolbarPanelCache,
  writeToolbarPanelCache,
  invalidateToolbarPanelCache,
} from "@/lib/canvas/toolbar-panel-cache";

describe("fetchToolbarPanelWithSwr · 面板缓存失败不丢已有数据", () => {
  it("后台 revalidate 失败时保留缓存条目", async () => {
    invalidateToolbarPanelCache("test-panel|");
    writeToolbarPanelCache("test-panel|k=1", { items: ["cached"] });

    const seen: string[] = [];
    await fetchToolbarPanelWithSwr({
      cacheKey: "test-panel|k=1",
      fetch: async () => {
        throw new Error("network down");
      },
      onData: (data, meta) => {
        seen.push(`${meta.fromCache ? "cache" : "fresh"}:${data.items[0]}`);
      },
      onLoading: () => {},
      onError: () => {},
    });

    expect(seen).toEqual(["cache:cached"]);
    expect(peekToolbarPanelCache<{ items: string[] }>("test-panel|k=1")?.items).toEqual([
      "cached",
    ]);
  });

  it("force 刷新成功时更新 cache", async () => {
    invalidateToolbarPanelCache("test-panel|");
    writeToolbarPanelCache("test-panel|k=2", { items: ["old"] });

    await fetchToolbarPanelWithSwr({
      cacheKey: "test-panel|k=2",
      force: true,
      fetch: async () => ({ items: ["new"] }),
      onData: () => {},
      onLoading: () => {},
    });

    expect(peekToolbarPanelCache<{ items: string[] }>("test-panel|k=2")?.items).toEqual([
      "new",
    ]);
  });
});

describe("canvas panel sync events · 仅 invalidate 不删库", () => {
  it("invalidate 只清内存 Map，不触发 fetch", () => {
    writeToolbarPanelCache("generation-records|p=1", { n: 1 });
    invalidateToolbarPanelCache("generation-records|");
    expect(peekToolbarPanelCache("generation-records|p=1")).toBeNull();
  });
});
