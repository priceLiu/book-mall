# KIE 价目镜像（Gateway scope）

> capturedAt: 2026-08-08
> source: https://kie.ai/zh-CN/pricing
> api: https://api.kie.ai/client/v1/model-pricing/page
> kieCreditYuan: 0.036（标准充值档 ¥36/1000 积分）
> scope: gateway-only · 排除 HappyHorse
> formula: listCostYuan = kieCredits × 0.036

| canonical | gatewayModelKey | tierRaw | kieCredits | listCostYuan | usdCheck | billingUnit | kieDescription |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
| claude-opus-4-5 | claude-opus-4-5 | — | in 285 / out 1430 /M | 0.010260 | 1.425 | PER_KTOKEN | claude-opus-4-5, Chat, Input |
| claude-opus-4-8 | claude-opus-4-8 | — | in 400 / out 2000 /M | 0.014400 | 2 | PER_KTOKEN | Claude-Opus-4-8, chat, Input |
| flux-2-pro | flux-2-pro | — | 5 | 0.180000 | 0.025 | PER_IMAGE | Black Forest Labs flux-2 pro, text-to-image, 1.0s-1K |
| gemini-3-5-flash | gemini-3-5-flash | — | in 90 / out 540 /M | 0.003240 | 0.45 | PER_KTOKEN | Gemini 3.5 Flash, chat, input |
| gemini-3-pro | gemini-3-pro | — | in 100 / out 700 /M | 0.003600 | 0.50 | PER_KTOKEN | Gemini 3 Pro, Chat, Input |
| gemini-flash | google/gemini-3-flash-preview | — | in 30 / out 180 /M | 0.001080 | 0.15 | PER_KTOKEN | Gemini 3 Flash, Chat, Input |
| gemini-flash | gemini-3-flash | — | in 30 / out 180 /M | 0.001080 | 0.15 | PER_KTOKEN | Gemini 3 Flash, Chat, Input |
| gemini-flash | gemini-2.5-flash | — | in 18 / out 150 /M | 0.000648 | 0.09 | PER_KTOKEN | Gemini 2.5 flash, Chat, Input |
| google-nano-banana | google/nano-banana | — | 4 | 0.144000 | 0.02 | PER_IMAGE | Google nano banana, text-to-image |
| google-nano-banana-i2i | google/nano-banana-edit | — | 4 | 0.144000 | 0.02 | PER_IMAGE | Google nano banana edit, image-to-image |
| gpt-5-5-chat | gpt-5-5 | — | in 280 / out 1680 /M | 0.010080 | 1.4 | PER_KTOKEN | gpt-5.5, Chat, Input |
| gpt-image-1 | gpt-image-1 | — | 4 | 0.144000 | 0.02 | PER_IMAGE | gpt image 1.5, text-to-image, medium |
| gpt-image-2 | gpt-image-2 | — | 10 | 0.360000 | 0.05 | PER_IMAGE | gpt image 2, text-to-image, 2k |
| gpt-image-2 | gpt-image-2-text-to-image | — | 10 | 0.360000 | 0.05 | PER_IMAGE | gpt image 2, text-to-image, 2k |
| gpt-image-2 | gpt-image-2-image-to-image | — | 10 | 0.360000 | 0.05 | PER_IMAGE | gpt image 2, image-to-image, 2k |
| grok-imagine-video-1-5-preview | grok-imagine-video-1-5-preview | 720p | 4.5/s | 0.162000 | 0.0225 | PER_SEC | grok-imagine-video-1-5-preview, image-to-video, 720p |
| grok-imagine/image-to-video | grok-imagine/image-to-video | 720p | 4.5/s | 0.162000 | 0.0225 | PER_SEC | grok-imagine-video-1-5-preview, image-to-video, 720p |
| grok-imagine/text-to-image | grok-imagine/text-to-image | — | 5 | 0.180000 | 0.025 | PER_IMAGE | grok-imagine, text-to-image(quality) |
| hailuo-2.3-i2v | hailuo/2-3-image-to-video-standard | 720p | 5/s | 0.180000 | 0.15 | PER_SEC | hailuo 2.3, image-to-video, Standard-6.0s-768p (→ 5.00 credits/s @ 6s) |
| hailuo-2.3-i2v | hailuo/2-3-image-to-video-pro | 720p | 7.5/s | 0.270000 | 0.225 | PER_SEC | hailuo 2.3, image-to-video, Pro-6.0s-768p (→ 7.50 credits/s @ 6s) |
| kie-4o-image | 4o-image | — | 6 | 0.216000 | 0.03 | PER_IMAGE | OpenAI 4o image, text-to-image |
| kie-elevenlabs-tts | elevenlabs/text-to-speech-multilingual-v2 | — | 6 | 0.216000 | 0.06 | PER_IMAGE | Elevenlabs Text to Speech, multilingual v2 |
| kie-elevenlabs-v3 | elevenlabs/text-to-dialogue-v3 | — | 7 | 0.252000 | 0.07 | PER_IMAGE | Elevenlabs V3 , Text to dialogue |
| kie-seedance-2.0 | bytedance/seedance-2 | 720p | 41/s | 1.476000 | 0.205 | PER_SEC | bytedance/seedance-2, 720p no video input |
| kie-suno-api | suno/generate | — | 12 | 0.432000 | 0.06 | PER_IMAGE | Suno, Generate Music  |
| kling-2.5-turbo-i2v | kling/v2-5-turbo-image-to-video-pro | 720p | 8.4/s | 0.302400 | 0.21 | PER_SEC | kling 2.5 turbo , image-to-video, Turbo Pro-5.0s (→ 8.40 credits/s @ 5s) |
| kling-2.5-turbo-i2v | kling/v2-5-turbo-text-to-video-pro | 720p | 8.4/s | 0.302400 | 0.21 | PER_SEC | kling 2.5 turbo , text-to-video, Turbo Pro-5.0s (→ 8.40 credits/s @ 5s) |
| kling-2.6-motion-control | kling-2.6/motion-control | 720p | 11/s | 0.396000 | 0.055 | PER_SEC | kling 2.6 motion control, video-to-video, 720P |
| kling-2.6/motion-control | kling-2.6/motion-control | 720p | 11/s | 0.396000 | 0.055 | PER_SEC | kling 2.6 motion control, video-to-video, 720P |
| kling-3.0-motion-control | kling-3.0/motion-control | 720p | 20/s | 0.720000 | 0.1 | PER_SEC | kling 3.0 motion control, video-to-video, 720P |
| kling-3.0-turbo-i2v | kling/v3-turbo-image-to-video | 720p | 18/s | 0.648000 | 0.09 | PER_SEC | kling 3.0 turbo, image-to-video, 720P |
| kling-3.0-turbo-t2v | kling/v3-turbo-text-to-video | 720p | 18/s | 0.648000 | 0.09 | PER_SEC | kling 3.0 turbo, text-to-video, 720P |
| kling-3.0-video | kling-3.0/video | 720p | 14/s | 0.504000 | 0.07 | PER_SEC | Kling 3.0, video, without audio-720P |
| kling-3.0/motion-control | kling-3.0/motion-control | 720p | 20/s | 0.720000 | 0.1 | PER_SEC | kling 3.0 motion control, video-to-video, 720P |
| kling-ai-avatar-pro | kling/ai-avatar-pro | 720p | 16/s | 0.576000 | 0.08 | PER_SEC | Kling AI Avtar , lip sync, Pro-up to 15 secondss-1080p |
| kling-ai-avatar-standard | kling/ai-avatar-standard | 720p | 8/s | 0.288000 | 0.04 | PER_SEC | Kling AI Avtar , lip sync, Standard-up to 15 secondss-720p |
| lib-nano-pro | nano-banana-pro | — | 18 | 0.648000 | 0.09 | PER_IMAGE | Google nano banana pro, 1/2K |
| nano-banana-2 | nano-banana-2 | — | 4 | 0.144000 | 0.02 | PER_IMAGE | nano-banana-2-lite, 1k |
| qwen-text-to-image | qwen-text-to-image | — | 6.4 | 0.230400 | 0.032 | PER_IMAGE | Qwen image 3.0 Pro, text to image, 1K |
| seedance-2.0-mini | bytedance/seedance-2-mini | 720p | 8.2/s | 0.295200 | 0.041 | PER_SEC | bytedance/seedance-2-mini, 720P no video |
| seedream-4.5 | seedream-4.5 | — | 6.5 | 0.234000 | 0.0325 | PER_IMAGE | seedream 4.5, text-to-image |
| seedream-5-lite | seedream-5-lite | — | 7 | 0.252000 | 0.035 | PER_IMAGE | seedream 5 Pro, text-to-image, 1K |
| topaz/video-upscale | topaz/video-upscale | 720p | 8/s | 0.288000 | 0.04 | PER_SEC | Topaz Video Upscaler, upscale factor 1x/2x |
| veo-2 | veo-2 | 720p | 3.75/s | 0.135000 | 0.15 | PER_SEC | Google veo 3.1, reference-to-video, Lite-720p (→ 3.75 credits/s @ 8s) |
| veo-3 | veo3 | 720p | 7.5/s | 0.270000 | 0.30 | PER_SEC | Google veo 3.1, image-to-video, Fast-720p (→ 7.50 credits/s @ 8s) |
| veo-3.1 | veo3.1 | 720p | 7.5/s | 0.270000 | 0.30 | PER_SEC | Google veo 3.1, image-to-video, Fast-720p (→ 7.50 credits/s @ 8s) |
| wan/2-6-video-to-video | wan/2-6-video-to-video | 720p | 14/s | 0.504000 | 1.05 | PER_SEC | wan 2.6, video-to-video, 15.0s-720p (→ 14.00 credits/s @ 15s) |
| lib-nano-pro-1k | nano-banana-pro | 1K | 8 | 0.288000 | 0.04 | PER_IMAGE | Google nano banana 2, 1K |
| lib-nano-pro-2k | nano-banana-pro | 2K | 18 | 0.648000 | 0.09 | PER_IMAGE | Google nano banana pro, 1/2K |
| lib-nano-pro-4k | nano-banana-pro | 4K | 24 | 0.864000 | 0.12 | PER_IMAGE | Google nano banana pro, 4K |
