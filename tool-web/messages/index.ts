import { en } from "./en";
import { zh } from "./zh";

export const messages = {
  zh,
  en,
} as const;

export type ToolMessagesLocale = keyof typeof messages;

export type AiFitMsgKey = keyof typeof zh.aiFit;

export function aiFitLabel(locale: ToolMessagesLocale, key: AiFitMsgKey): string {
  return messages[locale].aiFit[key];
}
