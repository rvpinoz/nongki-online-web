import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#0d0f12", 900: "#14171c", 800: "#1c2027", 700: "#272c35", 600: "#363c47" },
        accent: { DEFAULT: "#2dd4a7", dark: "#14b88c" },
        danger: { DEFAULT: "#ef4444", dark: "#dc2626" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
