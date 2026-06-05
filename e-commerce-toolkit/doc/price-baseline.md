---
version: "2026-06-04"
name: e-commerce-toolkit-pricing
currency: CNY
region: 中国内地
retailMultiplier: 2
pointPerYuan: 100
parentBaseline: tool-web/doc/price_0518.md
---

# 电商工具箱 · 挂牌价基线（B 层）

> 我方扣点 = **挂牌价 × M（默认 2）× 100 点/元**。  
> 写入 `ToolBillablePrice` 前须与 [book-mall/doc/finance/00-pricing-source-of-truth.md](../../book-mall/doc/finance/00-pricing-source-of-truth.md) 对齐。

## toolKey 约定

- 前缀：`ecom-toolkit__`
- 示例：`ecom-toolkit__main-image__generate`

## 图片（OUTPUT_IMAGE，元/张）

| toolKey | action | schemeARefModelKey | 挂牌 cost | 扣点 (M=2) |
|---------|--------|-------------------|-----------|------------|
| ecom-toolkit__main-image | generate | seedream-4.5 | 0.25 | 50 |
| ecom-toolkit__detail-page | panel | nano-banana-pro | 0.30 | 60 |
| ecom-toolkit__model-shot | tryon | aitryon-refiner | 阶梯 | 见 D 表 |
| ecom-toolkit__poster | generate | flux-2-pro | 0.20 | 40 |
| ecom-toolkit__ip | character | gpt-image-2 | 0.35 | 70 |
| ecom-toolkit__vi | emoji-pack | seedream-4.5 | 2.00 (8张×0.25) | 400 |

## 视频（VIDEO_MODEL_SPEC，元/秒，1080P 档）

| toolKey | action | schemeARefModelKey | cloudTierRaw | 挂牌 cost/s | 5s 扣点 |
|---------|--------|-------------------|--------------|-------------|---------|
| ecom-toolkit__video | motion | doubao-seedance-1.5-pro | 1080P | 0.9 | 900 |
| ecom-toolkit__video | outfit | wan/2-7-image-to-video | 1080P | 0.6 | 600 |
| ecom-toolkit__video | dance-swap | happyhorse/image-to-video | 1080P | 0.9 | 900 |
| ecom-toolkit__video | camera | kling-2.6/image-to-video | 1080P | 1.2 | 1200 |
| ecom-toolkit__video | mirror-selfie | doubao-seedance-1.5-pro | 1080P | 0.9 | 900 |
| ecom-toolkit__video | hit-product | happyhorse-1.0-r2v | 1080P | 1.0 | 1000 |
| ecom-toolkit__video | voiceover | doubao-seedance-1.5-pro | 1080P | 0.9 | 900 |
| ecom-toolkit__video | digital-human | doubao-seedance-1.5-pro | 1080P | 0.9 | 900 |

## 故事版（M5）

| toolKey | action | schemeARefModelKey | 说明 | 扣点 |
|---------|--------|-------------------|------|------|
| ecom-toolkit__storyboard | chat | deepseek-v4-flash | 助手对话/分镜 JSON | 40 |
| ecom-toolkit__storyboard | video | doubao-seedance-2.0 | 整片视频 1080P 元/秒 | 10s≈1800 |

## LLM（TOKEN_IN_OUT，每次固定）

| toolKey | action | schemeARefModelKey | 折中 cost 说明 | 扣点 |
|---------|--------|-------------------|----------------|------|
| ecom-toolkit__detail-page | copy | qwen3-max | (in+out)/2 百万 token 折算单次 | 40 |
| ecom-toolkit__promo | script | qwen3-max | 同上 | 40 |
| ecom-toolkit__ad | script | qwen3-max | 同上 | 40 |

## 维护流程

1. 更新本文件（B）。
2. `book-mall` 执行 seed / 管理后台维护 `ToolBillablePrice`（D）。
3. `pnpm pricing:inspect-billable-vs-md`（扩展后）确认对齐。
