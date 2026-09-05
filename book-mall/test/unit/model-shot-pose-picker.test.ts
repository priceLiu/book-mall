import { describe, expect, it } from "vitest";

import { assembleModelShotPrompt } from "@/lib/ecom/model-shot/prompt-assembler";
import { parseModelShotAssistantOutput } from "@/lib/ecom/ecom-model-shot-parse";
import { extractModelShotJson, inferModelShotPhase, isMetaBriefComplete } from "@/lib/ecom/ecom-model-shot-phases";
import { pickModelShotPoses } from "@/lib/ecom/model-shot/pose-picker";
import type { ModelShotProject } from "@/lib/ecom/ecom-model-shot-types";

const baseProject = (): ModelShotProject => ({
  id: "p1",
  title: "test",
  module: "model-shot",
  status: "draft",
  brief: { platform: "小红书", styles: ["酷冷"], poseCount: 6 },
  settings: {},
  references: [
    { id: "g1", role: "garment", source: "upload", ossUrl: "https://example.com/g.jpg" },
    { id: "m1", role: "model", source: "model-library", ossUrl: "https://example.com/m.jpg", name: "Anna" },
  ],
  chatHistory: [],
  plan: { status: "draft", items: [] },
  meta: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe("pickModelShotPoses", () => {
  const pool = [
    { id: "p-a1", category: "A", title: "A1", baseDescription: "stand", enabled: true, sortOrder: 0 },
    { id: "p-h1", category: "H", title: "H1", baseDescription: "jump", enabled: true, sortOrder: 0 },
    { id: "p-c1", category: "C", title: "C1", baseDescription: "cool", enabled: true, sortOrder: 0 },
    { id: "p-j1", category: "J", title: "J1", baseDescription: "lean", enabled: true, sortOrder: 0 },
    { id: "p-k1", category: "K", title: "K1", baseDescription: "walk", enabled: true, sortOrder: 0 },
    { id: "p-b1", category: "B", title: "B1", baseDescription: "wave", enabled: true, sortOrder: 0 },
    { id: "p-i1", category: "I", title: "I1", baseDescription: "sit", enabled: true, sortOrder: 0 },
  ];

  it("avoids forbidden categories for 酷冷 style", () => {
    const picked = pickModelShotPoses({ pool, styles: ["酷冷"], count: 6, prop: null });
    expect(picked.length).toBe(6);
    expect(picked.some((p) => p.category === "H")).toBe(false);
    expect(picked.some((p) => p.category === "L")).toBe(false);
  });

  it("vetoes jump poses when prop conflicts", () => {
    const prop = {
      id: "prop-11",
      name: "长伞",
      visualDescription: "umbrella",
      conflictTags: ["no-jump"],
      enabled: true,
      sortOrder: 0,
    };
    const picked = pickModelShotPoses({ pool, styles: ["活泼"], count: 6, prop });
    expect(picked.some((p) => p.category === "H")).toBe(false);
  });

  it("studio scene + 优雅 avoids H/L and favors A/J/K", () => {
    const studioScene = {
      id: "scene-02",
      name: "极简高调影棚",
      visualPrompt: "纯白影棚",
      tags: { archetype: "studio" },
      enabled: true,
      sortOrder: 0,
    };
    const picked = pickModelShotPoses({
      pool,
      styles: ["优雅"],
      count: 6,
      prop: null,
      scene: studioScene,
    });
    expect(picked.length).toBe(6);
    expect(picked.some((p) => p.category === "H")).toBe(false);
    expect(picked.some((p) => p.category === "L")).toBe(false);
    expect(picked.filter((p) => ["A", "J", "K"].includes(p.category)).length).toBeGreaterThan(0);
  });

  it("outdoor beach scene + 活泼 includes B/H and excludes J", () => {
    const beachScene = {
      id: "scene-06",
      name: "海滨日落沙滩",
      visualPrompt: "金色沙滩",
      tags: { archetype: "outdoor" },
      enabled: true,
      sortOrder: 0,
    };
    const picked = pickModelShotPoses({
      pool,
      styles: ["活泼"],
      count: 6,
      prop: null,
      scene: beachScene,
    });
    expect(picked.some((p) => p.category === "B" || p.category === "H")).toBe(true);
    expect(picked.some((p) => p.category === "J")).toBe(false);
  });

  it("prefers poses with ossUrl within the same category", () => {
    const poolWithImages = [
      { id: "p-a-text", category: "A", title: "A text", baseDescription: "stand", enabled: true, sortOrder: 0 },
      {
        id: "p-a-img",
        category: "A",
        title: "A img",
        baseDescription: "stand with ref",
        ossUrl: "https://cdn.example.com/pose-a.webp",
        enabled: true,
        sortOrder: 1,
      },
      { id: "p-c1", category: "C", title: "C1", baseDescription: "cool", enabled: true, sortOrder: 0 },
      { id: "p-j1", category: "J", title: "J1", baseDescription: "lean", enabled: true, sortOrder: 0 },
      { id: "p-k1", category: "K", title: "K1", baseDescription: "walk", enabled: true, sortOrder: 0 },
      { id: "p-b1", category: "B", title: "B1", baseDescription: "wave", enabled: true, sortOrder: 0 },
      { id: "p-i1", category: "I", title: "I1", baseDescription: "sit", enabled: true, sortOrder: 0 },
    ];
    const picked = pickModelShotPoses({
      pool: poolWithImages,
      styles: ["酷冷"],
      count: 6,
      prop: null,
    });
    const categoryA = picked.find((p) => p.category === "A");
    expect(categoryA?.id).toBe("p-a-img");
  });
});

describe("assembleModelShotPrompt", () => {
  it("includes garment and no-prop negative when prop is none", () => {
    const prompt = assembleModelShotPrompt({
      poseDescription: "单手叉腰站立",
      brief: { platform: "淘宝" },
      references: [
        { id: "g", role: "garment", source: "upload", ossUrl: "https://x/g.jpg" },
        { id: "m", role: "model", source: "upload", ossUrl: "https://x/m.jpg" },
      ],
    });
    expect(prompt).toContain("单手叉腰站立");
    expect(prompt).toContain("无额外配饰");
    expect(prompt).toContain("动作克制");
  });

  it("uses free-form scene when scene is skipped", () => {
    const prompt = assembleModelShotPrompt({
      poseDescription: "行走",
      brief: { platform: "淘宝" },
      references: [
        { id: "g", role: "garment", source: "upload", ossUrl: "https://x/g.jpg" },
        { id: "s", role: "scene", source: "none", name: "跳过场景" },
      ],
    });
    expect(prompt).toContain("场景氛围由模型自由发挥");
    expect(prompt).not.toContain("专业电商摄影棚");
  });

  it("includes prop segment when prop selected", () => {
    const prompt = assembleModelShotPrompt({
      poseDescription: "行走",
      brief: { platform: "抖音" },
      references: [
        { id: "g", role: "garment", source: "upload", ossUrl: "https://x/g.jpg" },
        { id: "p", role: "prop", source: "library", name: "手提包" },
      ],
    });
    expect(prompt).toContain("道具：手提包");
    expect(prompt).not.toContain("无额外配饰");
  });

  it("uses per-item scene and prop overrides", () => {
    const prompt = assembleModelShotPrompt({
      poseDescription: "单手叉腰",
      brief: { platform: "淘宝" },
      references: [
        { id: "g", role: "garment", source: "upload", ossUrl: "https://x/g.jpg" },
        { id: "s", role: "scene", source: "library", name: "影棚" },
        { id: "p", role: "prop", source: "library", name: "手提包" },
      ],
      sceneText: "都市雪景街道，冷色调",
      propText: "透明雨伞",
    });
    expect(prompt).toContain("都市雪景街道");
    expect(prompt).toContain("道具：透明雨伞");
    expect(prompt).not.toContain("采用场景「影棚」");
  });
});

describe("parseModelShotAssistantOutput", () => {
  it("extracts model-shot JSON fence", () => {
    const text = `好的，已记录。\n\`\`\`model-shot\n{"brief":{"platform":"小红书","styles":["优雅"],"poseCount":6},"meta":{"phase":"poses"}}\n\`\`\``;
    const json = extractModelShotJson(text);
    expect(json?.brief).toBeTruthy();
    const parsed = parseModelShotAssistantOutput(baseProject(), text);
    expect(parsed.patch.brief?.platform).toBe("小红书");
  });
});

describe("inferModelShotPhase", () => {
  it("advances past stale meta.garment when garment is uploaded", () => {
    const project = {
      ...baseProject(),
      meta: { phase: "garment" as const },
      references: [
        { id: "g1", role: "garment" as const, source: "upload", ossUrl: "https://example.com/g.jpg" },
      ],
    };
    expect(inferModelShotPhase(project)).toBe("model");
  });

  it("moves to scene after model reference is attached", () => {
    expect(inferModelShotPhase(baseProject())).toBe("scene");
  });

  it("respects meta phase when assistant skipped optional prop", () => {
    const project = {
      ...baseProject(),
      references: [
        { id: "g1", role: "garment" as const, source: "upload", ossUrl: "https://example.com/g.jpg" },
        { id: "m1", role: "model" as const, source: "upload", ossUrl: "https://example.com/m.jpg" },
        { id: "s1", role: "scene" as const, source: "upload", ossUrl: "https://example.com/s.jpg" },
      ],
      brief: null,
      meta: { phase: "meta" as const },
    };
    expect(inferModelShotPhase(project)).toBe("meta");
  });

  it("advances past scene when scene is explicitly skipped", () => {
    const project = {
      ...baseProject(),
      brief: null,
      references: [
        ...baseProject().references,
        { id: "s-skip", role: "scene" as const, source: "none", name: "跳过场景" },
      ],
    };
    expect(inferModelShotPhase(project)).toBe("prop");
  });

  it("requires full meta brief and summary ack before poses phase", () => {
    expect(isMetaBriefComplete({ styles: ["优雅"] })).toBe(false);
    expect(isMetaBriefComplete({ styles: ["优雅"], platform: "小红书", poseCount: 6 })).toBe(true);
    const project = {
      ...baseProject(),
      brief: { styles: ["优雅"] as string[], platform: "小红书", poseCount: 6 },
      references: [
        ...baseProject().references,
        { id: "s1", role: "scene" as const, source: "library", name: "影棚" },
        { id: "p1", role: "prop" as const, source: "none", name: "无" },
      ],
    };
    expect(inferModelShotPhase(project)).toBe("meta");
    expect(
      inferModelShotPhase({
        ...project,
        meta: { wizard: { summaryAcknowledged: true } },
      }),
    ).toBe("poses");
  });
});
