import { describe, expect, it } from "vitest";

import {
  buildReplicaAssetPlanFromDecompose,
  buildReplicaAssetReplaceSummary,
  replicaAssetSlotToken,
} from "@/lib/ecom/ecom-replica-asset-plan";
import {
  applyReplicaReplacePostProcess,
  mergeReplicaReplaceTokensFromImageToVideo,
  parseProductRecognitionResult,
  pickReplicaPromptPreservingDensity,
  stripGarmentClausesFromPrompt,
  stripWardrobeTextFromPrompt,
  structureReplicaPromptByRole,
} from "@/lib/ecom/ecom-media-decompose-replica-script";
import {
  buildReplicaMentionCatalogFromPlan,
  upsertReplicaSlotReference,
} from "@/lib/ecom/ecom-media-decompose-replica-refs";
import type { MediaDecomposePatch } from "@/lib/ecom/ecom-media-decompose-structured";

describe("buildReplicaAssetPlanFromDecompose", () => {
  it("extracts multi-character labels for video talent count", () => {
    const structured: MediaDecomposePatch = {
      mediaType: "video",
      action: "decompose_complete",
      visualStyle: "",
      globalColorTone: "",
      cameraLanguageSummary: "",
      scenePrep: { venue: "室内", fixedProps: "展示台" },
      openingHook: { firstFrame: "", first3sLines: "" },
      fullTranscript: "",
      talentAnalysis: {
        count: "2位模特",
        appearance: "主模特亚裔女性",
        expressionStyle: "自然",
        blocking: "并肩站立",
      },
      wardrobeAnalysis: { garments: "针织开衫", changes: "", stylingNotes: "" },
      narrativeLogic: "",
      beatPoints: "",
      replicableShootingScript: "",
      storyboardTable: [
        {
          shotNo: 1,
          duration: "3s",
          shotSize: "中景",
          cameraMove: "固定",
          cameraAngle: "平视",
          composition: "三分法",
          lightingSetup: "柔光",
          toneContrast: "低对比",
          visualContent: "两位模特",
          characterAction: "",
          expression: "",
          subtitle: "",
          voiceover: "",
          sfx: "",
          bgm: "",
          transition: "",
          editRhythm: "",
        },
      ],
    };

    const plan = buildReplicaAssetPlanFromDecompose(structured);
    expect(plan.characters).toHaveLength(2);
    expect(plan.characters[0]?.label).toBe("人物A");
    expect(plan.characters[1]?.label).toBe("人物B");
    expect(plan.products).toHaveLength(1);
    expect(plan.props).toHaveLength(1);
    expect(plan.scenes).toHaveLength(1);
  });

  it("uses replicaAssetCatalog for multi-character image decompose", () => {
    const structured: MediaDecomposePatch = {
      mediaType: "image",
      action: "decompose_complete",
      elements: {
        subject: "两位人物同框",
        subjectPose: "行走",
        sceneEnvironment: "石阶",
        spatialPerspective: "",
        composition: "三分法",
        equivalentFocalLength: "35mm",
        shootingAngle: "平视",
        lighting: {
          keyLight: "",
          fillLight: "",
          rimLight: "",
          ambientLight: "",
          direction: "",
          hardSoft: "",
          colorTemperature: "",
        },
        materialTexture: "",
        colorSystem: "",
        atmosphere: "",
        detailNotes: "",
      },
      positivePrompt: "prompt",
      negativePrompt: "",
      liveActionReplication: {
        sceneSetup: "石阶场景",
        talentBlocking: "人物A前景、人物B远景",
        compositionFraming: "三分法",
        cameraPlacement: "3m",
        lightingSetup: "5600K",
        props: "竹担",
        cameraParams: "35mm f/5.6",
        postProcessing: "青橙调色",
        shootingChecklist: "1. 布光",
      },
      replicaAssetCatalog: {
        characterCount: 2,
        characters: [
          {
            label: "人物A",
            description: "前景自然流，红色 Polo 与青色运动短裤，距镜头 1.5–2m",
            roleInShot: "前景主体",
          },
          {
            label: "人物B",
            description: "后方远景，白色宽松 T 恤与灰色工装裤，沿石阶上行",
            roleInShot: "背景人物",
          },
        ],
        characterWardrobe: [
          { characterLabel: "人物A", garments: "红色 Polo 与青色运动短裤" },
          { characterLabel: "人物B", garments: "白色宽松 T 恤与灰色工装裤" },
        ],
        products: [{ label: "产品1", description: "竹担与红绸带" }],
        props: [{ label: "道具1", description: "竹担、红绸" }],
        scenes: [{ label: "场景1", description: "工业风石阶，灰白水渍混凝土" }],
      },
    };

    const plan = buildReplicaAssetPlanFromDecompose(structured);
    expect(plan.characters).toHaveLength(2);
    expect(plan.characters[0]?.label).toBe("人物A");
    expect(plan.characters[0]?.description).toContain("红色 Polo");
    expect(plan.characters[0]?.wardrobe).toContain("红色 Polo");
    expect(plan.characters[1]?.label).toBe("人物B");
    expect(plan.characters[1]?.wardrobe).toContain("白色宽松");
    expect(plan.products[0]?.description).toContain("竹担");
  });

  it("provides optional product slot when decompose has no product", () => {
    const structured: MediaDecomposePatch = {
      mediaType: "video",
      action: "decompose_complete",
      visualStyle: "",
      globalColorTone: "",
      cameraLanguageSummary: "",
      scenePrep: { venue: "室内", fixedProps: "" },
      openingHook: { firstFrame: "", first3sLines: "" },
      fullTranscript: "",
      talentAnalysis: {
        count: "1位模特",
        appearance: "女性",
        expressionStyle: "自然",
        blocking: "居中",
      },
      wardrobeAnalysis: { garments: "", changes: "", stylingNotes: "" },
      narrativeLogic: "",
      beatPoints: "",
      replicableShootingScript: "",
      storyboardTable: [
        {
          shotNo: 1,
          duration: "3s",
          shotSize: "中景",
          cameraMove: "固定",
          cameraAngle: "平视",
          composition: "三分法",
          lightingSetup: "柔光",
          toneContrast: "低对比",
          visualContent: "模特",
          characterAction: "",
          expression: "",
          subtitle: "",
          voiceover: "",
          sfx: "",
          bgm: "",
          transition: "",
          editRhythm: "",
        },
      ],
    };

    const plan = buildReplicaAssetPlanFromDecompose(structured);
    expect(plan.products).toHaveLength(1);
    expect(plan.products[0]?.description).toContain("原片无独立产品");
  });
});

describe("replica asset slot refs", () => {
  it("maps uploaded slots to semantic tokens", () => {
    const structured: MediaDecomposePatch = {
      mediaType: "image",
      action: "decompose_complete",
      elements: {
        subject: "模特展示开衫",
        subjectPose: "站立",
        sceneEnvironment: "棚拍",
        composition: "三分法",
        colorSystem: "暖色",
        atmosphere: "lookbook",
        lighting: {
          keyLight: "",
          fillLight: "",
          rimLight: "",
          ambientLight: "",
          direction: "",
          hardSoft: "",
          colorTemperature: "",
        },
      },
      positivePrompt: "prompt",
      negativePrompt: "",
      liveActionReplication: {
        sceneSetup: "棚",
        talentBlocking: "居中",
        compositionFraming: "半身",
        cameraPlacement: "平视",
        lightingSetup: "柔光",
        props: "衣架",
        cameraParams: "50mm",
        postProcessing: "",
        shootingChecklist: "",
      },
    };
    const plan = buildReplicaAssetPlanFromDecompose(structured);
    const charA = plan.characters[0]!;
    const { references } = upsertReplicaSlotReference([], charA, "https://cdn/a.png");
    const catalog = buildReplicaMentionCatalogFromPlan(plan, references);
    expect(catalog[0]?.token).toBe(replicaAssetSlotToken(charA));
    expect(catalog[0]?.token).toBe("@人物A");

    const summary = buildReplicaAssetReplaceSummary(plan, new Set([charA.id]));
    expect(summary).toContain("replace");
    expect(summary).toContain("@人物A");
  });
});

describe("replica replace post-process", () => {
  it("preserves @tokens when reverting to mechanical draft", () => {
    const draft = "固定机位，柔光侧顺光，暖金色调，工业风石阶场景";
    const llm = "@人物A @产品1，固定机位，新模特穿针织开衫";
    const out = pickReplicaPromptPreservingDensity(llm, draft, 0.65);
    expect(out).toContain("@人物A");
    expect(out).toContain("@产品1");
    expect(out).toContain("固定机位");
  });

  it("does not restore full draft with old wardrobe when LLM has tokens", () => {
    const draft =
      "white short-sleeve T-shirt, dark gray trousers, 固定机位缓慢推镜，柔光侧顺光，暖金色调，工业风石阶场景延续";
    const llm = "@人物A @产品1，固定机位";
    const strip = ["white short-sleeve T-shirt, dark gray trousers"];
    const out = pickReplicaPromptPreservingDensity(llm, draft, 0.65, strip);
    expect(out).toContain("@人物A");
    expect(out).not.toMatch(/white short-sleeve/i);
    expect(out).not.toBe(draft);
  });

  it("strips English garment clauses", () => {
    const prompt =
      "@人物A wearing white short-sleeve T-shirt and dark gray trousers, running toward camera";
    const cleaned = stripGarmentClausesFromPrompt(prompt);
    expect(cleaned).toContain("@人物A");
    expect(cleaned).not.toMatch(/white short-sleeve/i);
    expect(cleaned).toContain("running toward camera");
  });

  it("structures video prompt with character and product lanes", () => {
    const plan = buildReplicaAssetPlanFromDecompose({
      mediaType: "image",
      action: "decompose_complete",
      elements: {
        subject: "男孩",
        subjectPose: "奔跑",
        sceneEnvironment: "石阶",
        composition: "三分法",
        colorSystem: "暖色",
        atmosphere: "纪实",
        lighting: {
          keyLight: "",
          fillLight: "",
          rimLight: "",
          ambientLight: "",
          direction: "",
          hardSoft: "",
          colorTemperature: "",
        },
      },
      positivePrompt: "prompt",
      negativePrompt: "",
      liveActionReplication: {
        sceneSetup: "石阶",
        talentBlocking: "人物A",
        compositionFraming: "三分法",
        cameraPlacement: "平视",
        lightingSetup: "5600K",
        props: "无",
        cameraParams: "35mm",
        postProcessing: "",
        shootingChecklist: "",
      },
      replicaAssetCatalog: {
        characterCount: 1,
        characters: [{ label: "人物A", description: "男孩奔跑" }],
        characterWardrobe: [{ characterLabel: "人物A", garments: "白色T恤与灰色长裤" }],
        products: [{ label: "产品1", description: "色块托特包" }],
        props: [],
        scenes: [],
      },
    });
    const charA = plan.characters[0]!;
    const prod1 = plan.products[0]!;
    const structured = structureReplicaPromptByRole("固定机位缓慢推镜，柔光侧顺光", {
      assetPlan: plan,
      uploadedSlotIds: new Set([charA.id, prod1.id]),
      productDisplayAction: "单手持包于腰侧",
    });
    expect(structured).toMatch(/^人物 @人物A；产品 @产品1/);
    expect(structured).toContain("固定机位");
  });

  it("merges replace tokens from image to video prompt", () => {
    const video = "固定机位缓慢推镜，柔光侧顺光";
    const image = "@人物A @产品1，半身构图，手持展示新品";
    expect(mergeReplicaReplaceTokensFromImageToVideo(image, video)).toContain("@人物A");
    expect(mergeReplicaReplaceTokensFromImageToVideo(image, video)).toContain("@产品1");
  });

  it("strips wardrobe fragments for replaced characters", () => {
    const prompt = "@人物A，红色 Polo 与青色运动短裤，站在石阶前景";
    const cleaned = stripWardrobeTextFromPrompt(prompt, ["红色 Polo 与青色运动短裤"]);
    expect(cleaned).toContain("@人物A");
    expect(cleaned).not.toContain("红色 Polo");
  });

  it("parses product displayAction from recognize JSON", () => {
    const parsed = parseProductRecognitionResult(
      '{"productName":"手提包","category":"包袋","displayAction":"手持展示","displayActionDetail":"模特单手持包于腰侧，包口朝向镜头"}',
    );
    expect(parsed.displayAction).toBe("手持展示");
    expect(parsed.productBrief).toContain("展示动作");
  });

  it("applyReplicaReplacePostProcess strips wardrobe and syncs video tokens", () => {
    const plan = buildReplicaAssetPlanFromDecompose({
      mediaType: "image",
      action: "decompose_complete",
      elements: {
        subject: "男孩",
        subjectPose: "站立",
        sceneEnvironment: "石阶",
        spatialPerspective: "",
        composition: "三分法",
        equivalentFocalLength: "35mm",
        shootingAngle: "平视",
        lighting: {
          keyLight: "",
          fillLight: "",
          rimLight: "",
          ambientLight: "",
          direction: "",
          hardSoft: "",
          colorTemperature: "",
        },
        materialTexture: "",
        colorSystem: "",
        atmosphere: "",
        detailNotes: "",
      },
      positivePrompt: "prompt",
      negativePrompt: "",
      liveActionReplication: {
        sceneSetup: "石阶",
        talentBlocking: "人物A",
        compositionFraming: "三分法",
        cameraPlacement: "3m",
        lightingSetup: "5600K",
        props: "无",
        cameraParams: "35mm",
        postProcessing: "",
        shootingChecklist: "",
      },
      replicaAssetCatalog: {
        characterCount: 1,
        characters: [{ label: "人物A", description: "男孩站立于石阶" }],
        characterWardrobe: [{ characterLabel: "人物A", garments: "红色 Polo 与运动短裤" }],
        products: [],
        props: [],
        scenes: [{ label: "场景1", description: "工业风石阶" }],
      },
    });
    const charA = plan.characters[0]!;
    const shots = applyReplicaReplacePostProcess(
      [
        {
          index: 1,
          timeSlice: "1",
          refImageId: "r1",
          refImageLabel: "@人物A",
          sceneDescription: "男孩穿红色 Polo",
          imagePrompt: "@人物A，红色 Polo 与运动短裤，石阶前景",
          videoPrompt: "固定机位，柔光",
          voiceover: "",
          durationSec: 5,
        },
      ],
      { assetPlan: plan, uploadedSlotIds: new Set([charA.id]) },
    );
    expect(shots[0]?.imagePrompt).not.toContain("红色 Polo");
    expect(shots[0]?.videoPrompt).toContain("@人物A");
    expect(shots[0]?.videoPrompt).toMatch(/^人物 @人物A/);
  });
});
