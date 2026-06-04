import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ecom: {
          primary: "var(--ecom-primary)",
          ink: "var(--ecom-ink)",
          parchment: "var(--ecom-parchment)",
          tile: "var(--ecom-tile)",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Noto Sans SC",
          "sans-serif",
        ],
      },
      borderRadius: {
        "ecom-pill": "9999px",
        "ecom-lg": "18px",
      },
    },
  },
  plugins: [],
};
export default config;
