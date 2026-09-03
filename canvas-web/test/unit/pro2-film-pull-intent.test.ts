import { describe, expect, it } from "vitest";

import {
  dockTextHasFilmPullIntent,
  listPro2UpstreamVideoUrls,
  resolvePro2HubFilmPullIntent,
} from "@/lib/canvas/pro2-film-pull-intent";
import type { Pro2DockUpstreamLink } from "@/lib/canvas/pro2-dock-upstream-links";

describe("pro2-film-pull-intent", () => {
  it("detects 拉片 keywords", () => {
    expect(dockTextHasFilmPullIntent("请拉片")).toBe(true);
    expect(dockTextHasFilmPullIntent("逐镜分析原片")).toBe(true);
    expect(dockTextHasFilmPullIntent("film-pull")).toBe(true);
    expect(dockTextHasFilmPullIntent("生成古风甜宠剧本")).toBe(false);
  });

  it("lists https video urls from upstream links", () => {
    const links: Pro2DockUpstreamLink[] = [
      {
        id: "v1",
        kind: "video",
        label: "源视频",
        previewUrl: "https://cdn.example.com/a.mp4",
        sourceNodeId: "n1",
      },
      {
        id: "img",
        kind: "image",
        label: "图",
        previewUrl: "https://cdn.example.com/a.jpg",
        sourceNodeId: "n2",
      },
    ];
    expect(listPro2UpstreamVideoUrls(links)).toEqual([
      "https://cdn.example.com/a.mp4",
    ]);
  });

  it("blocks director profile when user asks to 拉片 with video", () => {
    expect(
      resolvePro2HubFilmPullIntent({
        packProfile: "director",
        dockInput: "拉片",
        hasUpstreamVideo: true,
        hasOutline: false,
      }),
    ).toBe("blocked_need_industrial");
  });

  it("triggers film_pull on industrial + video + 拉片", () => {
    expect(
      resolvePro2HubFilmPullIntent({
        packProfile: "industrial",
        dockInput: "拉片",
        hasUpstreamVideo: true,
        hasOutline: true,
      }),
    ).toBe("film_pull");
  });

  it("triggers film_pull on industrial + video + empty dock without outline", () => {
    expect(
      resolvePro2HubFilmPullIntent({
        packProfile: "industrial",
        dockInput: "  ",
        hasUpstreamVideo: true,
        hasOutline: false,
      }),
    ).toBe("film_pull");
  });

  it("does not trigger without upstream video", () => {
    expect(
      resolvePro2HubFilmPullIntent({
        packProfile: "industrial",
        dockInput: "拉片",
        hasUpstreamVideo: false,
      }),
    ).toBe("none");
  });
});
