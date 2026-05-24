/**
 * 腾讯混元生3D
 * - 专业版：api.ai3d.cloud.tencent.com OpenAI 兼容（sk- Key）
 * - 极速版（官方）：ai3d.tencentcloudapi.com TC3 签名（SecretId + SecretKey）
 * - 极速版（可选）：tokenhub.tencentmaas.com Bearer Key
 * @see https://cloud.tencent.com/document/product/1804/120838
 * @see canvas-web/docs/hunyuan.md
 */

import type { CanvasProviderKind } from "@prisma/client";
import type {
  CanvasGatewayImageRequest,
  CanvasGatewayImageTask,
  CanvasGatewayListModelsResult,
  CanvasGatewayPollResult,
  CanvasParamSchema,
  CanvasProviderConfig,
  CanvasProviderGateway,
} from "./types";
import { CanvasGatewayError } from "./types";
import {
  callAi3dTencentCloudApi,
  resolveAi3dTc3Credentials,
  type TencentCloudTc3Credentials,
} from "./tencent-cloud-tc3";

export const HUNYUAN_3D_PRO_BASE = "https://api.ai3d.cloud.tencent.com";
export const HUNYUAN_TC_API_BASE = "https://ai3d.tencentcloudapi.com";
export const HUNYUAN_TOKENHUB_BASE = "https://tokenhub.tencentmaas.com";

export function isHunyuanTokenHubBase(baseUrl: string | null | undefined): boolean {
  return (baseUrl ?? "").includes("tokenhub.tencentmaas.com");
}

export function isHunyuanTcApiBase(baseUrl: string | null | undefined): boolean {
  return (baseUrl ?? "").includes("ai3d.tencentcloudapi.com");
}

export const HUNYUAN_3D_PRO_MODEL_KEY = "hunyuan-3d-pro";
export const HUNYUAN_3D_EXPRESS_MODEL_KEY = "hunyuan-3d-express";

const PRO_MODEL = {
  modelKey: HUNYUAN_3D_PRO_MODEL_KEY,
  displayName: "混元生3D · 专业版",
  role: "IMAGE" as const,
  description:
    "腾讯云混元生3D 专业版：参考图 + 描述生成高精度 3D 模型（默认 3 并发）。",
  paramsSchema: [
    {
      key: "Model",
      label: "模型版本",
      type: "select",
      options: [
        { value: "3.0", label: "3.0" },
        { value: "3.1", label: "3.1（不支持 Sketch）" },
      ],
      defaultValue: "3.0",
    },
    {
      key: "GenerateType",
      label: "生成模式",
      type: "select",
      options: [
        { value: "Normal", label: "Normal · 图生 3D 仅传图" },
        { value: "Sketch", label: "Sketch · 图 + 描述同传" },
      ],
      defaultValue: "Sketch",
    },
    {
      key: "ResultFormat",
      label: "3D 格式（可选）",
      type: "select",
      options: [
        { value: "", label: "默认（OBJ + GLB）" },
        { value: "STL", label: "STL" },
        { value: "USDZ", label: "USDZ" },
        { value: "FBX", label: "FBX" },
      ],
      defaultValue: "",
    },
    {
      key: "EnablePBR",
      label: "PBR 材质",
      type: "boolean",
      defaultValue: false,
    },
  ] satisfies CanvasParamSchema,
  defaultParams: {
    Model: "3.0",
    GenerateType: "Sketch",
    ResultFormat: "",
    EnablePBR: false,
  },
};

const EXPRESS_MODEL = {
  modelKey: HUNYUAN_3D_EXPRESS_MODEL_KEY,
  displayName: "混元生3D · 极速版（普通）",
  role: "IMAGE" as const,
  description:
    "HY-3D-Express · 约 90 秒内出模；官方 API 需 SecretId + SecretKey（TC3 签名）。",
  paramsSchema: [
    {
      key: "ResultFormat",
      label: "3D 格式（可选）",
      type: "select",
      options: [
        { value: "", label: "默认（OBJ）" },
        { value: "GLB", label: "GLB" },
        { value: "STL", label: "STL" },
        { value: "USDZ", label: "USDZ" },
        { value: "FBX", label: "FBX" },
        { value: "MP4", label: "MP4" },
      ],
      defaultValue: "",
    },
    {
      key: "EnablePBR",
      label: "PBR 材质",
      type: "boolean",
      defaultValue: false,
    },
    {
      key: "EnableGeometry",
      label: "单几何白模（无纹理）",
      type: "boolean",
      defaultValue: false,
    },
  ] satisfies CanvasParamSchema,
  defaultParams: {
    ResultFormat: "",
    EnablePBR: false,
    EnableGeometry: false,
  },
};

function hasTc3EnvCredentials(): boolean {
  return !!(
    process.env.HUNYUAN_TC_SECRET_ID?.trim() &&
    process.env.HUNYUAN_TC_SECRET_KEY?.trim()
  );
}

/** 按 env 返回可用混元模型 */
export function listHunyuanKnownModels() {
  const out = [];
  if (process.env.HUNYUAN_3D_API_KEY?.trim()) out.push(PRO_MODEL);
  if (hasTc3EnvCredentials() || process.env.HUNYUAN_TOKENHUB_API_KEY?.trim()) {
    out.push(EXPRESS_MODEL);
  }
  return out;
}

/** @deprecated 使用 listHunyuanKnownModels */
export const HUNYUAN_3D_KNOWN_MODELS = [PRO_MODEL, EXPRESS_MODEL];

export const HUNYUAN_3D_DEFAULT_BASE = HUNYUAN_3D_PRO_BASE;

type HunyuanResponse<T> = {
  Response?: T & { Error?: { Code?: string; Message?: string } };
} & T;

type HunyuanSubmitResponse = { JobId?: string };

type HunyuanFile3D = {
  PreviewImageUrl?: string;
  Type?: string;
  Url?: string;
};

type HunyuanQueryResponse = {
  Status?: string;
  ErrorCode?: string;
  ErrorMessage?: string;
  ResultFile3Ds?: HunyuanFile3D[];
};

type TokenHubSubmitResponse = {
  id?: string;
  status?: string;
};

type TokenHubFile = {
  type?: string;
  url?: string;
  preview_image_url?: string;
};

type TokenHubQueryResponse = {
  status?: string;
  data?: TokenHubFile[];
  error?: { message?: string; code?: string };
};

function isExpressModel(modelKey: string): boolean {
  return modelKey === HUNYUAN_3D_EXPRESS_MODEL_KEY;
}

function proApiKey(config: CanvasProviderConfig): string {
  const k = config.apiKey.trim();
  if (!k || parseTencentCloudTc3FromKey(k)) {
    const fromEnv = process.env.HUNYUAN_3D_API_KEY?.trim();
    if (!fromEnv) {
      throw new CanvasGatewayError(
        "PROVIDER_NOT_CONFIGURED",
        "混元生3D 专业版 API Key 未配置",
        503,
        false,
      );
    }
    return fromEnv.startsWith("sk-") ? fromEnv : `sk-${fromEnv}`;
  }
  return k.startsWith("sk-") ? k : `sk-${k}`;
}

function parseTencentCloudTc3FromKey(apiKey: string) {
  return resolveAi3dTc3Credentials(apiKey);
}

function tc3Credentials(config: CanvasProviderConfig): TencentCloudTc3Credentials {
  const creds = resolveAi3dTc3Credentials(config.apiKey);
  if (!creds) {
    throw new CanvasGatewayError(
      "PROVIDER_NOT_CONFIGURED",
      "混元极速版需配置 SecretId + SecretKey（画布设置 → 混元极速版，或 HUNYUAN_TC_SECRET_ID / HUNYUAN_TC_SECRET_KEY）",
      503,
      false,
    );
  }
  return creds;
}

function expressApiKey(config: CanvasProviderConfig): string {
  const fromEnv = process.env.HUNYUAN_TOKENHUB_API_KEY?.trim();
  const k = config.apiKey.trim() || fromEnv || "";
  if (!k || parseTencentCloudTc3FromKey(k)) {
    throw new CanvasGatewayError(
      "PROVIDER_NOT_CONFIGURED",
      "混元 TokenHub 极速版需配置 API Key（HUNYUAN_TOKENHUB_API_KEY）",
      503,
      false,
    );
  }
  return k;
}

function tokenHubAuthorization(apiKey: string): string {
  const k = apiKey.trim();
  if (k.startsWith("Bearer ")) return k;
  return `Bearer ${k}`;
}

function unwrapProResponse<T>(parsed: HunyuanResponse<T>): T {
  if (parsed.Response && typeof parsed.Response === "object") {
    const err = parsed.Response.Error;
    if (err?.Code) {
      const quota = err.Code === "ResourceInsufficient";
      throw new CanvasGatewayError(
        quota ? "PROVIDER_QUOTA_EXCEEDED" : "PROVIDER_HTTP_ERROR",
        quota
          ? "混元生3D 资源不足：并发任务已满或账户积分/配额用尽。请稍后再试，或登录腾讯云混元控制台查看进行中的任务与余额。"
          : `混元生3D ${err.Code}: ${err.Message ?? ""}`.trim(),
        502,
        quota,
      );
    }
    return parsed.Response;
  }
  return parsed as T;
}

function buildProSubmitBody(req: CanvasGatewayImageRequest): Record<string, unknown> {
  const prompt = req.prompt.trim();
  const imageUrl = (req.imageUrls ?? []).find(
    (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
  );
  if (!prompt && !imageUrl) {
    throw new CanvasGatewayError(
      "PROVIDER_INVALID_RESPONSE",
      "混元生3D 需要参考图 URL 或 Prompt（至少其一）",
      400,
      false,
    );
  }

  const params = (req.params ?? {}) as Record<string, unknown>;
  const modelVer = String(params.Model ?? "3.0");
  let generateType = String(params.GenerateType ?? "Normal");
  if (modelVer === "3.1" && generateType === "Sketch") generateType = "Normal";

  const body: Record<string, unknown> = { Model: modelVer };

  if (params.ResultFormat && String(params.ResultFormat).trim()) {
    const rf = String(params.ResultFormat).trim().toUpperCase();
    if (["STL", "USDZ", "FBX"].includes(rf)) body.ResultFormat = rf;
  }
  if (typeof params.EnablePBR === "boolean") body.EnablePBR = params.EnablePBR;

  if (imageUrl && prompt) {
    if (generateType === "Sketch") {
      body.GenerateType = "Sketch";
      body.ImageUrl = imageUrl;
      body.Prompt = prompt;
    } else {
      body.GenerateType = "Normal";
      body.ImageUrl = imageUrl;
    }
  } else if (imageUrl) {
    body.GenerateType = "Normal";
    body.ImageUrl = imageUrl;
  } else {
    body.GenerateType = generateType;
    body.Prompt = prompt;
  }
  return body;
}

/** 官方极速版 SubmitHunyuanTo3DRapidJob */
function buildRapidSubmitBody(req: CanvasGatewayImageRequest): Record<string, unknown> {
  const prompt = req.prompt.trim().slice(0, 200);
  const imageUrl = (req.imageUrls ?? []).find(
    (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
  );
  if (!prompt && !imageUrl) {
    throw new CanvasGatewayError(
      "PROVIDER_INVALID_RESPONSE",
      "混元极速版需要参考图 URL 或 Prompt（至少其一）",
      400,
      false,
    );
  }

  const params = (req.params ?? {}) as Record<string, unknown>;
  const body: Record<string, unknown> = {};

  if (prompt && imageUrl) {
    // 极速版不支持 Prompt 与 ImageUrl 同传；三视图节点默认有描述 + 参考图，优先用图
    body.ImageUrl = imageUrl;
  } else if (imageUrl) {
    body.ImageUrl = imageUrl;
  } else {
    body.Prompt = prompt;
  }

  const rf = String(
    params.ResultFormat ?? params.result_format ?? "",
  )
    .trim()
    .toUpperCase();
  if (["GLB", "STL", "USDZ", "FBX", "MP4", "OBJ"].includes(rf)) {
    body.ResultFormat = rf;
  }

  const enablePbr = params.EnablePBR ?? params.enable_pbr;
  if (typeof enablePbr === "boolean") body.EnablePBR = enablePbr;

  const enableGeometry = params.EnableGeometry ?? params.enable_geometry;
  if (typeof enableGeometry === "boolean") body.EnableGeometry = enableGeometry;

  return body;
}

function buildTokenHubSubmitBody(req: CanvasGatewayImageRequest): Record<string, unknown> {
  const prompt = req.prompt.trim().slice(0, 200);
  const imageUrl = (req.imageUrls ?? []).find(
    (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
  );
  if (!prompt && !imageUrl) {
    throw new CanvasGatewayError(
      "PROVIDER_INVALID_RESPONSE",
      "混元极速版需要参考图 URL 或 Prompt（至少其一）",
      400,
      false,
    );
  }
  const params = (req.params ?? {}) as Record<string, unknown>;
  const body: Record<string, unknown> = { model: "hy-3d-express" };

  if (prompt && imageUrl) {
    body.image_url = imageUrl;
  } else if (imageUrl) {
    body.image_url = imageUrl;
  } else {
    body.prompt = prompt;
  }

  const rf = String(
    params.ResultFormat ?? params.result_format ?? "",
  )
    .trim()
    .toUpperCase();
  if (["GLB", "STL", "USDZ", "FBX", "MP4", "OBJ"].includes(rf)) {
    body.result_format = rf;
  }
  const enablePbr = params.EnablePBR ?? params.enable_pbr;
  if (typeof enablePbr === "boolean") body.enable_pbr = enablePbr;
  return body;
}

function pollFromProQuery(resp: HunyuanQueryResponse): CanvasGatewayPollResult {
  const status = (resp.Status ?? "").toUpperCase();
  if (status === "WAIT") return { state: "pending", rawPayload: resp };
  if (status === "RUN") return { state: "running", rawPayload: resp };
  if (status === "FAIL") {
    return {
      state: "failed",
      errorCode: resp.ErrorCode ?? "HUNYUAN_FAILED",
      errorMessage: resp.ErrorMessage ?? "混元生3D 任务失败",
      rawPayload: resp,
    };
  }
  if (status === "DONE") {
    const files = resp.ResultFile3Ds ?? [];
    const preview =
      files.find((f) => f.PreviewImageUrl)?.PreviewImageUrl ??
      files.find((f) => f.Url)?.Url;
    const modelUrl = files.find((f) => f.Url)?.Url;
    const urls = [preview, modelUrl].filter(
      (u): u is string => typeof u === "string" && u.length > 0,
    );
    return {
      state: "succeeded",
      resultUrls: urls.length > 0 ? urls : undefined,
      rawPayload: resp,
    };
  }
  return { state: "pending", rawPayload: resp };
}

export class Hunyuan3DGateway implements CanvasProviderGateway {
  readonly kind: CanvasProviderKind = "HUNYUAN_3D";

  constructor(private readonly config: CanvasProviderConfig) {}

  private isTokenHubProvider(): boolean {
    return isHunyuanTokenHubBase(this.config.baseUrl);
  }

  private isTcApiProvider(): boolean {
    if (isHunyuanTcApiBase(this.config.baseUrl)) return true;
    return !!parseTencentCloudTc3FromKey(this.config.apiKey);
  }

  private tokenHubBaseUrl(): string {
    const b = this.config.baseUrl?.trim().replace(/\/$/, "");
    return b && isHunyuanTokenHubBase(b) ? b : HUNYUAN_TOKENHUB_BASE;
  }

  private expressRoute(modelKey: string): "tc3" | "tokenhub" | null {
    const wantExpress =
      isExpressModel(modelKey) ||
      this.isTokenHubProvider() ||
      this.isTcApiProvider();
    if (!wantExpress) return null;

    if (this.isTokenHubProvider()) return "tokenhub";
    if (resolveAi3dTc3Credentials(this.config.apiKey)) return "tc3";

    if (isExpressModel(modelKey)) {
      throw new CanvasGatewayError(
        "PROVIDER_NOT_CONFIGURED",
        "hunyuan-3d-express 需使用极速版 Provider（SecretId + SecretKey）或配置 HUNYUAN_TC_SECRET_ID / HUNYUAN_TC_SECRET_KEY",
        503,
        false,
      );
    }
    return null;
  }

  private async postPro<T>(
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const r = await fetch(`${HUNYUAN_3D_PRO_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: proApiKey(this.config),
      },
      body: JSON.stringify(body),
    });
    return this.parseProResponse<T>(r);
  }

  private async postTokenHub<T>(
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const r = await fetch(`${this.tokenHubBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: tokenHubAuthorization(expressApiKey(this.config)),
      },
      body: JSON.stringify(body),
    });
    return this.parseTokenHubResponse<T>(r);
  }

  private async parseProResponse<T>(r: Response): Promise<T> {
    const text = await r.text();
    if (!r.ok) {
      throw new CanvasGatewayError(
        r.status === 401 || r.status === 403
          ? "PROVIDER_AUTH_ERROR"
          : "PROVIDER_HTTP_ERROR",
        `混元生3D HTTP ${r.status}: ${text.slice(0, 400)}`,
        r.status,
        r.status >= 500,
      );
    }
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      throw new CanvasGatewayError(
        "PROVIDER_INVALID_RESPONSE",
        `混元生3D 非 JSON 响应: ${text.slice(0, 200)}`,
      );
    }
    return unwrapProResponse(parsed as HunyuanResponse<T>);
  }

  private async parseTokenHubResponse<T>(r: Response): Promise<T> {
    const text = await r.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      throw new CanvasGatewayError(
        "PROVIDER_INVALID_RESPONSE",
        `混元 TokenHub 非 JSON 响应: ${text.slice(0, 200)}`,
      );
    }
    const obj = parsed as { error?: { message?: string; code?: string } };
    if (!r.ok || obj.error) {
      const msg = obj.error?.message ?? text.slice(0, 400);
      throw new CanvasGatewayError(
        r.status === 401 || r.status === 403
          ? "PROVIDER_AUTH_ERROR"
          : "PROVIDER_HTTP_ERROR",
        `混元 TokenHub HTTP ${r.status}: ${msg}`,
        r.status,
        r.status >= 500,
      );
    }
    return parsed as T;
  }

  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    try {
      if (this.isTokenHubProvider()) {
        expressApiKey(this.config);
        return {
          ok: true,
          message:
            "混元 TokenHub Key 已填写。保存后可在三视图节点选用 hunyuan-3d-express。",
        };
      }
      if (this.isTcApiProvider() || resolveAi3dTc3Credentials(this.config.apiKey)) {
        tc3Credentials(this.config);
        return {
          ok: true,
          message:
            "混元极速版 SecretId / SecretKey 已填写（官方 API · ai3d.tencentcloudapi.com）。",
        };
      }
      proApiKey(this.config);
      return {
        ok: true,
        message: "混元专业版 Key 已填写（api.ai3d.cloud.tencent.com）。",
      };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async listModels(): Promise<CanvasGatewayListModelsResult> {
    if (this.isTokenHubProvider() || this.isTcApiProvider()) {
      return { models: [EXPRESS_MODEL], fromHardcoded: true };
    }
    if (this.config.id.startsWith("system:")) {
      return { models: listHunyuanKnownModels(), fromHardcoded: true };
    }
    return { models: [PRO_MODEL], fromHardcoded: true };
  }

  async chat(): Promise<never> {
    throw new CanvasGatewayError(
      "PROVIDER_UNSUPPORTED",
      "混元生3D 不支持 LLM",
      501,
      false,
    );
  }

  async createImageTask(
    req: CanvasGatewayImageRequest,
  ): Promise<CanvasGatewayImageTask> {
    const route = this.expressRoute(req.modelKey);

    if (route === "tc3") {
      const creds = tc3Credentials(this.config);
      const body = buildRapidSubmitBody(req);
      const resp = await callAi3dTencentCloudApi<HunyuanSubmitResponse>(
        creds,
        "SubmitHunyuanTo3DRapidJob",
        body,
      );
      const jobId = resp.JobId;
      if (!jobId) {
        throw new CanvasGatewayError(
          "PROVIDER_INVALID_RESPONSE",
          "混元极速版 submit 响应缺少 JobId",
        );
      }
      return { mode: "async", taskId: jobId, rawPayload: resp };
    }

    if (route === "tokenhub") {
      const body = buildTokenHubSubmitBody(req);
      const resp = await this.postTokenHub<TokenHubSubmitResponse>(
        "/v1/api/3d/submit",
        body,
      );
      const jobId = resp.id;
      if (!jobId) {
        throw new CanvasGatewayError(
          "PROVIDER_INVALID_RESPONSE",
          "混元 TokenHub submit 响应缺少 id",
        );
      }
      return { mode: "async", taskId: jobId, rawPayload: resp };
    }

    const body = buildProSubmitBody(req);
    const resp = await this.postPro<HunyuanSubmitResponse>(
      "/v1/ai3d/submit",
      body,
    );
    const jobId = resp.JobId;
    if (!jobId) {
      throw new CanvasGatewayError(
        "PROVIDER_INVALID_RESPONSE",
        "混元生3D submit 响应缺少 JobId",
      );
    }
    return { mode: "async", taskId: jobId, rawPayload: resp };
  }

  async pollImageTask(
    taskId: string,
    opts?: { modelKey?: string },
  ): Promise<CanvasGatewayPollResult> {
    const route = this.expressRoute(opts?.modelKey ?? "");

    if (route === "tc3") {
      const creds = tc3Credentials(this.config);
      const resp = await callAi3dTencentCloudApi<HunyuanQueryResponse>(
        creds,
        "QueryHunyuanTo3DRapidJob",
        { JobId: taskId },
      );
      return pollFromProQuery(resp);
    }

    if (route === "tokenhub") {
      const resp = await this.postTokenHub<TokenHubQueryResponse>(
        "/v1/api/3d/query",
        { model: "hy-3d-express", id: taskId },
      );
      const st = (resp.status ?? "").toLowerCase();
      if (st === "queued" || st === "in_progress") {
        return {
          state: st === "queued" ? "pending" : "running",
          rawPayload: resp,
        };
      }
      if (st === "failed") {
        return {
          state: "failed",
          errorCode: "HUNYUAN_EXPRESS_FAILED",
          errorMessage: "混元 TokenHub 任务失败",
          rawPayload: resp,
        };
      }
      if (st === "completed") {
        const files = resp.data ?? [];
        const preview =
          files.find((f) => f.preview_image_url)?.preview_image_url ??
          files.find((f) => f.url)?.url;
        const modelUrl = files.find((f) => f.url)?.url;
        const urls = [preview, modelUrl].filter(
          (u): u is string => typeof u === "string" && u.length > 0,
        );
        return {
          state: "succeeded",
          resultUrls: urls.length > 0 ? urls : undefined,
          rawPayload: resp,
        };
      }
      return { state: "pending", rawPayload: resp };
    }

    const resp = await this.postPro<HunyuanQueryResponse>("/v1/ai3d/query", {
      JobId: taskId,
    });
    return pollFromProQuery(resp);
  }
}

/** 从 poll 结果提取 UI 预览图与 3D 模型下载 URL */
export function extractHunyuan3DResultUrls(poll: CanvasGatewayPollResult): {
  previewUrl?: string;
  modelUrl?: string;
  modelType?: string;
} {
  const raw = poll.rawPayload;
  if (raw && typeof raw === "object" && "data" in raw) {
    const files = (raw as TokenHubQueryResponse).data ?? [];
    const primary = files[0];
    return {
      previewUrl: primary?.preview_image_url ?? poll.resultUrls?.[0],
      modelUrl: primary?.url ?? poll.resultUrls?.[1],
      modelType: primary?.type,
    };
  }
  const pro = raw as HunyuanQueryResponse | undefined;
  const files = pro?.ResultFile3Ds ?? [];
  const primary = files[0];
  return {
    previewUrl: primary?.PreviewImageUrl ?? poll.resultUrls?.[0],
    modelUrl: primary?.Url ?? poll.resultUrls?.[1],
    modelType: primary?.Type,
  };
}
