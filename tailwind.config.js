/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./popup.html",
    "./sidepanel.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sf: {
          blue: '#0176D3',
          'blue-dark': '#014486',
          'blue-light': '#F4F6F9',
          navy: '#032D60',
          cloud: '#1589EE',
          slate: '#706E6B',
          border: '#D8D8D8',
          success: '#2E844A',
          warning: '#FE9339',
          error: '#EA001E',
          surface: '#F3F3F3'
        }
      }
    },
  },
  plugins: [],
}
