# 专业拉片 · 产品需求

- **创建日期**：2026-08-31
- **入口**：`/ecom/film-pull`（电商工具箱 · 电商菜单）
- **Canvas**：快捷预设「视频拉片」→ 导入 Script Hub 制作包
- **toolKey**：`ecom-toolkit__film-pull`
- **关联**：[`solution.md`](./solution.md)、[`table-format.md`](./table-format.md)、[`skill.md`](./skill.md)

## 1. 定位

面向有镜头语言需求的创作者：**工业化逐镜拉片 → 审校 → 换角渲染脚本 → 逐镜 R2V → 合成成片**。

与 **拆图拆视频**（`/ecom/media-decompose`）分工：

| | 拆图拆视频 | 专业拉片 |
|--|-----------|----------|
| 用户 | 电商小白 | 专业/进阶 |
| 时长 | 短视频 | **V1 ≤60s**（>60s 分段预留） |
| Schema | 15 列 `media-decompose` | 20+ 维 `film-pull` |
| 布局 | 单页工作区 | **全屏上下分屏**（上过程/编辑/成片，下会话+上传） |
| 成片 | 可选进种草 | **逐镜 R2V + MediaRender 合成** |

**不含 QuickReplica**。

## 2. 布局

FilmPullStudio（见 `e-commerce-toolkit/design/LAYOUT.md` §FilmPullStudio）：

- **上**：横向 Stepper（拉片 → 审校 → 换角 → 成片）+ Tab（分镜表 / 成片预览）
- **下**：Dock（视频条 + 助手 + 模型 + 主操作）

## 3. M1 验收

1. 上传 ≤60s 视频 → 开始拉片 → 结构化分镜表
2. 表内编辑镜字段 → PATCH 保存
3. 导出 JSON / ZIP
4. >60s 明确错误（分段即将支持）

## 4. M2 验收

1. 上传 1～3 张角色参考图
2. 生成渲染脚本（镜数/时长不变）
3. 单镜 / 批量 R2V
4. MediaRender 合成整条成片 → 预览

## 5. Canvas 验收

1. 预设「视频拉片」spawn 视频+文本节点
2. 上传 → analyze → 导入 Script Hub → `productionScript.shots` 可见

## 6. 非目标（V1）

- >60s 分段 merge 执行
- QuickReplica 入口
- 独立部署 / 新端口
