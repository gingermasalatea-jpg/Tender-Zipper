import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#EEF2FF', 100: '#E0E7FF', 600: '#2546A8', 700: '#1E3A8A', 800: '#172E6E', 900: '#0F1F4D' },
        accent: { 400: '#FBBF24', 500: '#F59E0B', 600: '#D97706' },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Gujarati', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
