import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          bg: "#141414",
          surface: "#13131f",
          border: "rgba(255,255,255,0.08)",
          ink: "#f5f5f7",
          muted: "#a3a3b3",
          accent: "#238636",
        },
        libtv: {
          media: "#262626",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "Noto Sans SC",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
