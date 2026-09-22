import { describe, expect, it } from "vitest";

import {
  applyHitRewriteToSuite,
  buildInitialHitSuite,
  materializeHitTemplateToSuite,
} from "@/lib/ecom/detail-page-suite-hit/hit-materialize";
import { normalizeHitTemplate } from "@/lib/ecom/detail-page-suite-hit/hit-schemas";

const template = normalizeHitTemplate({
  template_name: "测试范式",
  component_list: [
    { id: "hit_full_banner_1", type: "full_banner", layout: "full_image", repeat_count: 1 },
    {
      id: "hit_feature_card_1",
      type: "feature_card",
      layout: "image_text_top_bottom",
      repeat_count: 3,
    },
  ],
});

describe("detail-page-suite-hit materialize", () => {
  it("builds empty initial suite", () => {
    expect(buildInitialHitSuite().modules).toEqual([]);
  });

  it("materializes repeat_count into slots and preserves existing images", () => {
    const existing = materializeHitTemplateToSuite(template);
    existing.modules[1]!.slots[0]!.imageUrl = "https://oss.example/a.jpg";
    existing.modules[1]!.slots[0]!.positive_prompt = "keep-me";

    const next = materializeHitTemplateToSuite(
      normalizeHitTemplate({
        ...template,
        component_list: template.component_list.map((c) =>
          c.id === "hit_feature_card_1" ? { ...c, repeat_count: 2 } : c,
        ),
      }),
      existing,
    );
    const feature = next.modules.find((m) => m.module_id === "hit_feature_card_1");
    expect(feature?.generate_count).toBe(2);
    expect(feature?.slots).toHaveLength(2);
    expect(feature?.slots[0]?.imageUrl).toBe("https://oss.example/a.jpg");
    expect(feature?.slots[0]?.positive_prompt).toBe("keep-me");
  });

  it("applies rewrite prompts onto matching slots", () => {
    const suite = materializeHitTemplateToSuite(template);
    const { suite: next, warning } = applyHitRewriteToSuite({
      suite,
      template,
      rewrite: {
        components: [
          {
            component_id: "hit_full_banner_1",
            items: [
              {
                item_key: "banner",
                item_label: "首屏钩子",
                slot_copy: "暖到心里",
                positive_prompt: "商业摄影，户外山野，新品羽绒服全身，硬光冷调，无文字无logo",
              },
            ],
          },
          {
            component_id: "hit_feature_card_1",
            items: [
              {
                item_key: "f1",
                item_label: "卖点1",
                positive_prompt: "卖点卡1 半身特写 新品面料纹理 柔光 无文字abcdefgh",
              },
              {
                item_key: "f2",
                item_label: "卖点2",
                positive_prompt: "卖点卡2 半身特写 新品面料纹理 柔光 无文字abcdefgh",
              },
              {
                item_key: "f3",
                item_label: "卖点3",
                positive_prompt: "卖点卡3 半身特写 新品面料纹理 柔光 无文字abcdefgh",
              },
            ],
          },
        ],
      },
    });
    expect(warning).toBeUndefined();
    expect(next.modules[0]?.slots[0]?.item_label).toBe("首屏钩子");
    expect(next.modules[0]?.slots[0]?.slot_copy).toBe("暖到心里");
    expect(next.modules[0]?.slots[0]?.slot_copy_ai).toBe("暖到心里");
    expect(next.modules[1]?.slots).toHaveLength(3);
    expect(next.modules[1]?.slots[1]?.positive_prompt).toContain("卖点卡2");
  });
});
