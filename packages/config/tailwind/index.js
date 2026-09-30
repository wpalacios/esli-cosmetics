/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [],
  theme: {
    extend: {
      colors: {
        // Esli Cosmetics Brand Colors
        primary: {
          50: "#fef2f7",
          100: "#fde6f0",
          200: "#faccde",
          300: "#f7a1c4",
          400: "#f369a6",
          500: "#ff48b0", // Wild Strawberry - Main brand color
          600: "#e63095",
          700: "#c11f7a",
          800: "#a11d65",
          900: "#881c57",
          950: "#530a30",
        },
        secondary: {
          50: "#fef7f3",
          100: "#fef0e8",
          200: "#fdddc6",
          300: "#fbc199",
          400: "#f8966a",
          500: "#f5b1cc", // Pink Chalk - Secondary brand color
          600: "#e04e39",
          700: "#bc3426",
          800: "#9c2a22",
          900: "#7f2420",
          950: "#441009",
        },
        // Neutral colors for backgrounds and text
        neutral: {
          50: "#fafafa",
          100: "#f5f5f5",
          200: "#e5e5e5",
          300: "#d4d4d4",
          400: "#a3a3a3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          900: "#171717",
          950: "#0a0a0a",
        },
        // Semantic colors
        success: {
          50: "#f0fdf4",
          100: "#dcfce7",
          300: "#86efac",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
        warning: {
          50: "#fffbeb",
          100: "#fef3c7",
          300: "#fcd34d",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        error: {
          50: "#fef2f2",
          100: "#fee2e2",
          300: "#fca5a5",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
        },
        // Semantic text colors (CSS variable-driven for dark mode)
        muted: {
          foreground: "var(--muted-foreground)",
        },
        // Glassmorphism support
        glass: {
          white: "rgba(255, 255, 255, 0.1)",
          primary: "rgba(255, 72, 176, 0.1)",
          secondary: "rgba(245, 177, 204, 0.1)",
        },
      },
      fontFamily: {
        // Typography following brand guidelines
        heading: ["Prettywise", "Gotham", "Bebas Neue", "sans-serif"],
        body: ["Century Gothic", "Poppins", "sans-serif"],
        sans: ["Century Gothic", "Poppins", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Responsive font scaling
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
        "5xl": ["3rem", { lineHeight: "1" }],
        "6xl": ["3.75rem", { lineHeight: "1" }],
        "7xl": ["4.5rem", { lineHeight: "1" }],
        "8xl": ["6rem", { lineHeight: "1" }],
        "9xl": ["8rem", { lineHeight: "1" }],
      },
      spacing: {
        // Additional spacing values for better layout control
        18: "4.5rem",
        88: "22rem",
        112: "28rem",
        128: "32rem",
      },
      borderRadius: {
        // Modern, rounded design language
        "4xl": "2rem",
        "5xl": "2.5rem",
        "6xl": "3rem",
      },
      boxShadow: {
        // Glassmorphism and elevation shadows
        glass: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
        "glass-sm": "0 2px 16px 0 rgba(31, 38, 135, 0.37)",
        elevation: "0 4px 20px 0 rgba(0, 0, 0, 0.1)",
        "elevation-lg": "0 10px 40px 0 rgba(0, 0, 0, 0.15)",
      },
      backdropBlur: {
        xs: "2px",
      },
      backgroundImage: {
        // Gradient patterns for buttons and backgrounds
        "gradient-primary": "linear-gradient(135deg, #ff48b0 0%, #f5b1cc 100%)",
        "gradient-primary-hover":
          "linear-gradient(135deg, #e63095 0%, #f8966a 100%)",
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      animation: {
        // Microinteractions and smooth transitions
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    // require("@tailwindcss/forms"), // Temporarily disabled
    // require("@tailwindcss/typography"), // Temporarily disabled
  ],
};
