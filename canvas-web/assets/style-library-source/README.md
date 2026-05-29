# 风格库预览图源文件

将每张预览图命名为 **`{presetId}.webp`**（与 `lib/canvas/style-library/catalog.ts` 中的 `id` 一致），放在本目录。

支持扩展名：`.webp`、`.jpg`、`.jpeg`、`.png`

一键同步（从 `docs/style.html` 下载预览图并上传 OSS，需 `book-mall/.env.local`）：

```bash
cd book-mall && pnpm canvas:sync-style-library
```

仅上传本地已有文件：

```bash
cd book-mall && pnpm canvas:upload-style-library
```

脚本会写入 OSS key `canvas/style-library/{id}.webp` 并回写 `catalog.ts` 的 `imageUrl`。
