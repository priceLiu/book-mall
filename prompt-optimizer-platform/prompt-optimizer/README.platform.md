# 提示词优化器 · 平台版补丁说明

本目录为上游 [linshenkx/prompt-optimizer](https://github.com/linshenkx/prompt-optimizer) 的 **git subtree**（`develop` 分支）。平台接入时对上游的最小补丁如下。

## 平台约束

- **禁止**在浏览器或子应用内填写/存储厂商 API Key
- **禁止**直连 `api.openai.com`、`dashscope` 等厂商域名
- 文本模型调用经 **prompt-optimizer-platform** 同域 BFF：`POST /api/gateway/chat` → Book `/api/sso/tools/gateway/chat` → Gateway BYOK

## 补丁范围

| 路径 | 说明 |
|------|------|
| `packages/core/src/utils/platform-gateway.ts` | `VITE_PLATFORM_GATEWAY` 检测 |
| `packages/core/src/services/llm/adapters/platform-gateway-adapter.ts` | `PlatformGatewayAdapter` |
| `packages/core/src/services/llm/adapters/registry.ts` | 注册 platform-gateway |
| `packages/core/src/services/model/defaults.ts` | 平台模式默认启用 Gateway 模型 |
| `packages/ui/src/utils/platform-gateway.ts` | UI 平台模式 + Gateway 链接 |
| `packages/ui/src/components/ModelManager.vue` | 隐藏添加模型、展示 Gateway 引导 |
| `packages/ui/src/composables/model/useTextModelManager.ts` | 隐藏 apiKey/baseURL 字段 |

## 构建（平台壳）

```bash
# 在 prompt-optimizer-platform/prompt-optimizer 目录
cd prompt-optimizer-platform/prompt-optimizer
echo "VITE_PLATFORM_GATEWAY=1" >> .env.local
echo "VITE_GATEWAY_WEB_ORIGIN=http://localhost:3005" >> .env.local
pnpm install
VITE_PLATFORM_GATEWAY=1 VITE_GATEWAY_WEB_ORIGIN=http://localhost:3005 pnpm build:web

# 拷贝 dist 到 platform public/（集成后删除 platform app/page.tsx 以启用 SPA 路由）
rsync -a packages/web/dist/ ./public/

cd ..
pnpm --dir prompt-optimizer-platform install
pnpm build
```

## 许可证

上游 **AGPL-3.0**。对外提供网络服务须满足源码公开义务；见 `book-mall/doc/product/prompt-optimizer-platform.md`。

## 同步上游

```bash
git subtree pull --prefix=prompt-optimizer-platform/prompt-optimizer \
  https://github.com/linshenkx/prompt-optimizer.git develop --squash
```

合并后请重新应用/检查上述补丁文件。
