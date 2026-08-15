# 首页「发现更多」视频（本地开发占位）

生产与现网 **只走 OSS**，清单见 `src/shared/landing-videos.manifest.json`（`pnpm upload:landing-videos` 上传后生成）。

## 本地开发

可将 16:9 的 `.mp4` 放在此目录作占位；服务端会扫描并生成列表（仅元数据，不预读文件内容）。**勿提交进 Git**（根 `.gitignore` 已忽略 `public/video/*.mp4`）。

## 性能说明

- 首页 **不会** 在打开时批量下载所有 mp4
- 首批展示 12 条，其余点「加载更多」
- 卡片进入视口后才挂载 `<video>`，**悬停** 才开始拉流
- 弹窗播放时才完整加载所选视频

## 优先级（`landing-showcase.server.ts`）

1. OSS manifest（现网默认）
2. 本地 `public/video/*.mp4`（仅 dev）
3. 内置 mock 数据
