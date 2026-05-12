# 试衣间与 AI 试衣 — 需求、问题与实现说明

本文记录工具站内 **试衣间（`/fitting-room`）** 与 **AI 试衣（`/fitting-room/ai-fit`）** 的串联能力：产品需求、开发中遇到的问题、当前技术方案与后续可改进点。

---

## 1. 功能与需求

### 1.1 试衣间（列表 + 详情）

- 展示套装列表；点击条目打开详情弹层。
- 弹层内支持多图轮播（`split_images`）、分页指示、品类文案（如上装/下装）。
- **购买**：若有 `amazon_url`（等业务字段），在新标签页打开外链。
- **试穿**：关闭弹层并跳转至 AI 试衣页，且必须带上当前套装的 **`id`**（查询参数），以便下游页自动回填。

### 1.2 AI 试衣（工作台）

- 用户选择 **试穿服装** 模式：**上下装（Top & bottom）** 或 **单件连体（One-piece）**。
- 上传或使用示例图作为服装输入；选择模特后 **开始试衣**，走既有异步任务与轮询接口。
- **从试衣间跳入时的额外需求**：
  1. 读取 URL 中的 **`id`**，在本地套装数据中解析对应条目。
  2. 按 **`type`** 预选模式：`1` → 单件连体；`2` → 上下装。
  3. 使用 **`split_images[].url`** 回填预览区；提交试衣时把这些 **原始 HTTPS URL** 作为服装图传给后端（与手写上传、示例 URL 路径一致）。
  4. 模特仍由用户自己选择；用户确认后再点 **开始试衣**，后续流程与直接从 AI 试衣进入相同。

### 1.3 关联能力（同期迭代）

- **我的衣柜**：试衣结果满足条件时可保存；列表页 `/fitting-room/ai-fit/closet`。
- 试衣间图片来自 **`static-main.aiyeshi.cn`** 等外链时，开发环境通过 **`/api/fit-image`** 同源代理规避证书等问题（见 `lib/fitting-room-image-url.ts`）。

---

## 2. 数据约定（Mock / 后续可接 API）

套装类型定义见 `lib/fitting-room-types.ts`，列表数据当前来自 `mock/data.json`，经 `lib/fitting-room-data.ts` 导出为 **`OUTFITS`**。

| 字段 | 含义 |
|------|------|
| `id` | 套装唯一标识；试衣间跳转与 AI 试衣预填均依赖此字段。 |
| `type` | `1`：一件（连体逻辑）；`2`：两件（上下装）。 |
| `url` | 套装主图（备用）。 |
| `split_images` | 多条切片：`type`（如 `top` / `bottom`）、`url`、`amazon_url` 等。 |

**预填规则**（实现于 `lib/ai-fit-prefill-from-outfit.ts`）：

- **`type === 1`**：`garmentMode = one_piece`，取 `split_images` 中第一条有效 `url`，否则回退 `outfit.url`。
- **`type === 2`**：`garmentMode = two_piece`，优先按 `split_images[].type === 'top'|'bottom'` 取 URL；下装可回退到「第二条带 URL 的切片」。

---

## 3. 遇到的问题与处理

### 3.1 本地「提交不了 Git」或 **推送被 GitHub 拒绝**

仓库侧常见原因（单人开发时也遇到过）：

- **没有变更**：`git status` 显示 `nothing to commit` — 说明改动已提交，只需 **`git push`** 同步远端。
- **未暂存**：需要先 **`git add`** 再 **`git commit`**。
- **Hook 失败**：若配置了 `pre-commit`（lint/test），修复报错或跳过钩子（团队规范允许时）后再提交。
- **GPG/签名**：若启用 `commit.gpgSign` 而密钥不可用，会导致提交失败。
- **与远端分叉**：先 **`git pull --rebase origin main`**（或当前分支名）再推送。
- **误提交密钥**：若曾把 **`tool-web/.env.local`** 等文件放进 Git，GitHub **Push protection** 会拒绝推送并要求从历史中移除。处理方式：**永远不要提交 `.env.local`**（仓库根目录 `.gitignore` 已忽略 `tool-web/.env.local`）；若历史上已有提交包含密钥，需用 **`git filter-branch`** / **`git filter-repo`** 等从历史剔除该文件并改写后再推送；密钥若在别处暴露过，应在阿里云控制台 **轮换 AccessKey**。

当前实现相关提交已在本地历史中（例如试衣间首版与「试穿跳转 AI 试衣」等）；若你本地仍失败，把终端完整报错贴出便于对症处理。

### 3.2 试衣间 UI：背景黑线

已知问题：弹层或页面背景衔接处仍有 **一条黑线**，当前提交说明中已标注「未解决」。需在浏览器开发者工具中核对是否为 `border`、`box-shadow`、`transform` 亚像素或 `backdrop` 叠加导致，再针对性改 CSS。

### 3.3 TypeScript：文案键缺失

AI 试衣结果区使用了 **`saveClosetFailed`**，曾一度未写入 `messages/zh.ts` / `en.ts`，导致 **`t()` 参数类型报错**。已在双语文案中补齐该键。

### 3.4 Next.js App Router：`useSearchParams`

在客户端使用 **`useSearchParams`** 时，页面侧应用 **`Suspense`** 包裹对应子树，避免构建/运行时边界问题。AI 试衣入口页对 **`AiFitClient`** 做了 **`Suspense`** 包裹。

### 3.5 图片预览 vs 试衣提交 URL

- **预览**：`<img>` 使用 **`fittingRoomImageSrc`**（经 **`imgSrc` 辅助函数**），对允许的 CDN 域名走 **`/api/fit-image`**，便于本地展示。
- **状态与 POST**：仍保存 **原始远程 URL**（字符串），试衣请求体与后端解析逻辑保持一致；**Data URL** 仍走原有上传通知路径。

---

## 4. 实施方案（代码入口）

| 环节 | 文件 / 说明 |
|------|-------------|
| 试衣间弹层「试穿」导航 | `app/fitting-room/fitting-room-modal.tsx`：`router.push('/fitting-room/ai-fit?id=' + encodeURIComponent(outfit.id))`，并 `onClose()`。 |
| 套装预填 | `app/fitting-room/ai-fit/ai-fit-client.tsx`：`useSearchParams` 读 `id`，`OUTFITS.find`，调用 `prefillGarmentsFromOutfit`。 |
| 预填纯函数 | `lib/ai-fit-prefill-from-outfit.ts`。 |
| 套装数据源 | `lib/fitting-room-data.ts` ← `mock/data.json`。 |
| AI 试衣页 Suspense | `app/fitting-room/ai-fit/page.tsx`。 |
| 外链图代理 | `lib/fitting-room-image-url.ts`、`app/api/fit-image/route.ts`。 |
| 试衣 API | `POST /api/ai-fit/try-on` 及轮询（现有逻辑未改）。 |

**URL 清理**：预填成功后使用 **`router.replace('/fitting-room/ai-fit', { scroll: false })`** 去掉 **`?id=`**，避免刷新重复执行；使用 **`useRef`** 记录最近一次应用的 `id`，减轻 Strict Mode 下 effect 重复触发的影响。

**未知 id**：提示 **`fittingRoomOutfitNotFound`**（中英文文案），并 **`replace`** 回无查询参数的 AI 试衣页。

---

## 5. 后续可做

- 将 **`OUTFITS`** 从 Mock 换为服务端接口，预填逻辑改为 `fetch` + 缓存；查询参数可扩展为 `outfitId` 等与后端一致命名。
- 修复试衣间 **背景黑线**。
- 若产品需要保留可分享的深链，可取消预填后的 **`replace`**，或改为仅用 `history.replaceState` 更新地址栏（需评估与 SEO、刷新行为的一致性）。

---

## 6. 相关文档

- [工具站文档索引](../README.md)
- [产品概述](./overview.md)
- 阿里云 OSS / 试衣图片：`../aliyun-oss.md`
- API 约定：`../api.md`
