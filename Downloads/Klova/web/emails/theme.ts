import type { TailwindConfig } from "react-email";
import plugin from "tailwindcss/plugin";

// Klova email brand tokens. The two brand colors (brand / accent) are taken
// directly from public/logo.svg's fill values. That SVG is the one place
// the exact brand color is unambiguous, so it's a more reliable source than
// re-deriving from the app's OKLCH CSS variables (email clients can't render
// oklch() anyway; everything here must resolve to plain hex).
//
// Everything else (backgrounds, text grays, hairlines) is a close, email-safe
// approximation of web/app/globals.css's --surface-card / --text-* /
// --border-default tokens. Exact precision doesn't matter for near-neutral
// tones the way it does for the two brand colors.
const colors = {
  bg: "#FFFFFF",
  "bg-2": "#F3F1EC",
  fg: "#1A1A1A",
  "fg-2": "#4A4A4A",
  "fg-3": "#767676",
  "fg-inverted": "#FFFFFF",
  stroke: "#ECE8DF",
  "stroke-strong": "#E0DACC",
  brand: "#113E28",
  "brand-content": "#FFFFFF",
  accent: "#F59A00",
  "accent-content": "#1A1A1A",
} as const;

// Matches web/app/layout.tsx's next/font choices: DM Serif Display for
// headings, Plus Jakarta Sans for body copy.
const fontScale = {
  11: { fontSize: "11px", fontWeight: "400", lineHeight: "1.5" },
  13: { fontSize: "13px", fontWeight: "400", lineHeight: "1.5" },
  14: { fontSize: "14px", fontWeight: "500", lineHeight: "1.5" },
  16: { fontSize: "16px", fontWeight: "400", lineHeight: "1.5" },
  20: { fontSize: "20px", fontWeight: "600", lineHeight: "1.3" },
  28: { fontSize: "28px", fontWeight: "400", lineHeight: "1.25" },
  36: { fontSize: "36px", fontWeight: "400", lineHeight: "1.15" },
} as const;

export const klovaTailwindConfig: TailwindConfig = {
  plugins: [
    plugin(({ addUtilities, addVariant }) => {
      addVariant("mobile", "@media (max-width: 600px)");
      const utilities: Record<string, Record<string, string>> = {};
      for (const [step, token] of Object.entries(fontScale)) {
        utilities[`.font-${step}`] = token;
      }
      addUtilities(utilities);
    }),
  ],
  theme: {
    extend: {
      colors,
      fontFamily: {
        // Body copy
        sans: ["Plus Jakarta Sans", "Arial", "sans-serif"],
        // Headings, matches the app's --font-dm-serif
        serif: ["DM Serif Display", "Georgia", "serif"],
      },
    },
  },
};
