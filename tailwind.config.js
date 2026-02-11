/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./components/**/*.{ts,tsx}",
    "./contexts/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
    "./utils/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        weflora: {
          teal: "#159F9A",
          dark: "#0E7A76",
          mint: "#E8F6F5",
          mintLight: "#F2FAF9",
          success: "#10B981",
          // Muted palette — in sync with minted green; desaturated, professional
          amber: "#B89B5E",
          amberDark: "#8B7347",
          amberLight: "#F5EED9",
          red: "#B87B7B",
          redDark: "#8B5A5A",
          redLight: "#F5E8E8",
          rose: "#B87B85",
          roseDark: "#8B5A62",
          roseLight: "#F5E8EB",
          emerald: "#0E9A8F",
          emeraldLight: "#E2F2F1",
          violet: "#7B8BB8",
          violetDark: "#5A6A8B",
          violetLight: "#E8EBF5",
        },
      },
    },
  },
  plugins: [],
}

