/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#071727',
          900: '#0b1f36',
          800: '#12304e',
          700: '#1c4569',
        },
        teal: {
          700: '#087f7a',
          600: '#0d9488',
          500: '#14a99d',
          100: '#ccfbf1',
        },
      },
      boxShadow: {
        panel: '0 1px 2px rgba(7, 23, 39, 0.05), 0 8px 24px rgba(7, 23, 39, 0.05)',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

