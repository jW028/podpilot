import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    fontFamily: {
      serif: ["Playfair Display", "serif"],
      sans: ["Inter", "sans-serif"],
    },
    extend: {
      colors: {
        // primary brand color (gold)
        primary: {
          50: "#faf8f3",
          100: "#f5f0e3",
          200: "#ede4c7",
          300: "#e1d4a8",
          400: "#d4be7f",
          500: "#C9A84C", // main primary
          600: "#b39643",
          700: "#9d8239",
          800: "#87702f",
          900: "#6b5824",
        },

        // neutral palette (light theme primary)
        neutral: {
          50: "#fafaf8",
          100: "#f4f3ef",
          200: "#f7f6f2",
          300: "#ede8e0",
          400: "#9a9894",
          500: "#6b6864",
          900: "#141412",
        },

        // custom light/dark utilities
        light: "#f7f6f2",
        "light-secondary": "#f4f3ef",
        "light-tertiary": "#fafaf8",
        dark: "#141412",
        "light-primary": "#141412",
        "light-muted": "#6b6864",
      },
    },
  },
  plugins: [],
} satisfies Config;
