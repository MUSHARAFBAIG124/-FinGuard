import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: '#111827',
          surface: '#f8fafc',
          primary: '#0f766e',
          accent: '#2563eb',
          danger: '#b91c1c',
          warning: '#b45309',
          success: '#15803d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
