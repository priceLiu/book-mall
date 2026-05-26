# 参考生视频 · 画布工作流

> 与 [story-workflow-canonical.md](./story-workflow-canonical.md) **无耦合**；独立第 3 条工具条。

设计规范：[design.md](./design.md) · 操作索引：[story-ops.md](./story-ops.md)

---

## 1. 需求摘要

| 节点 | 说明 |
|------|------|
| 四宫格 / 六宫格 / 九宫格 | 仅图片；点击 / 拖拽 / 粘贴入格；同格覆盖保留最新 |
| AI 视频引擎 | 选模型、填提示词与参数，读取上游宫格参考图 |
| 视频生成 | 只读展示引擎输出视频 |

**连线**：`宫格 → AI 视频引擎 → 视频生成`；宫格不可互连、不可直连视频生成。

---

## 2. 模型能力核查

| modelKey | Provider | 多图 | maxRef | 参数 |
|----------|----------|------|--------|------|
| `happyhorse-1.0-r2v` | 百炼 DashScope | 是 | 9 | ratio, 720P/1080P, duration 3–15, seed |
| `wan2.6-r2v` | 百炼 DashScope | 是 | 9 | 同上 + prompt_extend |
| `wan2.7-r2v` | 百炼 DashScope | 是 | 9 | 同上 + prompt_extend |
| `bytedance/seedance-2` | KIE | 是 | 8 | aspect_ratio, 720p/1080p, duration |

API 参考：[`tool-web/doc/chanaosheng.md`](../../tool-web/doc/chanaosheng.md)、[`story-web/docs/kie/seedance-2.md`](../../story-web/docs/kie/seedance-2.md)

---

## 3. 执行计划

- [x] 计划文档（本文）
- [x] 类型 + 第 3 工具条 + 节点 UI（`canvas-web`）
- [x] 连线校验（`ref-video-edges.ts`）
- [x] book-mall 三模型运行管线 + DashScope 轮询
- [ ] QA 与结果反馈

**首期模型（全部 P0）**：`happyhorse-1.0-r2v`、`wan2.6-r2v`、`wan2.7-r2v`（百炼 R2V）、`bytedance/seedance-2`（KIE）。

---

## 4. 进度日志

| 日期 | 内容 |
|------|------|
| 2026-05-26 | 计划确认；实施：5 节点 + 三模型（百炼 R2V ×3 + KIE Seedance） |

---

## 5. 结果反馈

（实施后填写 QA 用例与已知限制）
