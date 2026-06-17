/** @type {import('tailwindcss').Config} */
module.exports = {
  // Incluye todos los archivos .js,.jsx,.ts,.tsx dentro de app/ y posibles componentes
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
  darkMode: 'class',
}