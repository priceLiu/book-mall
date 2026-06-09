import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Vite 原生 tsconfig paths 解析（@/* → 项目根），替代已废弃的插件。
    tsconfigPaths: true,
  },
  test: {
    // 默认只跑纯函数单测（无 DB / 无网络），集成测试单独用 tsx 脚本跑。
    include: ["test/unit/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});
