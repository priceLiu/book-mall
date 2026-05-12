# `components/ui` 与 Tailwind（shadcn 风格）

`tool-web` 主体布局仍使用 **`app/globals.css`** 中的 `.tool-root` / `--tool-*` 变量。为接入 **shadcn 风格**的复合组件（如 `Button`、`Badge`、区块 Hero），在 **不启用 Tailwind Preflight** 的前提下叠加 **`@tailwind utilities`**，避免覆盖工作台全局排版。

## 默认路径

| 用途 | 路径 |
|------|------|
| 可复用 UI 基元（Button、Badge…） | **`tool-web/components/ui/`** |
| `cn()` 合并类名 | **`tool-web/lib/utils.ts`** |

约定：**第三方粘贴的 shadcn 片段默认放进 `components/ui/`**，并用 **`@/components/ui/…`** 引用，便于与 `ToolShell` 等非 Tailwind 区域共存。

## 配置文件

- **`tailwind.config.ts`**：`content` 指向 `./app/**`、`./components/**`；**`corePlugins.preflight: false`**。
- **`postcss.config.mjs`**：`tailwindcss` + `autoprefixer`。
- **`app/globals.css` 末尾**：`@tailwind utilities;`

主题色在 `tailwind.config.ts` 的 `theme.extend.colors` 中与工作台 zinc 系对齐（`muted`、`primary` 等），供 `text-muted-foreground`、`bg-primary` 等 utilities 使用。

## 新增依赖（参见 `package.json`）

- `tailwindcss`、`postcss`、`autoprefixer`（dev）
- `clsx`、`tailwind-merge`、`class-variance-authority`
- `@radix-ui/react-slot`（`Button` 的 `asChild`）
- `lucide-react`（图标）

本地安装：`cd tool-web && pnpm install`

## 文生图 Hero

- **`components/ui/hero-with-group-of-images-text-and-two-buttons.tsx`**：导出 **`Hero`**（别名 **`TextToImageHero`**），右侧为三张 **Unsplash** 图（已在 **`next.config.mjs`** 的 `images.remotePatterns` 中允许 **`images.unsplash.com`**）。
- **`components/ui/hero-with-group-of-images-text-and-two-buttons-demo.tsx`**：孤立预览用 **`HeroDemo`**，可按需在 Storybook 或临时路由中使用。
- **`app/text-to-image/page.tsx`**：页面上方为 **`Hero`**，锚点 **`#text-to-image-panel`** 滚动至下方表单区。

## 为何要有 `/components/ui`

与主流 **shadcn/ui** 约定一致：**原子组件集中存放**，便于统一 Tailwind 类、`cn()`、`variant`（cva），并避免与业务组件混在同一目录难以检索。若仅散落在 `components/` 根目录，后续扩展 Tabs、Card、Dialog 时易产生重复样式与不一致的交互细节。
