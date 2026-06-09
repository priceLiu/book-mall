/** 将 JSON body 转为 FormData，供复用 server actions。 */
export function bodyToFormData(body: Record<string, unknown>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "boolean") {
      if (v) fd.set(k, "true");
      else if (k === "active") fd.set(k, "false");
    } else {
      fd.set(k, String(v));
    }
  }
  return fd;
}
