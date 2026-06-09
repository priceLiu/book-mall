import { randomBytes } from "crypto";

export function generateOutTradeNo(): string {
  const ts = Date.now().toString(36);
  const rand = randomBytes(4).toString("hex");
  return `pay_${ts}_${rand}`;
}
