# 漫剧工作流 · 双轨对照

| 维度 | 基础快手版 | 影视专业版 |
|------|------------|------------|
| 代号 | `story-comic` | `story-pro` |
| 真源文档 | [story-workflow-canonical.md](./story-workflow-canonical.md) | [story-pro-workflow-canonical.md](./story-pro-workflow-canonical.md) |
| 阶段 | 定稿前 → 定稿拆列 → 媒体 | 故事 → 风格 → 设计 → 分镜 → 视频 |
| Starter | `story-comic-starter` | `story-pro-starter` |
| 文案 Hub | `story-script-hub` | `story-pro-script-hub` |
| 风格 | 主题 prompt | `story-pro-style`（锚定词强制注入） |
| 场景列 | 无 | `story-pro-scene` |
| 可行性 | 无 | 软门禁 |
| 导出 | `jianying-export` | `jianying-export-pro` |
| 代码隔离 | 冻结 | 独立 spawn / runner / palette |

**同画布可并存**；type 字符串不共用，禁止 migrate 交叉污染。
