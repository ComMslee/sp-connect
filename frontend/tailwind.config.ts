import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#3B82F6', light: '#93C5FD', dark: '#1D4ED8' },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        point: { earn: '#10B981', use: '#EF4444', expire: '#9CA3AF' },
      },
    },
  },
  plugins: [],
};
export default config;
