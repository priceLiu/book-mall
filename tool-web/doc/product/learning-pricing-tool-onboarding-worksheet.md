# 工具上架 · 定价工作单（模板 + 示例）

> 与 **`learning-pricing-solution.md` §5.6** 配套。
> 目的：上架前 **禁止手填成本**；成本须来自 **`doc/price.md` 中国内地**（经解析快照）或 **未来上传价目表导入**；再按公式得到 **预估零售价（点数）**，最后才写入主站 `ToolBillablePrice` / 工具站 catalog。

---

## 一、统一公式（方案 A · Token 类）

记：

- \(i\) = **输入**单价（**元 / 百万 Token**，中国内地，**首档/选定阶梯**）
- \(o\) = **输出**单价（**元 / 百万 Token**，同上）
- \(e_{in}, e_{out}\) = **等价用量**（**百万 Token**，由产品按单次调用约定）
- \(M\) = **零售系数**（主站 **`ToolBillablePrice`** 上当前 **`toolKey` + 参考模型** 对应行的 **`schemeAAdminRetailMultiplier`**；SSO **`/api/sso/tools/scheme-a-retail-multiplier`** 同源；文档验算可用 \(2.0\)）

则：

1. **成本（元）**：\(\mathrm{cost} = e_{in} \cdot i + e_{out} \cdot o\)
2. **零售（元）**：\(\mathrm{retail} = \mathrm{cost} \cdot M\)
3. **扣费点数**：\(\mathrm{pts} = \max(1, \mathrm{round}(\mathrm{retail} \times 100))\)（**1 点 = 1 分**）

**试衣 / 文生图 / 视频** 等非 Token 表：成本锚来自 **`tools-scheme-a-catalog.json`** 及同文件中与 `price.md` 对齐的口径；仍须在本工作单 **「计算依据」** 中引用 `price.md` 小节或官网说明。

---

## 二、成本导入（当前：price.md）

1. 更新或确认 **`tool-web/doc/price.md`** 与官网中国内地价一致。  
2. 在 **tool-web** 根目录执行：

   ```bash
   pnpm pricing:extract-price-md
   ```

3. 将生成的 **`config/generated/price-md-china-mainland-extract.json`** 与 `price.md` **同一 PR 提交**。记录 **`meta.sourceSha256`**（文件头 `meta` 内）。  
4. 按需查询单模型首档（示例）：

   ```bash
   pnpm pricing:extract-price-md -- --lookup qwen3.6-plus
   ```

5. 将命令输出或 JSON 中对应 **`rows[]` 条目**粘贴到下方「成本导入记录」。

> **注意**：解析器对部分表格会 **`meta.warnings`**；若你的模型落在未解析表中，**不得空格填成本**，应补全解析规则或 **手工抄录 `price.md` 行号 + 原文** 作为依据。

---

## 三、未来：上传价目表导入

占位实现：`tool-web/lib/pricing/price-sheet-import-stub.ts`（`parseUploadedPriceSheetPlaceholder`）。  
落地后流程：**上传 → 解析为 `PriceSheetImportRow[]` → 与工作单合并 → 再写入 catalog / 主站**。旧版 `price.md` 与历史 JSON **仍用 Git 留痕**。

---

## 四、工作单 · 空白模板（每次上新工具复制）

| 字段 | 填写说明 |
|------|-----------|
| **工具名称 / toolKey** | 与主站、Beacon 一致 |
| **计费类型** | Token 方案 A / 按张 / 按秒… |
| **price.md 准则** | 二级/三级标题 + **中国内地** + **源文件行号**（或 extract 中 `sourceLine`） |
| **成本导入来源** | `extract meta.sourceSha256` **或** 上传文件名 + 导入批次 id |
| **选定阶梯** | 如 `0<Token≤256K`；若用非首档须产品签字说明 |
| **\(i\), \(o\)（元/百万Token）** | **仅从导入结果粘贴，禁止手编** |
| **\(e_{in}, e_{out}\)** | 产品约定等价用量 |
| **\(M\)** | 拟写入 **`ToolBillablePrice.schemeAAdminRetailMultiplier`** 的数值 + 计划生效时间（与 §5.4、`learning-pricing-solution.md` 一致） |
| **计算过程** | 三步代入公式（见下一节示例） |
| **预估点数 / ¥** | `pts` 与 `pts/100` |
| **最终入单价** | 写入主站或 catalog 的实际值（须与预估一致或说明偏差原因） |
| **PR / 修订** | 链接或提交 hash |

**成本导入记录（粘贴 JSON 一行或终端输出）：**

```text

```

**计算过程（手写代入）：**

```text

```

**审批：产品 ______  研发 ______  日期 ______**

---

## 五、示例（已填 · 分析室 · Qwen3.6 Plus · 首档）

| 字段 | 值 |
|------|-----|
| 工具名称 / toolKey | 视觉实验室 · 分析室 / `visual-lab__analysis` |
| 计费类型 | Token 方案 A（等价用量） |
| price.md 准则 | `## **文本生成-千问**` → `### **千问Plus**` → `## 中国内地`；**`sourceLine`: 129**（`0<Token≤256K` 行） |
| 成本导入来源 | `pnpm pricing:extract-price-md`；`meta.sourceSha256` 以当前仓库 `config/generated/price-md-china-mainland-extract.json` 为准 |
| 选定阶梯 | `0<Token≤256K` |
| **\(i\), \(o\)** | **2** 元/百万Token（入），**12** 元/百万Token（出） |
| **\(e_{in}, e_{out}\)** | **0.35**，**0.57**（目录默认等价百万 Token） |
| **\(M\)** | **2.0**（工作单验算；生产以该工具 **`ToolBillablePrice`** 对应 **`schemeARefModelKey`** 生效行为准） |

**计算过程：**

1. \(\mathrm{cost} = 0.35 \times 2 + 0.57 \times 12 = 0.7 + 6.84 = 7.54\)（元）  
2. \(\mathrm{retail} = 7.54 \times 2 = 15.08\)（元）  
3. \(\mathrm{pts} = \mathrm{round}(15.08 \times 100) = 1508\) 点（**¥15.08**）

**最终入单价**：运行时由 `visual-lab-analysis-scheme-a-catalog.json` + 主站 \(M\) 计算 **`costPoints`**；主站历史单行已停用，以本工作单与 **catalog PR** 为溯源凭据。

---

*路径：`tool-web/doc/product/learning-pricing-tool-onboarding-worksheet.md`*
