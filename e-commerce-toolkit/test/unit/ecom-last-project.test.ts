import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  clearEcomLastProjectId,
  readEcomLastProjectId,
  resumeOrCreateEcomProject,
  writeEcomLastProjectId,
} from "@/lib/ecom-last-project";

const KEY = "ecom-test-last-project";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key) {
      map.delete(key);
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
  };
}

beforeAll(() => {
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage, sessionStorage },
  });
});

afterEach(() => {
  clearEcomLastProjectId(KEY);
});

describe("ecom last project", () => {
  it("prefers localStorage over sessionStorage", () => {
    window.sessionStorage.setItem(KEY, "session-id");
    window.localStorage.setItem(KEY, "local-id");
    expect(readEcomLastProjectId(KEY)).toBe("local-id");
  });

  it("resumes the stored id before creating", async () => {
    writeEcomLastProjectId(KEY, "p1");
    const result = await resumeOrCreateEcomProject({
      storageKey: KEY,
      getById: async (id) => ({ id }),
      create: async () => ({ id: "new" }),
    });
    expect(result).toEqual({ project: { id: "p1" }, created: false });
  });

  it("falls back to the most recent listed project", async () => {
    const result = await resumeOrCreateEcomProject({
      storageKey: KEY,
      getById: async (id) => ({ id }),
      listRecentIds: async () => ["recent", "older"],
      create: async () => ({ id: "new" }),
    });
    expect(result).toEqual({ project: { id: "recent" }, created: false });
    expect(readEcomLastProjectId(KEY)).toBe("recent");
  });
});
