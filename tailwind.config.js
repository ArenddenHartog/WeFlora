/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
    "./*.{ts,tsx,js,jsx}",
    "./components/**/*.{ts,tsx,js,jsx}",
    "./contexts/**/*.{ts,tsx,js,jsx}",
    "./services/**/*.{ts,tsx,js,jsx}",
    "./utils/**/*.{ts,tsx,js,jsx}",
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

