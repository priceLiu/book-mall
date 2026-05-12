# 阿里云 OSS（试衣 Data URL 中转）

试衣接口会将前端传来的 **Data URL** 上传到 OSS，生成 **公网 HTTPS URL** 后再调用百炼 `aitryon`。Bucket 需允许百炼服务端下载对象（常见做法：公共读或对应 Bucket 策略）。

## 环境变量（`tool-web/.env.local`）

| 变量 | 必填 | 说明 |
|------|------|------|
| `OSS_ACCESS_KEY_ID` | 是 | RAM 用户 AccessKey ID |
| `OSS_ACCESS_KEY_SECRET` | 是 | RAM 用户 AccessKey Secret |
| `OSS_BUCKET` | 是 | Bucket 名称，与控制台一致 |
| `OSS_REGION` | 否 | 默认 `oss-cn-guangzhou`，须与 Bucket 地域一致 |
| `OSS_ENDPOINT` | 否 | 不设则由 SDK 按 `OSS_REGION` 推导公网 HTTPS Endpoint |
| `OSS_PUBLIC_URL_BASE` | 否 | 自定义访问根 URL（无末尾 `/`），用于 CDN 或固定域名 |

代码侧使用 **V4 签名**（`authorizationV4: true`），与官方 Node SDK 初始化说明一致。

## Next.js 图片域名

若页面使用 `next/image` 加载 OSS 对象 URL，须在 `next.config.mjs` 的 `images.remotePatterns` 中加入 Bucket 的虚拟域名，例如：

`https://tool-mall.oss-cn-guangzhou.aliyuncs.com/**`

Bucket 名变更时，请同步修改 `OSS_BUCKET` 与 `remotePatterns` 中的 `hostname`。

## 上传路径

- 输入侧（交给百炼前）：`ai-fit/tryon/<uuid>.<jpg|png|webp>`
- **成片持久化**（百炼返回的短期 URL 拉回后写入自有 Bucket）：`ai-fit/result/<uuid>.<jpg|png|webp>` —— 衣柜保存与历史打点中的 `resultImageUrl` 应优先使用该稳定 HTTPS。

## 自动中转（解决 TLS 过期 / 私网图等百炼无法直拉的情况）

`POST /api/ai-fit/try-on` 在交给百炼前会判断每张图：

- **`data:` URL** → 解码上传到 OSS
- **`http://` URL** 或 **命中已知坏证书主机**（如 `static-main.aiyeshi.cn`）→ 服务端下载（仅对该坏证书主机放宽 TLS 校验）→ 上传到 OSS
- 其他 `https://` URL → 原样传给百炼

需要中转的图同样依赖 `OSS_*` 环境变量；下载上限 ~15MB。

## 报错：`must be addressed using the specified endpoint`

说明当前请求的 **endpoint 与 Bucket 实际所在地域不一致**。处理方式：

1. 打开 OSS 控制台 → 选中该 Bucket → 查看 **地域**（Region ID，如 `oss-cn-beijing`、`oss-cn-guangzhou`）。
2. 把 `.env.local` 里的 **`OSS_REGION`** 改成与控制台 **完全一致**。
3. **删掉或注释 `OSS_ENDPOINT`**，由 SDK 根据 `OSS_REGION` 自动生成正确的公网 HTTPS endpoint（代码里已设置 `secure: true`）。
4. 若必须使用自定义 `OSS_ENDPOINT`，请填写 **该地域** 对应的公网 Endpoint（与控制台「Bucket 域名」里的地域相同），不要跨地域混用。

虚拟域名形如：`https://{bucket}.{region}.aliyuncs.com/...`，其中 `{region}` 须与 `OSS_REGION` 相同。
