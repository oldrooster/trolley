/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f7f3',
          100: '#d8ecdf',
          200: '#b3d9c1',
          300: '#85bf9d',
          400: '#5ba37a',
          500: '#4a8a66',
          600: '#3a6f52',
          700: '#2f5942',
          800: '#274835',
          900: '#1e3828',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
