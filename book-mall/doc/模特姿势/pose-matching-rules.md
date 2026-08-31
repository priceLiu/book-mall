# 风格 → 姿势匹配规则（四层筛选）

> 运行时真源：`book-mall/lib/ecom/model-shot/pose-picker.ts`、`style-micro-adjust.ts`、`scene-pose-rules.ts`  
> 来源：仓库根目录 `docs/模特姿势风格姿势匹配规则.md`

## 规则一：亲和度优先抽取（风格）

按用户风格从姿势库 category（A–M）中加权抽取，禁止进入冲突库。

| 风格 | 优先库 | 允许少量 | 禁止库 |
|------|--------|----------|--------|
| 酷冷/高冷/疏离 | C,E,J,K,A | B,I | H,L |
| 活泼/元气/甜美 | B,H,I,L | A,D | J,K |
| 夸张/戏剧/张力强 | H,L,D,K | B,C | A,J |
| 优雅/知性/温柔 | J,K,C,A | I,E | H,L |
| 慵懒/随性/松弛 | I,A,B | E,C | J,K,H |
| 自信/强大/霸气 | K,J,C,A,L | — | I,B |
| 性感/魅惑 | K,C,E,D | L | J,A |
| 邻家/亲切/自然 | I,B,A | H,E | K,L |

## 规则二：四维微调替换

抽中姿势后，按风格替换手部/腿部/头部/躯干描述。详见 `style-micro-adjust.ts`。

## 规则三：冲突否决（道具）

- 公文包 / 高脚杯 → 禁 H,L
- 雨伞 conflictTags → 禁 D 单膝跪地、L 抱头后仰、H/L 跳跃

## 规则四：场景 archetype → category（V2）

场景库条目 `tags.archetype`（或数组首项）决定姿势加权/禁止。与规则一取 **交集优先**；场景禁止叠加风格禁止。

| archetype | 示例场景 | 优先 category | 禁止 category |
|-----------|----------|---------------|---------------|
| `studio` | 极简影棚、宴会厅 | A,J,K,C | H,L |
| `outdoor` | 海滨、草地 | B,H,E | J |
| `street` | 霓虹街、雪景街拍 | B,I,C | L |
| `indoor_lifestyle` | 法式阳台、咖啡馆 | I,A,J | H,L |
| `commercial` | 都市商业 | A,K,J | H |

- **跳过场景** 或未识别 tags：仅应用规则一～三
- **用户自建场景**：创建时必选 archetype，写入 tags

## 助手 Prompt 精简版

嵌入 `skill.md` 第五步：库抽取层 → 微调替换层 → 冲突否决层 → 场景层；完整表格以代码与本文档为准。
