import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        forest: { 50: "#eff8f1", 100: "#d9efdf", 200: "#b8dfc2", 500: "#22a05a", 600: "#187c45", 700: "#14532d", 800: "#104326", 900: "#0a2f1b" },
        ink: "#26342d",
        muted: "#68766e",
        canvas: "#f4f7f4",
      },
      fontFamily: { sans: ["var(--font-jakarta)", "Arial", "sans-serif"] },
      boxShadow: { soft: "0 8px 32px rgba(22, 54, 36, .07)" },
    },
  },
  plugins: [],
};
export default config;
