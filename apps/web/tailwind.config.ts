import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  safelist: ['hover:bg-white/3', 'bg-white/3', 'bg-white/2', 'bg-emerald-500/8'],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: '#ffffff',
          surface: '#09090b',
          'surface-light': '#18181b',
          primary: '#10b981',
          accent: '#6366f1',
          danger: '#ef4444',
          warning: '#f59e0b',
          success: '#10b981',
          card: 'rgba(24, 24, 27, 0.65)',
          'card-hover': 'rgba(39, 39, 42, 0.85)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Outfit', 'Inter', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
