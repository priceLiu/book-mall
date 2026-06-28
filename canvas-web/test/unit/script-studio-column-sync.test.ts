import { describe, expect, it } from "vitest";

import { syncScriptStudioEpisodeToProRows } from "@/lib/canvas/script-studio-column-sync";
import { parseScriptStudioEpisode } from "@/lib/canvas/script-studio-parse";

const EP1_BODY = `
## 模块2：本集出场人物完整版视觉锁定复盘
| 姓名 | 年龄 | 身高体型 | 脸型骨相 | 五官细节 | 神态气质 | 皮肤质感 | 发型体系 | 全套穿搭 | 固定配饰 | 本集临时穿搭 | 本集情绪 | 行为逻辑 | 台词风格 |
|------|------|------|------|------|------|------|------|------|------|------|------|------|------|
| 林晨 | 22 | 178/瘦削 | 鹅蛋脸 | 丹凤眼 | 清冷 | 冷白皮 | 黑色短发 | 灰色风衣 | 银表 | 无 | 沉郁 | 谨慎 | 简短 |

## 模块7：标准化分镜脚本表格
| 镜号 | 单镜头时长(秒) | 景别 | 镜头运动 | 完整画面内容描述 | 人物动作/神态/穿搭配饰细节 | 画面同步台词/字幕 | 镜头整体情绪 | 适配BGM曲风 |
|------|------|------|------|------|------|------|------|------|
| 1 | 4 | 全景 | 慢推 | 站台 | 无 | — | 苍凉 | 钢琴 |

## 模块8：分镜图 AI 生成提示词
- 镜1：中文
- 镜1(EN)：english prompt
`;

describe("script-studio-column-sync", () => {
  it("maps parsed episode to Pro2 column rows", () => {
    const ep = parseScriptStudioEpisode(1, "", EP1_BODY);
    const sync = syncScriptStudioEpisodeToProRows(ep, "hub-1");
    expect(sync.characters[0]?.name).toBe("林晨");
    expect(sync.frames[0]?.prompt).toBe("english prompt");
    expect(sync.frames[0]?.videoPrompt).toBe("english prompt");
    expect(sync.moods[0]?.description).toContain("钢琴");
  });
});
