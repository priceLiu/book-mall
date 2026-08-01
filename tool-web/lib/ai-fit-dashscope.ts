/** AI 试衣 · Gateway 轮询 output 解析（创建/查询走 forward-gateway-dashscope-server） */

/** 阿里云 OSS 的 *.aliyuncs.com 同时支持 https；签名仅含 path+query，可安全升级协议。 */
function upgradeAliyunHttpToHttps(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    if (u.protocol === "http:" && /\.aliyuncs\.com$/i.test(u.hostname)) {
      u.protocol = "https:";
      return u.toString();
    }
  } catch {
    /* ignore */
  }
  return rawUrl;
}

/**
 * 从任务查询的 `output` 中取成片 URL。
 * 文档里常见 `image_url`；图像合成类也常放在 `results[].url`。
 */
export function dashscopeExtractTaskImageUrl(
  output: Record<string, unknown>,
): string | undefined {
  const pickFirstUrl = (val: unknown): string | undefined => {
    if (typeof val === "string" && val.trim()) return val.trim();
    return undefined;
  };

  const direct = pickFirstUrl(output.image_url);
  if (direct) return upgradeAliyunHttpToHttps(direct);

  const results = output.results;
  if (Array.isArray(results) && results.length > 0) {
    const first = results[0];
    const fromStr = pickFirstUrl(first);
    if (fromStr) return upgradeAliyunHttpToHttps(fromStr);
    if (first && typeof first === "object") {
      const r = first as Record<string, unknown>;
      const u = pickFirstUrl(r.url) ?? pickFirstUrl(r.image_url);
      if (u) return upgradeAliyunHttpToHttps(u);
    }
  }

  const oiu = pickFirstUrl(output.output_image_url);
  if (oiu) return upgradeAliyunHttpToHttps(oiu);

  return undefined;
}
