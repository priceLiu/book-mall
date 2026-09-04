# 电商 LLM · JSON 结构化交付总则

> **适用范围**：book-mall 电商域、电商工具箱（e-commerce-toolkit）内 **所有** 与大模型交互并需落库/渲染的结构化产出。  
> **新短视频动作类模板**：[`video-workflow-template-spec.md`](./video-workflow-template-spec.md)  
> **Cursor Rule**：[`.cursor/rules/ecom-video-workflow-json.mdc`](../../../.cursor/rules/ecom-video-workflow-json.mdc)

---

## 1. 硬性原则

1. **系统只解析约定 JSON**（围栏内或 API 信封）；Markdown 表格/列表 **不得** 承载结构化真源。
2. **一工作流一围栏名**（或统一信封 + `templateId`）；禁止用通用 `` ```json `` 代替。
3. **zod 校验** 为合并前必经步骤；解析失败须明确 `parseError`，禁止静默吞掉。
4. **字段名稳定**：已发布字段禁止随意改名；扩展用 optional 新键或新 `templateId`。
5. **长文入 JSON** 用 `\n` 换行；禁止 JSON 内注释。

---

## 2. 现有围栏注册表

| 围栏 / 信封 | 文档 | 模块 |
|-------------|------|------|
| `` ```media-decompose `` | [`拆图拆视频/table-format.md`](../拆图拆视频/table-format.md) | 拆图拆视频 |
| `` ```seed-video `` | 种草视频 implementation | 图片生种草视频 |
| `` ```film-pull `` | 拉片 requirements | 专业拉片 |
| `` ```fashion-deliverable `` | [`fashion-deliverable-spec-v4.md`](./fashion-deliverable-spec-v4.md) | 服装口播故事版 |
| `` ```pro-deliverable `` / fashion-v4 | [`pro-deliverable-spec-v1.md`](./pro-deliverable-spec-v1.md) | Pro Vertical |
| **`ecom-video-workflow/v1` 信封** | [`video-workflow-template-spec.md`](./video-workflow-template-spec.md) | 穿搭视频及后续动作迁移模板 |

---

## 3. 新建/升级 checklist

- [ ] 在 **产品/技术 spec** 中登记 schemaVersion、围栏名或信封、必填字段表
- [ ] `book-mall/lib/ecom/*-structured.ts` 或 `video-workflow/templates/*` 实现 zod + extract
- [ ] 客户端镜像（e-commerce-toolkit 对应 lib）
- [ ] unit test：合法样例 + 非法样例 + 流式 incomplete 围栏
- [ ] 助手 system prompt 引用 spec 段落，禁止口头约定字段
- [ ] 管理后台待处理台账（`docs/*.md`）若为大功能

---

## 4. 禁止

- 用「友好 Markdown 分镜表」代替 JSON 交付
- 在 UI 层 regex 刮 JSON 而不走统一 parser
- 未注册 `templateId` 即上线新短视频工作流
- 将厂商 Key 写入 `.env` 绕过 Gateway（见 `gateway-platform-vendor-credentials.mdc`）

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-09-04 | 初版：汇总现有围栏 + 指向 video-workflow 新入口 |
