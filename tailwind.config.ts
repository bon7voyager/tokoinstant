import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Neobrutalism palette. ink/paper/surface are theme-able via CSS vars
        // (see globals.css) so the whole UI flips for dark mode; the loud accent
        // colours stay fixed and pop in both themes.
        ink: "rgb(var(--ink) / <alpha-value>)", // borders, shadows, neutral text
        paper: "rgb(var(--paper) / <alpha-value>)", // page background
        surface: "rgb(var(--surface) / <alpha-value>)", // cards / inputs
        main: "#FFDB58", // mustard yellow
        secondary: "#FF6B6B", // coral red
        accent: "#4DD0E1", // cyan
        lime: "#A3E635",
        grape: "#C084FC",
        bubble: "#FF90E8", // pink
      },
      fontFamily: {
        sans: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        display: ["var(--font-archivo-black)", "var(--font-space-grotesk)", "sans-serif"],
      },
      boxShadow: {
        // Shadow colour follows --ink so it stays visible in dark mode.
        brutal: "4px 4px 0 0 rgb(var(--ink))",
        "brutal-sm": "2px 2px 0 0 rgb(var(--ink))",
        "brutal-lg": "8px 8px 0 0 rgb(var(--ink))",
        "brutal-xl": "12px 12px 0 0 rgb(var(--ink))",
      },
      borderWidth: {
        3: "3px",
      },
    },
  },
  plugins: [],
};

export default config;
