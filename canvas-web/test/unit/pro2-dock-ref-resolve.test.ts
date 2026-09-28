import { describe, expect, it } from "vitest";
import { resolveDockRefsForRun, resolveDockImageUrlsForRun } from "@/lib/canvas/pro2-dock-ref-catalog";
import type { Pro2DockUpstreamLink } from "@/lib/canvas/pro2-dock-upstream-links";
import {
  dockMentionRefUrlsForPrompt,
  listDockImageMentionRunIssues,
} from "@/lib/canvas/dock-mention-ref-urls";
import { pro2DockMentionRefCatalog } from "@/lib/canvas/pro2-dock-ref-catalog";

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

describe("resolveDockImageUrlsForRun", () => {
  it("returns all catalog urls when prompt has no @", () => {
    const urls = resolveDockImageUrlsForRun(upstream, [], "");
    expect(urls).toEqual([
      "https://cdn.example/a.png",
      "https://cdn.example/b.png",
    ]);
  });

  it("orders urls by @ mention order in prompt", () => {
    const urls = resolveDockImageUrlsForRun(
      upstream,
      [],
      "女孩 @<up-img-b> 与男孩 @<up-img-a>",
    );
    expect(urls).toEqual([
      "https://cdn.example/b.png",
      "https://cdn.example/a.png",
    ]);
  });

  it("keeps blob preview urls so run-queue can materialize them", () => {
    const withBlob: Pro2DockUpstreamLink[] = [
      {
        id: "up-img-a",
        kind: "image",
        label: "巴鲁",
        previewUrl: "blob:http://localhost/balu",
        sourceNodeId: "n1",
      },
      {
        id: "up-img-b",
        kind: "image",
        label: "希达",
        previewUrl: "https://cdn.example/xida.png",
        sourceNodeId: "n2",
      },
    ];
    expect(
      resolveDockImageUrlsForRun(
        withBlob,
        [],
        "角色 @<up-img-a> 与 @<up-img-b>",
      ),
    ).toEqual(["blob:http://localhost/balu", "https://cdn.example/xida.png"]);
  });
});

describe("dockMentionRefUrlsForPrompt", () => {
  it("does not fall back to full catalog when @ image id has no url", () => {
    const catalog = pro2DockMentionRefCatalog(
      [
        {
          id: "up-img-a",
          kind: "image",
          label: "巴鲁",
          previewUrl: "https://cdn.example/a.png",
          sourceNodeId: "n1",
        },
        {
          id: "up-img-b",
          kind: "image",
          label: "希达",
          previewUrl: undefined,
          sourceNodeId: "n2",
        },
      ],
      [],
    );
    expect(
      dockMentionRefUrlsForPrompt(
        "男孩 @<up-img-b> 与 @<up-img-a>",
        catalog,
      ),
    ).toEqual(["https://cdn.example/a.png"]);
  });
});

describe("listDockImageMentionRunIssues", () => {
  it("reports missing url for @ image mention", () => {
    const links: Pro2DockUpstreamLink[] = [
      {
        id: "up-img-b",
        kind: "image",
        label: "希达",
        previewUrl: undefined,
        sourceNodeId: "n2",
      },
    ];
    const issues = listDockImageMentionRunIssues(
      "角色 @<up-img-b>",
      links,
      [],
    );
    expect(issues[0]).toMatch(/希达/);
    expect(issues[0]).toMatch(/尚未就绪/);
  });
});
