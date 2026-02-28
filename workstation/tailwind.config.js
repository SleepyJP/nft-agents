/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        void: {
          900: "#0a0a0a",
          800: "#0d0d0d",
          700: "#111111",
          600: "#1a1a1a",
          500: "#222222",
        },
        neon: {
          green: "#00ff88",
          blue: "#00d4ff",
          purple: "#a855f7",
          pink: "#ff00aa",
          red: "#ff4444",
          orange: "#ff8800",
          yellow: "#ffdd00",
          gold: "#ffd700",
        },
        element: {
          fire: "#FF4500",
          water: "#00BFFF",
          electric: "#FFD700",
          psychic: "#FF69B4",
          earth: "#228B22",
          dark: "#8B0000",
          dragon: "#FFD700",
          ghost: "#708090",
          steel: "#C0C0C0",
          nature: "#32CD32",
        },
      },
      fontFamily: {
        display: ["Orbitron", "monospace"],
        mono: ["JetBrains Mono", "monospace"],
        body: ["Inter", "sans-serif"],
      },
      backdropBlur: {
        xs: "2px",
      },
      animation: {
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "holographic": "holographic 3s ease infinite",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0, 255, 136, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(0, 255, 136, 0.6)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "holographic": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
      },
    },
  },
  plugins: [],
};
