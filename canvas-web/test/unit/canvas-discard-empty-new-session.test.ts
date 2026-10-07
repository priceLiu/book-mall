import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCanvasProjectDiscardIfStillEmptySession,
  isCanvasProjectDiscardIfStillEmptySession,
  markCanvasProjectDiscardIfStillEmpty,
  shouldDiscardEmptyNewCanvasOnLeave,
} from "@/lib/canvas/canvas-discard-empty-new-session";

describe("canvas-discard-empty-new-session", () => {
  const id = "proj_test_1";

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
      clear: () => store.clear(),
    });
  });

  it("marks and reads session flag", () => {
    expect(isCanvasProjectDiscardIfStillEmptySession(id)).toBe(false);
    markCanvasProjectDiscardIfStillEmpty(id);
    expect(isCanvasProjectDiscardIfStillEmptySession(id)).toBe(true);
    clearCanvasProjectDiscardIfStillEmptySession(id);
    expect(isCanvasProjectDiscardIfStillEmptySession(id)).toBe(false);
  });

  it("discards only marked empty untouched session", () => {
    markCanvasProjectDiscardIfStillEmpty(id);
    expect(
      shouldDiscardEmptyNewCanvasOnLeave({
        projectId: id,
        initialProjectName: "未命名画布",
        projectNameDraft: "未命名画布",
        nodeCount: 0,
        edgeCount: 0,
        everHadGraphContent: false,
        imageUploadPending: false,
        inflightTaskCount: 0,
      }),
    ).toBe(true);
  });

  it("does not discard without session flag", () => {
    expect(
      shouldDiscardEmptyNewCanvasOnLeave({
        projectId: id,
        initialProjectName: "未命名画布",
        projectNameDraft: "未命名画布",
        nodeCount: 0,
        edgeCount: 0,
        everHadGraphContent: false,
        imageUploadPending: false,
        inflightTaskCount: 0,
      }),
    ).toBe(false);
  });

  it("does not discard after graph was used", () => {
    markCanvasProjectDiscardIfStillEmpty(id);
    expect(
      shouldDiscardEmptyNewCanvasOnLeave({
        projectId: id,
        initialProjectName: "未命名画布",
        projectNameDraft: "未命名画布",
        nodeCount: 0,
        edgeCount: 0,
        everHadGraphContent: true,
        imageUploadPending: false,
        inflightTaskCount: 0,
      }),
    ).toBe(false);
  });
});
