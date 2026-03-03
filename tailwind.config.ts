import type { Config } from "tailwindcss";
import containerQueries from '@tailwindcss/container-queries';

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#7e70fa",
        "primary-light": "#9b91fb",
        "background-light": "#f6f5f8",
        "background-dark": "#0b0a1a",
        "surface-dark": "#16142e",
        "glass": "rgba(255, 255, 255, 0.03)",
        "glass-border": "rgba(126, 112, 250, 0.2)",
        "accent-success": "#00f5a0",
        "accent-warning": "#ffd93d",
        "accent-danger": "#ff6b6b",
        "accent-info": "#00d2ff"
      },
      fontFamily: {
        "display": ["Inter", "sans-serif"],
        "mono": ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", "monospace"]
      },
      boxShadow: {
        "glass": "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        "glass-hover": "0 8px 32px 0 rgba(126, 112, 250, 0.15)",
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "2xl": "1rem",
        "full": "9999px"
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        }
      }
    },
  },
  plugins: [
    containerQueries
  ],
};

export default config;
