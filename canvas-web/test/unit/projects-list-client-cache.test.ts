import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  invalidateCachedProjectsList,
  loadCachedProjectsList,
  saveCachedProjectsList,
} from "@/lib/canvas/projects-list-client-cache";

describe("projects-list-client-cache", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
  });

  it("round-trips list page within TTL", () => {
    const page = {
      projects: [{ id: "p1", name: "Demo" } as never],
      nextCursor: "c1",
      hasMore: true,
    };
    saveCachedProjectsList(page);
    expect(loadCachedProjectsList()?.projects).toHaveLength(1);
    invalidateCachedProjectsList();
    expect(loadCachedProjectsList()).toBeNull();
  });
});
