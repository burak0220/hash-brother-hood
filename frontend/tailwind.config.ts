import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#00f0ff',
          500: '#00d4e0',
          600: '#00b8c4',
          700: '#009aa3',
          800: '#007a82',
          900: '#005c62',
          950: '#003a3f',
        },
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#f0b000',
          500: '#d4990a',
          600: '#b47d08',
          700: '#8a6006',
          800: '#6b4a05',
          900: '#4a3304',
          950: '#2d1f02',
        },
        neon: {
          cyan: '#00f0ff',
          green: '#00ff88',
          gold: '#f0b000',
          pink: '#ff3399',
          red: '#ff3355',
        },
        dark: {
          50: '#e0f0f0',
          100: '#b0d0d0',
          200: '#80a8a8',
          300: '#608888',
          400: '#406868',
          500: '#2a4a4a',
          600: '#1a3232',
          700: '#0f1e24',
          800: '#0a1418',
          900: '#060d10',
          950: '#050a0e',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-glow': 'radial-gradient(ellipse at center, rgba(0,240,255,0.08) 0%, transparent 70%)',
        'gold-glow': 'radial-gradient(ellipse at center, rgba(240,176,0,0.06) 0%, transparent 70%)',
      },
      boxShadow: {
        'neon': '0 0 15px rgba(0, 240, 255, 0.3), 0 0 40px rgba(0, 240, 255, 0.1)',
        'neon-lg': '0 0 30px rgba(0, 240, 255, 0.4), 0 0 80px rgba(0, 240, 255, 0.15)',
        'gold': '0 0 15px rgba(240, 176, 0, 0.3), 0 0 40px rgba(240, 176, 0, 0.1)',
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
