# 功能逻辑文档（logic）

本目录存放 **实现向** 的细化说明：状态机、扣款顺序、并发、幂等、与产品 PRD 的对应段落等。  
**产品规则的唯一准绳** 仍是 `doc/product/`；此处 **不重复** 全文 PRD，只写 **易错与实现契约**。

## 已有 / 建议文档

| 文件 | 说明 |
|------|------|
| [wallet-balance-and-refund.md](./wallet-balance-and-refund.md) | 余额、最低线、应扣未扣、提现结算顺序（对齐产品二册） |
| [membership-flags.md](./membership-flags.md) | `getMembershipFlags` 与前台「高级会员状态」 |
| [admin-access.md](./admin-access.md) | 管理后台路径、角色、`ADMIN_EMAILS` |
| [admin-billing-and-refunds.md](./admin-billing-and-refunds.md) | 5.3 / 6.3 计费配置、订单与提现审核 |

新增逻辑文档时：**文件名小写 + 短横线**；在本文 README 表格中增一行。
