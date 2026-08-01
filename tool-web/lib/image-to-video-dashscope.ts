/**
 * 图生/参考/文生视频 · DashScope 请求体构建（创建任务经 Gateway，见 forward-gateway-dashscope-server）
 */

export const HAPPYHORSE_R2V_MODEL = "happyhorse-1.0-r2v";

export type I2vTaskOutput = {
  task_id?: string;
  task_status?: string;
  submit_time?: string;
  scheduled_time?: string;
  end_time?: string;
  video_url?: string;
  orig_prompt?: string;
  code?: string;
  message?: string;
};

export type DashscopeVideoJobBody = {
  input: Record<string, unknown>;
  parameters: Record<string, unknown>;
};

function parseSeed(raw: string | undefined): number | undefined {
  if (raw == null) return undefined;
  const t = String(raw).trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return undefined;
  if (n < 0 || n > 2147483647) return undefined;
  return n;
}

export function buildI2vVideoBody(opts: {
  prompt: string;
  firstFrame: string;
  resolution: "720P" | "1080P";
  duration: number;
  seedStr?: string;
  watermark?: boolean;
  parameterExtras?: Record<string, unknown>;
}): { ok: true; body: DashscopeVideoJobBody } | { ok: false; error: string } {
  const prompt = opts.prompt.trim();
  if (!prompt) return { ok: false, error: "提示词不能为空" };

  const first = opts.firstFrame.trim();
  if (!first) return { ok: false, error: "缺少首帧图片" };
  if (first.length > 28_000_000) {
    return { ok: false, error: "首帧数据过大，请使用较小图片或公网 URL" };
  }
  const isData = first.startsWith("data:image/");
  const isHttp = first.startsWith("https://") || first.startsWith("http://");
  if (!isData && !isHttp) {
    return {
      ok: false,
      error: "首帧须为公网图片 URL 或本地读取后的 Data URL",
    };
  }

  const duration = Math.min(15, Math.max(3, Math.floor(opts.duration)));
  const seed = parseSeed(opts.seedStr);
  const parameters: Record<string, unknown> = {
    ...(opts.parameterExtras ?? {}),
    resolution: opts.resolution,
    duration,
    watermark: opts.watermark ?? false,
  };
  if (seed != null) parameters.seed = seed;

  return {
    ok: true,
    body: {
      input: {
        prompt,
        media: [{ type: "first_frame", url: first }],
      },
      parameters,
    },
  };
}

function validateImageRef(
  label: string,
  url: string,
): { ok: true } | { ok: false; error: string } {
  const u = url.trim();
  if (!u) return { ok: false, error: `${label}不能为空` };
  if (u.length > 28_000_000) {
    return { ok: false, error: `${label}数据过大，请使用较小图片或公网 URL` };
  }
  const isData = u.startsWith("data:image/");
  const isHttp = u.startsWith("https://") || u.startsWith("http://");
  if (!isData && !isHttp) {
    return {
      ok: false,
      error: `${label}须为公网图片 URL 或 Data URL（image/…）`,
    };
  }
  return { ok: true };
}

export function buildR2vVideoBody(opts: {
  prompt: string;
  referenceImageUrls: string[];
  resolution: "720P" | "1080P";
  ratio: string;
  duration: number;
  seedStr?: string;
  watermark?: boolean;
  parameterExtras?: Record<string, unknown>;
}): { ok: true; body: DashscopeVideoJobBody } | { ok: false; error: string } {
  const prompt = opts.prompt.trim();
  if (!prompt) return { ok: false, error: "提示词不能为空" };

  const urls = opts.referenceImageUrls.map((s) => s.trim()).filter(Boolean);
  if (urls.length < 1 || urls.length > 9) {
    return { ok: false, error: "参考图数量须为 1～9 张" };
  }
  for (let i = 0; i < urls.length; i++) {
    const v = validateImageRef(`参考图 ${i + 1}`, urls[i]!);
    if (!v.ok) return v;
  }

  const duration = Math.min(15, Math.max(3, Math.floor(opts.duration)));
  const seed = parseSeed(opts.seedStr);
  const ratio = opts.ratio.trim() || "16:9";
  const parameters: Record<string, unknown> = {
    ...(opts.parameterExtras ?? {}),
    resolution: opts.resolution,
    ratio,
    duration,
    watermark: opts.watermark ?? false,
  };
  if (seed != null) parameters.seed = seed;

  return {
    ok: true,
    body: {
      input: {
        prompt,
        media: urls.map((url) => ({ type: "reference_image", url })),
      },
      parameters,
    },
  };
}

export type T2vVideoBodyOpts = {
  prompt: string;
  parameterExtras?: Record<string, unknown>;
} & (
  | {
      parameterStyle: "wanSize";
      size: string;
      duration: 5 | 10;
    }
  | {
      parameterStyle: "resolutionRatio";
      resolution: "720P" | "1080P";
      ratio: string;
      duration: number;
      seedStr?: string;
      watermark?: boolean;
    }
);

export function buildT2vVideoBody(
  opts: T2vVideoBodyOpts,
): { ok: true; body: DashscopeVideoJobBody } | { ok: false; error: string } {
  const prompt = opts.prompt.trim();
  if (!prompt) return { ok: false, error: "提示词不能为空" };

  let parameters: Record<string, unknown>;
  if (opts.parameterStyle === "wanSize") {
    const size = opts.size.trim();
    if (!size) return { ok: false, error: "缺少画面尺寸（size）" };
    parameters = {
      ...(opts.parameterExtras ?? {}),
      size,
      duration: opts.duration,
    };
  } else {
    const duration = Math.min(15, Math.max(3, Math.floor(opts.duration)));
    const ratio = opts.ratio.trim() || "16:9";
    const seed = parseSeed(opts.seedStr);
    parameters = {
      ...(opts.parameterExtras ?? {}),
      resolution: opts.resolution,
      ratio,
      duration,
      watermark: opts.watermark ?? false,
    };
    if (seed != null) parameters.seed = seed;
  }

  return { ok: true, body: { input: { prompt }, parameters } };
}
