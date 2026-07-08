import {
  dashscopeCreateImage2ImageTask,
  dashscopeCreateOutPaintingTask,
  dashscopeExtractAllTaskImageUrls,
  dashscopeGetTask,
  isDashscopeTaskFailed,
  isDashscopeTaskSuccess,
} from "@/lib/gateway/dashscope-client";

const DEFAULT_MAX_WAIT_MS = 120_000;
const DEFAULT_POLL_MS = 3_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function dashscopePollTaskUntilDone(opts: {
  apiKey: string;
  taskId: string;
  maxWaitMs?: number;
  pollIntervalMs?: number;
}): Promise<
  | { ok: true; imageUrls: string[]; usage?: unknown }
  | { ok: false; error: string }
> {
  const deadline = Date.now() + (opts.maxWaitMs ?? DEFAULT_MAX_WAIT_MS);
  const pollMs = opts.pollIntervalMs ?? DEFAULT_POLL_MS;

  while (Date.now() < deadline) {
    const polled = await dashscopeGetTask({
      apiKey: opts.apiKey,
      taskId: opts.taskId,
    });
    if (!polled.ok) return { ok: false, error: polled.error };

    const status = polled.output.task_status;
    if (isDashscopeTaskSuccess(status)) {
      const imageUrls = dashscopeExtractAllTaskImageUrls(
        polled.output as unknown as Record<string, unknown>,
      );
      if (imageUrls.length === 0) {
        return { ok: false, error: "任务成功但未返回图像 URL" };
      }
      const usage = (polled.raw as Record<string, unknown> | null)?.usage;
      return { ok: true, imageUrls, usage };
    }
    if (isDashscopeTaskFailed(status)) {
      const msg =
        polled.output.message ??
        polled.output.code ??
        `任务失败（${status ?? "FAILED"}）`;
      return { ok: false, error: msg };
    }
    await sleep(pollMs);
  }
  return { ok: false, error: "DashScope 异步图像任务超时" };
}

export async function dashscopeOutPaintingGenerate(opts: {
  apiKey: string;
  imageUrl: string;
  parameters?: Record<string, unknown>;
}): Promise<
  | { ok: true; imageUrls: string[]; usage?: unknown }
  | { ok: false; error: string }
> {
  const created = await dashscopeCreateOutPaintingTask({
    apiKey: opts.apiKey,
    imageUrl: opts.imageUrl,
    parameters: opts.parameters,
  });
  if (!created.ok) return created;
  return dashscopePollTaskUntilDone({
    apiKey: opts.apiKey,
    taskId: created.taskId,
  });
}

export async function dashscopeImage2ImageGenerate(opts: {
  apiKey: string;
  model: string;
  input: Record<string, unknown>;
  parameters?: Record<string, unknown>;
}): Promise<
  | { ok: true; imageUrls: string[]; usage?: unknown }
  | { ok: false; error: string }
> {
  const created = await dashscopeCreateImage2ImageTask({
    apiKey: opts.apiKey,
    model: opts.model,
    input: opts.input,
    parameters: opts.parameters,
  });
  if (!created.ok) return created;
  return dashscopePollTaskUntilDone({
    apiKey: opts.apiKey,
    taskId: created.taskId,
  });
}
