import type { Config } from "tailwindcss";

/** preflight 关闭：避免覆盖现有 `.tool-root` / `body` 工作台样式；仅用 Tailwind utilities 驱动 components/ui */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        border: "#e4e4e7",
        input: "#e4e4e7",
        ring: "#18181b",
        background: "#ffffff",
        foreground: "#18181b",
        primary: {
          DEFAULT: "#18181b",
          foreground: "#fafafa",
        },
        muted: {
          DEFAULT: "#f4f4f5",
          foreground: "#71717a",
        },
        accent: {
          DEFAULT: "#f4f4f5",
          foreground: "#18181b",
        },
      },
      borderRadius: {
        lg: "0.5rem",
        md: "calc(0.5rem - 2px)",
        sm: "calc(0.5rem - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
