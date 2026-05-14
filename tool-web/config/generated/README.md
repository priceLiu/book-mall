# 中国内地价目快照（由脚本生成）

本目录下的 `price-md-china-mainland-extract.json` 由 **`pnpm pricing:extract-price-md`** 根据  
`doc/price.md` 中 **「## 中国内地」** 且表头含 **「元/百万 Token」** 的表格解析生成。

## 何时更新

- 合并/修改 **`doc/price.md`** 后，在 **tool-web** 根目录执行一次 `pnpm pricing:extract-price-md`，将新 JSON **随 PR 一并提交**。
- JSON 内 **`meta.sourceSha256`** 与 **`meta.generatedAt`** 用于与具体 `price.md` 版本对齐、留痕。

## 限制（必读）

- 解析器为 **受控启发式**：只覆盖上述表结构；解析日志中的 **`meta.warnings`** 须人工核对；无法映射的表仍依赖 **手工对照 `price.md`**。
- **在线扣费**仍以 `config/*-scheme-a-catalog.json` 等为准；本快照用于 **上架工作单成本引用、稽核对齐**，见 `doc/product/learning-pricing-solution.md` §10。
