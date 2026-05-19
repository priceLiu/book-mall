# 发布说明：AI 试衣成本计算模板 v1.0.0

| 字段 | 值 |
| --- | --- |
| **版本** | `v1.0.0` |
| **需求文档** | [`doc/product/11-ai-tryon-cost-template-v1.0.md`](../product/11-ai-tryon-cost-template-v1.0.md) |
| **计划发布日期** | _待填_ |
| **实际发布日期** | _待填_ |
| **状态** | 代码已合入；部署后勾选下方清单 |

---

## Summary

- 为阿里云 **AI 试衣** 四模型建立统一的 **成本价计算模板** 体系；对外零售价仍为 **挂牌成本 × M（M=2）**。
- 补齐 `ModelCatalog` 入库；扩展 D 表与 audit 覆盖 `aitryon-parsing-v1`、`aitryon-refiner`（含 7 档阶梯）。
- 试衣间 / AI 试衣页增加链至主站 **价格公示** 的入口。
- **v1.0.1**：删除工具站站内重复价目页，避免双源维护；公示页按入口控制成本/系数/公式可见性。

---

## 部署前检查

- [x] 需求文档 v1.0.0 代码实施（见 `doc/plans/2026-05-19-ai-tryon-cost-template-impl.md`）
- [ ] `pnpm db:deploy`（`20260519120000` + `20260519140000`）
- [ ] `pnpm exec prisma generate`
- [ ] `pnpm pricing:realign-from-md`（dry）→ `pnpm pricing:realign-from-md:apply`
- [ ] `pnpm pricing:inspect-billable-vs-md` → `✅ 全部对齐`
- [ ] `book-mall` + `tool-web` 构建通过

---

## 数据库 / 迁移

| 迁移 | 说明 |
| --- | --- |
| `20260519120000_model_catalog_ai_tryon_models` | `ModelCatalog` + `ModelAlias`：四试衣模型 canonical |

_开发完成后在此追加：D 表新行、累计用量表（若有）等迁移 ID。_

---

## 配置与环境

- 无新增必填环境变量（预期）
- `MAIN_SITE_ORIGIN` / 工具站公示链接依赖既有配置

---

## 功能变更（发布后填写）

### 用户可见

- 试衣间可打开「价格说明」→ 主站公示试衣价目
- 工具站侧栏「费用」下 **已移除「价格表」**；价目统一为主站 `/pricing-disclosure`
- 个人中心打开价目（`?from=account`）不展示云挂牌成本、系数 M、计价公式；管理员从后台/工具站直链可看全量
- _refiner 阶梯扣费上线后补充说明_

### 已删除（勿再引用）

| 路径 | 说明 |
| --- | --- |
| `tool-web/app/app-history/price-list/*` | 原工具站「价格表」页 |
| `tool-web/app/api/tool-billable-prices/route.ts` | 仅供上述页面聚合主站 D 表，已删 |

### 管理后台

- 价目 / 模型目录可见四试衣模型
- _补充_

---

## 回滚

1. 代码回滚至上一 tag
2. 若仅 D 表误写：用迁移前备份或 `pricing-realign` 上一版 `EXPECTATIONS` 重跑
3. `ModelCatalog` 行可保留（无害）；勿删已有 `ToolUsageEvent`

---

## 验证清单（Test plan）

- [ ] `/pricing-disclosure#ai-tryon` 展示四模型；Plus / 基础版单价 = 成本×2
- [ ] 试衣成片：`aitryon` 40 点/张、`aitryon-plus` 100 点/张（M=2）
- [ ] 工具站试衣间链接可打开公示页
- [ ] `/app-history/price-list` 返回 404；侧栏无「价格表」
- [ ] `/pricing-disclosure?from=account` 无成本/系数/公式；管理员直开 `/pricing-disclosure` 可见全量
- [ ] `pnpm pricing:inspect-billable-vs-md` 通过
- [ ] _refiner 阶梯：构造累计量跨档，核对扣点与 cloudRow_
- [ ] _parsing：输入 2 张图，核对 0.004×2×M 点_

---

## 已知限制 / 后续

- 非阿里云厂商模板仅预留扩展点，本版不实现
- Token 类试衣外模型不受影响

---

## 关联 PR / 提交

_发布后填写 commit / PR 链接。_
