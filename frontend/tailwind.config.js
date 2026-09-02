/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAFAFA",
        surface: "#FFFFFF",
        ink: "#14161B",
        subtle: "#5B6270",
        line: "#E3E5E9",
        accent: {
          DEFAULT: "#2451FF",
          hover: "#1D40D6",
          soft: "#EEF2FF",
        },
        success: { DEFAULT: "#147A52", soft: "#E9F6EF" },
        warning: { DEFAULT: "#B7791F", soft: "#FCF3E3" },
        danger: { DEFAULT: "#C0362C", soft: "#FBEAE9" },
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
        lg: "8px",
      },
      boxShadow: {
        subtle: "0 1px 2px rgba(20, 22, 27, 0.04)",
        card: "0 1px 3px rgba(20, 22, 27, 0.06)",
      },
    },
  },
  plugins: [],
};
