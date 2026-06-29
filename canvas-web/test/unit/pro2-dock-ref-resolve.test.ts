import { describe, expect, it } from "vitest";
import { resolveDockRefsForRun } from "@/lib/canvas/pro2-dock-ref-catalog";
import type { Pro2DockUpstreamLink } from "@/lib/canvas/pro2-dock-upstream-links";

const upstream: Pro2DockUpstreamLink[] = [
  {
    id: "up-img-a",
    kind: "image",
    label: "参考图 A",
    previewUrl: "https://cdn.example/a.png",
    sourceNodeId: "n1",
  },
  {
    id: "up-img-b",
    kind: "image",
    label: "参考图 B",
    previewUrl: "https://cdn.example/b.png",
    sourceNodeId: "n2",
  },
];

describe("resolveDockRefsForRun", () => {
  it("returns all catalog refs when prompt has no @", () => {
    const refs = resolveDockRefsForRun("编辑背景为雪夜", upstream, []);
    expect(refs.map((r) => r.id)).toEqual(["up-img-a", "up-img-b"]);
  });

  it("returns only @mentioned refs when prompt has @", () => {
    const refs = resolveDockRefsForRun(
      "按 @<up-img-a> 风格编辑",
      upstream,
      [],
    );
    expect(refs.map((r) => r.id)).toEqual(["up-img-a"]);
  });

  it("merges pasted dockRefImages with upstream", () => {
    const refs = resolveDockRefsForRun("", upstream, [
      { id: "paste-1", label: "粘贴", url: "https://cdn.example/p.png" },
    ]);
    expect(refs).toHaveLength(3);
  });
});
