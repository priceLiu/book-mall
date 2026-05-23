"use strict";

const API_PATH = "/api/story/kie/poll";

async function run() {
  console.log("[poll] start", new Date().toISOString());

  const token = process.env.STORY_AI_POLL_TOKEN;
  if (!token) {
    const msg = "STORY_AI_POLL_TOKEN not set in cloud function env";
    console.error("[poll]", msg);
    return { ok: false, error: msg };
  }

  const host = (process.env.BOOK_MALL_HOST || "book.ai-code8.com").replace(
    /^https?:\/\//,
    "",
  );
  const url = `https://${host}${API_PATH}`;
  console.log("[poll] POST", url);

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(55000),
  });

  const body = await res.text();
  const result = {
    ok: res.ok,
    status: res.status,
    body: body.slice(0, 2000),
    url,
  };
  console.log("[poll] done", JSON.stringify(result));
  return result;
}

async function handler() {
  try {
    return await run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[poll] error", message);
    return { ok: false, error: message };
  }
}

exports.main = handler;
exports.main_handler = handler;
