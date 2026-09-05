# 姿势库 V2 · 产品需求（图 + 文 + 入库 + 生成）

- **创建日期**：2026-09-04
- **更新**：2026-09-04
- **管理入口**：Book `/admin/templates?tab=ecom`（姿势库 Tab）、`/admin/tool-libraries`（成图入库）
- **用户入口**：`/ecom/shoot-catalog`（姿势 Tab）、`/ecom/model-shot`（选姿势 / 出图）
- **关联**：[requirements.md](./requirements.md)、[solution.md](./solution.md)、[pose-matching-rules.md](./pose-matching-rules.md)

## 1. 产品定位与 V1 差异

V1 姿势库为 **纯文字**（`category` / `title` / `baseDescription`），供 `pose-picker` 自动编排与 Prompt 拼装。

V2 目标：姿势库条目 = **参考图（可选）+ 姿势提示词（可选）**。

| 能力 | V1 | V2 |
|------|----|----|
| 参考图 | 无 | `ossUrl` + 可选 `thumbUrl` |
| 入库 | 管理员手填文字 / seed JSON | 管理员从成图一键入库（可选是否存 prompt） |
| 补图 | 无 | 管理员工作室：模特 + 服装 + 提示词 → 批量生成姿势参考图 |
| 消费 | 仅文字拼 Prompt | 有图时 **优先把姿势图作 IMAGE 参考** |
| 权限 | 系统库 admin 维护 | 生成/入库能力 **仅管理员**；用户只读选用 |

## 2. 数据模型

### EcomPoseLibraryEntry 扩展

| 字段 | 类型 | 说明 |
|------|------|------|
| `ossUrl` | String? | 姿势参考图（平台 OSS） |
| `thumbUrl` | String? | 列表缩略图 |
| `sourceImageKey` | String? | 去重键（源 URL 归一化或 content hash） |
| `baseDescription` | Text | 姿势 Prompt；入库时用户可选不存 |
| `tags` | Json? | `fullPrompt`、`sourceModule`、`generatedFrom` 等 |

OSS 路径：`ecom/pose-library/{id}.webp`（见 `buildEcomPoseLibraryOssKey`）。

## 3. 功能 A · 管理员成图入库

**入口（MVP）**：`/admin/tool-libraries` 图片 Tab，卡片右上角「保存到姿势库」。

**交互**：

1. 弹窗：「是否同时存入姿势提示词？」
   - **是**：预填可编辑 prompt → 写入 `baseDescription`（提取姿势段）+ `tags.fullPrompt`（完整原文）
   - **否**：仅保存图片，`baseDescription` 为空
2. 可选分类 A–M（默认 A）
3. 系统自动生成 `title`（有 prompt 取摘要 + 日期序号；无 prompt 为「姿势参考 ·{序号}」）

**去重**：同一 `sourceImageKey` 不允许重复入库 → HTTP 409，提示已有条目 title/id。

**范围**：仅写入 `scope=platform` 系统库。

## 4. 功能 B · 管理员姿势参考图生成（仅管理员）

**入口**：`/admin/templates?tab=ecom` → 姿势库 Tab →「生成姿势参考图」。

**表单**：

- 姿势：单选或多选（可批量补无图条目）
- 模特：模特库 picker（必选）
- 服装：上传 / URL（可选）
- 场景：默认浅灰摄影棚，可选手写
- IMAGE 模型：Gateway 登记模型

**出图**：`refImageUrls = [garment?, model]`（**不含**旧 pose 图）；回写 `ossUrl`；`tags.generatedFrom = pose-studio`。

## 5. 功能 C · 用户选姿势 / model-shot 出图

- **展示**：catalog / picker 同时展示缩略图 + title + baseDescription
- **排序**：`pose-picker` 候选池 **有 ossUrl 优先**
- **出图 ref 顺序**：garment → model → scene → **poseRef**（若 catalog 有图）
- **Prompt 约束**（有 poseRef 时）：严格参考姿势参考图姿态，不改变服装与模特身份
- **ref 上限**：超出模型上限时优先保留 garment + model + poseRef，场景降为纯文字

## 6. API 清单

| 方法 | 路径 | 权限 |
|------|------|------|
| POST | `/api/admin/ecom/pose-library/import-from-image` | Finance Admin |
| POST | `/api/admin/ecom/pose-library/generate-preview` | Finance Admin |
| GET | `/api/sso/tools/ecom/pose-library/catalog` | 工具 SSO（含 ossUrl） |

## 7. 验收标准

- [ ] PL-001 Schema 迁移落库，`catalog` API 返回 `ossUrl`
- [ ] PL-002 成图入库：存 prompt / 仅图 两分支；409 去重提示
- [ ] PL-003 工具资源库 UI 弹窗可用
- [ ] PL-004/005 管理员批量生成姿势参考图（模特+服装）
- [ ] PL-006 shoot-catalog / admin 图+文网格
- [ ] PL-007 model-shot 出图含 poseRef
- [ ] PL-008 pose-picker 有图优先；姿势 picker 图+文
- [ ] PL-009 单测：import/dedup/ref 顺序

## 8. 实施分期（管理后台待办 PL-001～PL-010）

| ID | 标题 |
|----|------|
| PL-001 | Schema 与类型 |
| PL-002 | 成图入库 API |
| PL-003 | 工具资源库入库 UI |
| PL-004 | 姿势图生成 API |
| PL-005 | 姿势图生成 UI |
| PL-006 | 图+文 catalog UI |
| PL-007 | model-shot 姿势 ref |
| PL-008 | 有图优先排序 |
| PL-009 | 单测与回归 |
| PL-010 | 各应用 admin 保存钮（可选收尾） |

## 9. 非范围

- 用户侧「生成姿势参考图」
- outfit-video 姿势库 picker 完整对接（后续单开）
- 独立第四张「提示词片段库」表
