const animate = require("tailwindcss-animate");

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  safelist: ["dark"],
  prefix: "",

  content: [
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],

  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "collapsible-down": {
          from: { height: 0 },
          to: { height: "var(--radix-collapsible-content-height)" },
        },
        "collapsible-up": {
          from: { height: "var(--radix-collapsible-content-height)" },
          to: { height: 0 },
        },
        /** /tools-open AI 过渡动画 */
        "tools-gear-spin": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "tools-bot-run": {
          "0%, 100%": {
            transform: "translateX(-1.15rem) translateY(3px) rotate(-12deg)",
          },
          "50%": {
            transform: "translateX(1.15rem) translateY(-9px) rotate(12deg)",
          },
        },
        "tools-scan-line": {
          "0%, 100%": { opacity: "0.35", transform: "scaleX(0.82)" },
          "50%": { opacity: "0.95", transform: "scaleX(1)" },
        },
        "tools-text-shimmer": {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        orbit: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        ripple: {
          "0%, 100%": { transform: "translate(-50%, -50%) scale(1)" },
          "50%": { transform: "translate(-50%, -50%) scale(0.9)" },
        },
        "pulse-ring": {
          "0%": { transform: "translate(-50%, -50%) scale(0.88)", opacity: "0.35" },
          "100%": { transform: "translate(-50%, -50%) scale(1.08)", opacity: "0" },
        },
        "auth-float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        "gradient-border": {
          "0%, 100%": {
            borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%",
          },
          "25%": {
            borderRadius: "58% 42% 75% 25% / 76% 24% 76% 24%",
          },
          "50%": {
            borderRadius: "50% 50% 33% 67% / 55% 27% 73% 45%",
          },
          "75%": {
            borderRadius: "33% 67% 58% 42% / 63% 37% 63% 37%",
          },
        },
        "gradient-1": {
          "0%, 100%": { transform: "translate(0%, 0%) scale(1)" },
          "50%": { transform: "translate(20%, -25%) scale(1.1)" },
        },
        "gradient-2": {
          "0%, 100%": { transform: "translate(0%, 0%) scale(1)" },
          "50%": { transform: "translate(-25%, 25%) scale(1.15)" },
        },
        "gradient-3": {
          "0%, 100%": { transform: "translate(0%, 0%) scale(1)" },
          "50%": { transform: "translate(25%, 25%) scale(1.1)" },
        },
        "gradient-4": {
          "0%, 100%": { transform: "translate(0%, 0%) scale(1)" },
          "50%": { transform: "translate(-20%, -25%) scale(1.2)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "collapsible-down": "collapsible-down 0.2s ease-in-out",
        "collapsible-up": "collapsible-up 0.2s ease-in-out",
        "tools-gear-spin-cw": "tools-gear-spin 2.75s linear infinite",
        "tools-gear-spin-ccw": "tools-gear-spin 2.2s linear infinite reverse",
        "tools-gear-spin-slow": "tools-gear-spin 3.9s linear infinite",
        "tools-bot-run": "tools-bot-run 0.78s ease-in-out infinite",
        "tools-scan-line": "tools-scan-line 1.6s ease-in-out infinite",
        "tools-text-shimmer": "tools-text-shimmer 2.9s linear infinite",
        orbit: "orbit calc(var(--duration) * 1s) linear infinite",
        ripple: "ripple 8s ease calc(var(--delay, 0) * 1s) infinite",
        "pulse-ring": "pulse-ring 4s ease-out calc(var(--delay, 0) * 1s) infinite",
        "auth-float": "auth-float 5s ease-in-out calc(var(--delay, 0) * 1s) infinite",
        "gradient-border": "gradient-border 6s ease-in-out infinite",
        "gradient-1": "gradient-1 12s ease-in-out infinite alternate",
        "gradient-2": "gradient-2 12s ease-in-out infinite alternate",
        "gradient-3": "gradient-3 12s ease-in-out infinite alternate",
        "gradient-4": "gradient-4 12s ease-in-out infinite alternate",
      },
    },
  },
  plugins: [animate],
};
