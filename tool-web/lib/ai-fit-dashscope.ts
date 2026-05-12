const SYNTHESIS_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis/";

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

export async function dashscopeCreateTryOnTask(opts: {
  apiKey: string;
  personImageUrl: string;
  topGarmentUrl?: string;
  bottomGarmentUrl?: string;
  model?: string;
}): Promise<{ taskId: string } | { error: string }> {
  const model = opts.model ?? "aitryon";
  const input: Record<string, string> = {
    person_image_url: opts.personImageUrl,
  };
  if (opts.topGarmentUrl) input.top_garment_url = opts.topGarmentUrl;
  if (opts.bottomGarmentUrl) input.bottom_garment_url = opts.bottomGarmentUrl;

  const res = await fetch(SYNTHESIS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model,
      input,
      parameters: { resolution: -1, restore_face: true },
    }),
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof json.message === "string"
        ? json.message
        : typeof json.code === "string"
          ? json.code
          : `HTTP ${res.status}`;
    return { error: msg };
  }
  const output = json.output as Record<string, unknown> | undefined;
  const taskId =
    typeof output?.task_id === "string" ? output.task_id : undefined;
  if (!taskId) {
    return { error: "未返回 task_id" };
  }
  return { taskId };
}

export async function dashscopeGetTask(opts: {
  apiKey: string;
  taskId: string;
}): Promise<Record<string, unknown>> {
  const res = await fetch(
    `https://dashscope.aliyuncs.com/api/v1/tasks/${encodeURIComponent(opts.taskId)}`,
    {
      headers: { Authorization: `Bearer ${opts.apiKey}` },
      cache: "no-store",
    },
  );
  return (await res.json()) as Record<string, unknown>;
}
