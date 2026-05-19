# 实施计划：AI 试衣成本模板 v1.0.0

- **需求**：[11-ai-tryon-cost-template-v1.0.md](../product/11-ai-tryon-cost-template-v1.0.md)
- **发布**：[2026-05-19-ai-tryon-cost-template-v1.0.md](../releases/2026-05-19-ai-tryon-cost-template-v1.0.md)

## 进度

| # | 任务 | 状态 |
| --- | --- | --- |
| 1 | `ToolModelUsageCounter` + 迁移 `20260519140000` | 完成 |
| 2 | `ModelCatalog` 四模型 `20260519120000` | 完成 |
| 3 | `lib/pricing/ai-tryon-cost.ts` 阶梯 + 模板键 | 完成 |
| 4 | `resolveBillableSnapshot` refiner 选档 + `userId` | 完成 |
| 5 | `recordToolUsage` 累计递增 | 完成 |
| 6 | `EXPECTATIONS` / `inspect` 扩展 | 完成 |
| 7 | 公示页 `#ai-tryon` 小节 | 完成 |
| 8 | 试衣间 / AI 试衣「价格说明」链接 | 完成 |
| 9 | catalog C 四模型 | 完成 |
| 10 | 删除工具站 `/app-history/price-list` + API | 完成 |
| 11 | 公示页权限（`from=account` / ADMIN） | 完成 |
| 12 | 部署脚本（见下） | **待你执行** |

## 部署命令（在 `book-mall` 目录）

```bash
pnpm db:deploy
pnpm exec prisma generate
pnpm pricing:realign-from-md          # dry-run 看 diff
pnpm pricing:realign-from-md:apply    # 写齐 D 表
pnpm pricing:inspect-billable-vs-md   # 应 ✅ 全部对齐
pnpm exec tsc --noEmit
```

`tool-web` 无需迁移；确认 `MAIN_SITE_ORIGIN` 指向主站后本地验证试衣间链接。

## 验收

- [ ] `/pricing-disclosure#ai-tryon` 见 4 模型（refiner 7 行）
- [ ] 试衣成片 aitryon 仍 40 点/张
- [ ] refiner 跨月/跨档扣点与 cloudRow 可审计（需用 `modelId: aitryon-refiner` 上报）
