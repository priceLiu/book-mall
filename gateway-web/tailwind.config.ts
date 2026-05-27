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
        gw: {
          bg: "#0c0c0f",
          surface: "#141419",
          border: "rgba(255,255,255,0.08)",
          ink: "#f4f4f5",
          muted: "#a1a1aa",
          accent: "#fb923c",
        },
      },
    },
  },
  plugins: [],
};

export default config;
