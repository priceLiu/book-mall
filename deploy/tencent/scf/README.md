# 腾讯云 SCF：story KIE 定时 poll / cleanup

## Zip 包（直接上传）

| 文件 | 云函数名建议 | 定时规则 |
|------|-------------|---------|
| `book-mall-story-kie-poll.zip` | `book-mall-story-kie-poll` | 每 1 分钟（或 30 秒，若触发器支持） |
| `book-mall-story-kie-cleanup.zip` | `book-mall-story-kie-cleanup` | 每 1 分钟 |

## 控制台配置

1. **运行环境**：Node.js 18（或 16+）
2. **执行方法**：`index.main`
3. **环境变量**（必填）：
   - `STORY_AI_POLL_TOKEN` = 与 book-mall 控制台相同
   - （可选）`BOOK_MALL_HOST` = `book.ai-code8.com`（默认已是此值）
4. **超时时间**：60 秒
5. **上传方式**：本地上传 zip → 选对应 zip 文件

## 验收

云函数「测试」或等定时触发后，日志应出现 `"ok": true, "status": 200`。
