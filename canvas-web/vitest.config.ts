import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * canvas-web 轻量单测（Gen-HotCold-R2 Phase 4 引入）。
 *
 * 仅运行**纯函数**单测（无 DOM / 无 React 渲染 / 无网络）。
 * 仓库内另有依赖 jsdom + JSX 的组件类单测（mention/dock/drag 等），
 * 它们需要独立的 jsdom + @vitejs/plugin-react 配置，本配置**不纳入**，避免误跑导致 JSX 解析失败。
 * 如需启用组件测试，请新增 environment="jsdom" 且装好 react 插件后单独跑。
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    include: [
      "test/unit/poll-interval.test.ts",
      "test/unit/canvas-panel-data-recovery.test.ts",
      "test/unit/script-studio-parse.test.ts",
      "test/unit/script-studio-column-sync.test.ts",
      "test/unit/script-studio-frozen-bibles.test.ts",
      "test/unit/crew-bulletin-build.test.ts",
      "test/unit/crew-bulletin-script-package.test.ts",
      "test/unit/crew-bulletin-task-prompts.test.ts",
      "test/unit/crew-bulletin-phases.test.ts",
      "test/unit/crew-bulletin-sync.test.ts",
      "test/unit/crew-bulletin-node-submit.test.ts",
      "test/unit/canvas-run-session.test.ts",
      "test/unit/pro2-script-studio-migrate.test.ts",
      "test/unit/project-edition-detect.test.ts",
    ],
    environment: "node",
    globals: false,
  },
});
