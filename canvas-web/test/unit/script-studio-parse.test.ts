import { describe, expect, it } from "vitest";

import {
  parseScriptStudioBatch,
  parseScriptStudioImagePrompts,
  splitScriptStudioEpisodes,
  splitScriptStudioModules,
} from "@/lib/canvas/script-studio-parse";

const SAMPLE = `第一篇章主题概述：少年返乡。

# 第1集

## 模块1：本集基础档案
- 集数：1
- 单集标准时长：3 分钟

## 模块2：本集出场人物完整版视觉锁定复盘
| 姓名 | 年龄 | 身高体型 | 脸型骨相 | 五官细节 | 神态气质 | 皮肤质感 | 发型体系 | 全套穿搭 | 固定配饰 | 本集临时穿搭 | 本集情绪 | 行为逻辑 | 台词风格 |
|------|------|------|------|------|------|------|------|------|------|------|------|------|------|
| 林晨 | 22 | 178/瘦削 | 鹅蛋脸 | 丹凤眼 | 清冷 | 冷白皮 | 黑色短发 | 灰色风衣 | 银色腕表 | 加围巾 | 沉郁 | 谨慎 | 简短 |
| 苏晚 | 20 | 165/匀称 | 圆脸 | 杏眼 | 温柔 | 自然黄皮 | 长直发 | 米色毛衣 | 珍珠耳钉 | 无 | 雀跃 | 热情 | 软糯 |

## 模块3：本集场景完整环境档案
| 场景名称 | 内外景 | 时间区间 | 年代装修布局 | 光影参数 | 环境氛围 | 常驻道具 | 背景音效 |
|------|------|------|------|------|------|------|------|
| 老火车站 | 外景 | 黄昏 | 90年代水泥站台 | 暖橙逆光 | 离愁 | 长椅/行李车 | 火车汽笛 |

## 模块4：本集道具精细化清单
| 道具名称 | 类型 | 剧情作用 | 质感/新旧 | 摆放/手持位置 | 年代合规 | 是否特写 |
|------|------|------|------|------|------|------|
| 旧皮箱 | 核心剧情道具 | 承载回忆 | 磨损牛皮 | 林晨手持 | 是 | 是 |

## 模块7：标准化分镜脚本表格
| 镜号 | 单镜头时长(秒) | 景别 | 镜头运动 | 完整画面内容描述 | 人物动作/神态/穿搭配饰细节 | 画面同步台词/字幕 | 镜头整体情绪 | 适配BGM曲风 |
|------|------|------|------|------|------|------|------|------|
| 1 | 4 | 全景 | 慢推 | 黄昏站台空镜 | 无 | — | 苍凉 | 钢琴 |
| 2 | 3 | 近景 | 固定 | 林晨提箱驻足 | 林晨灰风衣银表 | 林晨：到家了 | 沉郁 | 弦乐 |

## 模块8：分镜图 AI 生成提示词
- 镜1：写实电影感，90年代水泥站台，黄昏逆光，空镜，8K
- 镜1(EN)：cinematic film still, 1990s concrete platform, golden dusk backlight, empty scene, 8K
- 镜2：写实电影感，灰风衣青年提皮箱，忧郁，8K
- 镜2(EN)：cinematic film still, young man in gray trench coat holding leather suitcase, melancholic, 8K

## 模块9：分镜视频成片统一渲染参数
- 画幅 16:9

# 第2集

## 模块2：本集出场人物完整版视觉锁定复盘
| 姓名 | 年龄 | 身高体型 | 脸型骨相 | 五官细节 | 神态气质 | 皮肤质感 | 发型体系 | 全套穿搭 | 固定配饰 | 本集临时穿搭 | 本集情绪 | 行为逻辑 | 台词风格 |
|------|------|------|------|------|------|------|------|------|------|------|------|------|------|
| 林晨 | 22 | 178/瘦削 | 鹅蛋脸 | 丹凤眼 | 清冷 | 冷白皮 | 黑色短发 | 灰色风衣 | 银色腕表 | 无 | 平静 | 谨慎 | 简短 |

## 模块7：标准化分镜脚本表格
| 镜号 | 单镜头时长(秒) | 景别 | 镜头运动 | 完整画面内容描述 | 人物动作/神态/穿搭配饰细节 | 画面同步台词/字幕 | 镜头整体情绪 | 适配BGM曲风 |
|------|------|------|------|------|------|------|------|------|
| 1 | 5 | 中景 | 跟随移动 | 巷口清晨 | 林晨快步 | — | 紧张 | 鼓点 |
`;

describe("script-studio-parse", () => {
  it("splits episodes by 第N集", () => {
    const eps = splitScriptStudioEpisodes(SAMPLE);
    expect(eps.map((e) => e.episodeNo)).toEqual([1, 2]);
  });

  it("splits modules by 模块X", () => {
    const eps = splitScriptStudioEpisodes(SAMPLE);
    const mods = splitScriptStudioModules(eps[0]!.body);
    expect([...mods.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 7, 8, 9]);
  });

  it("parses module 8 image prompts (zh + en) keyed by frame index", () => {
    const m = parseScriptStudioImagePrompts(
      "- 镜1：中文阿尔法\n- 镜1(EN)：alpha\n- 镜2：中文贝塔\n- 镜2(EN)：beta gamma",
    );
    expect(m.get(1)).toEqual({ zh: "中文阿尔法", en: "alpha" });
    expect(m.get(2)).toEqual({ zh: "中文贝塔", en: "beta gamma" });
  });

  it("parses full batch into typed rows", () => {
    const batch = parseScriptStudioBatch(SAMPLE);
    expect(batch.episodes).toHaveLength(2);

    const ep1 = batch.episodes[0]!;
    expect(ep1.episodeNo).toBe(1);
    expect(ep1.characters.map((c) => c.name)).toEqual(["林晨", "苏晚"]);
    expect(ep1.characters[0]!.accessories).toBe("银色腕表");
    expect(ep1.characters[0]!.speechStyle).toBe("简短");

    expect(ep1.scenes).toHaveLength(1);
    expect(ep1.scenes[0]!.name).toBe("老火车站");
    expect(ep1.scenes[0]!.ambientSound).toBe("火车汽笛");

    expect(ep1.props).toHaveLength(1);
    expect(ep1.props[0]!.name).toBe("旧皮箱");
    expect(ep1.props[0]!.closeUp).toBe("是");

    expect(ep1.shots).toHaveLength(2);
    expect(ep1.shots[1]!.frameIndex).toBe(2);
    expect(ep1.shots[1]!.shotSize).toBe("近景");
    expect(ep1.shots[1]!.cameraMove).toBe("固定");
    expect(ep1.shots[1]!.dialogue).toBe("林晨：到家了");
    expect(ep1.shots[1]!.bgm).toBe("弦乐");
    // module 8 prompt merged by frame index (en for generation, zh for display)
    expect(ep1.shots[0]!.imagePrompt).toContain("1990s concrete platform");
    expect(ep1.shots[0]!.imagePromptZh).toContain("90年代水泥站台");
    expect(ep1.shots[1]!.imagePrompt).toContain("leather suitcase");
    expect(ep1.shots[1]!.imagePromptZh).toContain("灰风衣青年");
  });

  it("returns empty episodes when no 第N集 heads", () => {
    expect(parseScriptStudioBatch("no episode markers here").episodes).toEqual(
      [],
    );
  });
});
