import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary: orange/amber — mining industrial feel (replaces cyan)
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        neon: {
          cyan: '#00f0ff',
          green: '#00ff88',
          gold: '#f59e0b',
          orange: '#fb923c',
          pink: '#ff3399',
          red: '#ff3355',
        },
        // Neutral dark — removed teal tint
        dark: {
          50: '#f9f9f9',
          100: '#e8e8e8',
          200: '#c0c0c0',
          300: '#909090',
          400: '#6a6a6a',
          500: '#444444',
          600: '#2a2a2a',
          700: '#1c1c1c',
          800: '#141414',
          900: '#0e0e0e',
          950: '#090909',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-glow': 'radial-gradient(ellipse at center, rgba(251,146,60,0.08) 0%, transparent 70%)',
        'gold-glow': 'radial-gradient(ellipse at center, rgba(245,158,11,0.06) 0%, transparent 70%)',
      },
      boxShadow: {
        'neon': '0 0 15px rgba(251, 146, 60, 0.3), 0 0 40px rgba(251, 146, 60, 0.1)',
        'neon-lg': '0 0 30px rgba(251, 146, 60, 0.4), 0 0 80px rgba(251, 146, 60, 0.15)',
        'gold': '0 0 15px rgba(245, 158, 11, 0.3), 0 0 40px rgba(245, 158, 11, 0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
