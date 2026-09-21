import { describe, expect, it } from "vitest";

import {
  normalizeHitRewrite,
  normalizeHitTemplate,
  normalizeHitTemplateDetailed,
} from "@/lib/ecom/detail-page-suite-hit/hit-schemas";

describe("detail-page-suite-hit parse", () => {
  it("normalizes template and assigns stable ids", () => {
    const t = normalizeHitTemplate({
      schemaVersion: "detail-page-suite-hit/v1",
      template_name: "羽绒详情范式",
      canvas_width: 900,
      category_tag: ["羽绒服"],
      global_copy_style: "简洁硬核",
      global_style: { scene_theme: "户外山野", light_style: "硬光冷调" },
      copy_paradigm: { pain_points: ["怕冷"], narrative_order: ["先讲保暖"] },
      component_list: [
        { type: "full_banner", layout: "full_image", repeat_count: 1 },
        { type: "feature_card", layout: "image_text_top_bottom", repeat_count: 3 },
      ],
    });
    expect(t.canvas_width).toBe(750);
    expect(t.component_list).toHaveLength(2);
    expect(t.component_list[0]?.id).toMatch(/^hit_full_banner_/);
    expect(t.component_list[1]?.repeat_count).toBe(3);
    expect(t.component_list[1]?.user_editable_count).toBe(true);
  });

  it("clamps oversized repeat_count from LLM instead of failing parse", () => {
    const t = normalizeHitTemplate({
      template_name: "长详情",
      component_list: [
        { type: "detail_closeup", layout: "full_image", repeat_count: 15 },
        { type: "feature_card", layout: "image_text_top_bottom", repeat_count: 9 },
      ],
    });
    expect(t.component_list[0]?.repeat_count).toBe(8);
    expect(t.component_list[1]?.repeat_count).toBe(6);
  });

  it("rejects empty component list", () => {
    expect(() =>
      normalizeHitTemplate({
        template_name: "空",
        component_list: [],
      }),
    ).toThrow();
  });

  it("validates rewrite ids", () => {
    const rewrite = normalizeHitRewrite(
      {
        schemaVersion: "detail-page-suite-hit-rewrite/v1",
        components: [
          {
            component_id: "hit_full_banner_1",
            items: [
              {
                item_key: "a",
                item_label: "首屏",
                slot_copy: "暖到心里",
                positive_prompt: "商业摄影，户外山野，新品羽绒服全身，硬光冷调，无文字",
              },
            ],
          },
        ],
      },
      [{ id: "hit_full_banner_1", repeat_count: 1 }],
    );
    expect(rewrite.components[0]?.items[0]?.item_label).toBe("首屏");
    expect(() =>
      normalizeHitRewrite(
        {
          components: [
            {
              component_id: "unknown",
              items: [
                {
                  item_key: "a",
                  item_label: "x",
                  positive_prompt: "足够长的生图提示词内容abcdefgh",
                },
              ],
            },
          ],
        },
        [{ id: "hit_full_banner_1", repeat_count: 1 }],
      ),
    ).toThrow(/未知组件|缺少组件/);
  });

  it("coerces market_insight and global_style seven fields", () => {
    const { template } = normalizeHitTemplateDetailed({
      template_name: "洞察测试",
      market_insight: {
        hot_selling_dimensions: "面料抗风, 版型显瘦",
        user_pain_points: ["灌冷风"],
        module_copy_roles: ["首屏钩子"],
      },
      global_style: {
        scene_theme: "城市街拍",
        light_style: "柔光",
        color_tone: "高级灰",
        composition_style: "全身",
        picture_atmosphere: "生活化",
        prop_style: "简约",
        clarity_texture: "高清通透",
      },
      component_list: [{ type: "full_banner", layout: "full_image", repeat_count: 1 }],
    });
    expect(template.market_insight?.hot_selling_dimensions).toEqual(["面料抗风", "版型显瘦"]);
    expect(template.market_insight?.module_copy_functions).toEqual(["首屏钩子"]);
    expect(template.global_style?.scene_environment).toBe("城市街拍");
    expect(template.global_style?.clarity_texture).toBe("高清通透");
  });

  it("coerces Chinese type aliases and clamps repeat_count with warnings", () => {
    const { template, warnings } = normalizeHitTemplateDetailed({
      template_name: "别名测试",
      component_list: [{ type: "卖点", layout: "上图下文", repeat_count: 12 }],
    });
    expect(template.component_list[0]?.type).toBe("feature_card");
    expect(template.component_list[0]?.layout).toBe("image_text_top_bottom");
    expect(template.component_list[0]?.repeat_count).toBe(6);
    expect(warnings.some((w) => w.includes("截断"))).toBe(true);
  });
});
