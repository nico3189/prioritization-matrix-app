/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#0B1120',
          surface: '#0F172A',
          card: '#111827',
          muted: '#94A3B8',
          accent: '#3B82F6',
          success: '#22C55E',
          danger: '#EF4444',
        },
      },
      boxShadow: {
        card: '0 10px 30px rgba(0,0,0,0.35)',
        hover: '0 14px 40px rgba(0,0,0,0.45)',
      },
      borderRadius: {
        xl2: '8px',
      },
    },
  },
  plugins: [],
}
