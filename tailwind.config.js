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
          amber: "#F59E0B",
          red: "#EF4444",
        },
      },
    },
  },
  plugins: [],
}

