export { PlatformAssistant } from "./platform-assistant";
export type { PlatformAssistantProps } from "./platform-assistant";
export {
  buildAssistantGreeting,
  buildDailyOpener,
  parseDisplayName,
  pickRandomJoke,
} from "./greeting";
export type { AssistantGreeting, GreetingUser } from "./greeting";
export {
  buildPlatformAppLinks,
  PLATFORM_APP_DEFINITIONS,
} from "./platform-apps";
export type { PlatformAppLink } from "./platform-apps";
export {
  clearPrefetchedAiNewsForTests,
  getPrefetchedAiNews,
  prefetchAiNews,
} from "./ai-news-prefetch";
export type { PrefetchedAiNews } from "./ai-news-prefetch";
