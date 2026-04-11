import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"]
      },
      maxWidth: {
        shop: "1800px"
      },
      colors: {
        brand: {
          red: "#c8191b",
          blue: "#04235a"
        }
      }
    }
  },
  plugins: []
} satisfies Config;

