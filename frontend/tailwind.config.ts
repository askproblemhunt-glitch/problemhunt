import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: { 950: "#03050a", 900: "#060a13", 800: "#0b1220", 700: "#111a2e", 600: "#1a2540" },
        neon: { cyan: "#22d3ee", mint: "#34d399", rose: "#f43f5e", amber: "#fbbf24", orange: "#fb923c", sky: "#38bdf8" },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "JetBrains Mono", "Menlo", "Consolas", "monospace"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      keyframes: {
        sweep: { to: { transform: "rotate(360deg)" } },
        slidein: { from: { opacity: "0", transform: "translateY(-8px)" }, to: { opacity: "1", transform: "none" } },
        ping2: { "0%": { transform: "scale(1)", opacity: ".9" }, "100%": { transform: "scale(3.2)", opacity: "0" } },
        alarm: { "0%,100%": { opacity: ".35" }, "50%": { opacity: "1" } },
      },
      animation: {
        sweep: "sweep 4s linear infinite",
        slidein: "slidein .45s ease-out both",
        ping2: "ping2 1.8s ease-out infinite",
        alarm: "alarm 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
