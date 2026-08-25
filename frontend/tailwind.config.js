/**
 * =============================================================================
 * Module: frontend/tailwind.config.js
 * Purpose: Tailwind CSS configuration with Silk Cloud dark neomorphic design tokens,
 *          color palette, typography scale, spacing, and border-radius.
 * Used by: Tailwind CSS PostCSS pipeline
 * Dependencies: tailwindcss
 * Public Members: theme.extend.colors, theme.extend.fontSize, theme.extend.fontFamily
 * Side Effects: Defines design system tokens for all Tailwind utility classes.
 * =============================================================================
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Silk Cloud Dark Neomorphic Palette ── */
        background: "#0b1326",
        "surface-base": "#0f172a",
        "surface-container": "#171f33",
        "surface-container-low": "#131b2e",
        "surface-container-high": "#222a3d",
        "surface-container-highest": "#2d3449",
        "surface-container-lowest": "#060e20",
        "surface-elevated": "#161e2e",
        "surface-variant": "#2d3449",
        "surface-bright": "#31394d",

        "on-surface": "#dae2fd",
        "on-surface-variant": "#c7c4d7",

        primary: "#c0c1ff",
        "primary-container": "#8083ff",
        "on-primary": "#1000a9",
        "inverse-primary": "#494bd6",
        "glow-indigo": "#818cf8",

        secondary: "#bcc7de",
        "secondary-container": "#3e495d",
        "on-secondary": "#263143",

        tertiary: "#ffb783",
        "tertiary-container": "#d97721",
        "on-tertiary": "#4f2500",

        error: "#ffb4ab",
        "error-container": "#93000a",
        "on-error": "#690005",

        outline: "#908fa0",
        "outline-variant": "#464554",

        "shadow-dark": "#060910",
        "shadow-light": "#1e293b",

        "inverse-surface": "#dae2fd",
        "inverse-on-surface": "#283044",

        /* ── Legacy brand (keep for backwards compat) ── */
        brand: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          500: "#818cf8",
          600: "#6366f1",
          700: "#4f46e5",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      fontSize: {
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "500" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "500" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "500" }],
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "600" }],
        "label-lg": ["14px", { lineHeight: "20px", letterSpacing: "0.05em", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-xl": ["40px", { lineHeight: "48px", letterSpacing: "-0.02em", fontWeight: "600" }],
      },
      spacing: {
        gutter: "24px",
        "margin-mobile": "16px",
        "margin-desktop": "48px",
      },
      borderRadius: {
        neo: "0.75rem",
        "neo-lg": "1.5rem",
        "neo-xl": "2rem",
      },
    },
  },
  plugins: [],
}
