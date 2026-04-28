/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        recur: {
          base: "var(--recur-base)",
          surface: "var(--recur-surface)",
          card: "var(--recur-card)",
          "purple-tint": "var(--recur-purple-tint)",
          border: "var(--recur-border)",
          "border-light": "var(--recur-border-light)",

          primary: "var(--recur-primary)",
          light: "var(--recur-light)",
          glow: "var(--recur-glow)",

          success: "var(--recur-success)",
          warning: "var(--recur-warning)",
          error: "var(--recur-error)",

          "text-heading": "var(--recur-text-heading)",
          "text-subheading": "var(--recur-text-subheading)",
          "text-body": "var(--recur-text-body)",
          "text-muted": "var(--recur-text-muted)",
          "text-dim": "var(--recur-text-dim)",
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
        pageEnter: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        modalBackdrop: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        modalEnter: {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
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
        "page-enter": "pageEnter 0.28s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "fade-in": "fadeIn 0.2s ease-out forwards",
        "modal-backdrop": "modalBackdrop 0.18s ease-out forwards",
        "modal-enter": "modalEnter 0.22s cubic-bezier(0.22, 1, 0.36, 1) forwards",
      },
      maxWidth: {
        container: "1120px",
      },
    },
  },
  plugins: [],
};
