/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        recur: {
          base: "#08080F",
          surface: "#0D0D14",
          card: "#12121C",
          "purple-tint": "#1E1535",
          border: "#2A2A3E",
          "border-light": "#3D2D70",

          "deep-purple": "#4C1D95",
          primary: "#7C3AED",
          "mid-purple": "#8B5CF6",
          light: "#A78BFA",
          glow: "#C084FC",

          success: "#34D399",
          warning: "#F59E0B",
          error: "#F87171",
          sgreen: "#14F195",
          spurple: "#9945FF",

          "text-heading": "#F8F8FF",
          "text-subheading": "#C4C4D4",
          "text-body": "#8B8BA7",
          "text-muted": "#6B6B8A",
          "text-dim": "#4B4B6B",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": {
            transform: "scale(1)",
            boxShadow: "0 0 0 0 rgba(20, 241, 149, 0.5)",
          },
          "50%": {
            transform: "scale(1.15)",
            boxShadow: "0 0 0 6px rgba(20, 241, 149, 0)",
          },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(-12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        glowPulse: {
          "0%, 100%": {
            boxShadow: "0 0 20px rgba(124, 58, 237, 0.15)",
          },
          "50%": {
            boxShadow: "0 0 40px rgba(124, 58, 237, 0.3)",
          },
        },
        txFade: {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        dotPulse: {
          "0%, 100%": {
            boxShadow: "0 0 0 0 rgba(52, 211, 153, 0.7)",
          },
          "50%": {
            boxShadow: "0 0 0 6px rgba(52, 211, 153, 0)",
          },
        },
      },
      animation: {
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
        "fade-in-up": "fadeInUp 0.6s ease-out forwards",
        "slide-in-right": "slideInRight 0.5s ease-out forwards",
        float: "float 6s ease-in-out infinite",
        "glow-pulse": "glowPulse 3s ease-in-out infinite",
        "tx-fade": "txFade 0.4s ease-out forwards",
        "dot-pulse": "dotPulse 2s ease-in-out infinite",
      },
      maxWidth: {
        container: "1120px",
      },
    },
  },
  plugins: [],
};
