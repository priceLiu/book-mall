# Story-Pro 资产扩展 + 剧本创作助手 · Rollout

> 2026-05 · canvas-web + book-mall

## 目标

1. **项目资产四类**：角色视觉 / 角色音频 / 场景·道具 / 全局风格；支持**单槽入库**与**整包/全局入库**。
2. **剧本创作助手**：画布左侧 DeepSeek 流式对话；无剧本默认展开，有剧本折叠；**定稿前**持久化历史，**定稿后**可聊但不持久化。

## 文案色阶（已定稿）

见 `canvas-web/docs/design.md` §8 · `.cursor/rules/canvas-story-typography.mdc`

---

## 任务拆分

| ID | 任务 | 状态 |
|----|------|------|
| T1 | Prisma：`StoryProStyleProfile` / `StoryProCharacterAudioAsset` / `StoryProScriptAssistantHistory` | done |
| T2 | `story-pro-style-profile-service` + REST API | done |
| T3 | `story-pro-audio-asset-service` + REST API（基础 CRUD） | done |
| T4 | 风格节点「保存到项目资产」+ 项目资产 Style / Audio Tab | done |
| T5 | `canvasGwChatStream` + `script-assistant/chat` SSE | done |
| T6 | `script-assistant/history` GET/PUT/DELETE | done |
| T7 | `ScriptWritingAssistantPanel` + 画布布局 | done |
| T8 | 故事定稿时 `clearScriptAssistantHistory` | done |
| T9 | 指南 `/guides/project-assets` 四类表格 | done |

---

## 6 · 资产入库语义

| 方式 | 说明 |
|------|------|
| **单槽入库** | 角色四槽 / 场景三槽各槽 ↑ 上传或从生成预览入库（已有） |
| **批量裁切** | 三视图入库 → auto-fill 脸/全身/服装（已有） |
| **全局风格入库** | 风格节点一键写入 `StoryProStyleProfile`（锚定词 + 参考图 URL + 下拉选项） |
| **整包锁定** | 项目资产页对角色/场景/风格 profile 整包 `locked`（已有角色/场景，扩展风格） |

---

## 7 · 剧本创作助手

### 布局

- 仅 **Story-Pro 画布**（`hasStoryProPipeline`）显示左侧栏，宽 ~320px，可折叠。
- **默认展开**：starter 无 `uploadedScriptMd` 且无 hub `outlineMd`。
- **默认折叠**：已有剧本来源或 hub 已有内容。

### 持久化

- 表 `StoryProScriptAssistantHistory`：`{ role, content, id, createdAt }[]`
- **定稿前**：每次对话回合后 PUT 全量 messages。
- **定稿瞬间**：DELETE history（`story-pro-script-hub` 点「故事定稿」）。
- **定稿后**：会话仅内存，刷新/关页不保留。

### API

- `POST /api/canvas/story-pro/script-assistant/chat` → plain text stream
- `GET/PUT/DELETE /api/canvas/story-pro/script-assistant/history?projectId=`

### 导入剧本

- 助手消息「复制 / 下载 .md」+ 按钮「导入到启动节点」→ 写 `story-pro-starter.uploadedScriptMd`

---

## 验收

- [ ] 四类资产 Tab 与指南一致
- [ ] 风格一键入库 + 资产页只读预览
- [ ] 无剧本时助手展开；有剧本折叠；定稿前刷新仍见历史
- [ ] 定稿后助手可问，刷新历史为空
- [ ] 错误行悬停见全文
