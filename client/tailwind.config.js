/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0066CC', hover: '#0052A3', light: '#E8F2FC', medium: '#4A90D9' },
        teal: { DEFAULT: '#007A7A', light: '#E0F5F5' },
        success: { DEFAULT: '#28A354', light: '#E3F5EA' },
        warning: { DEFAULT: '#E07820', light: '#FDF0E0' },
        danger: { DEFAULT: '#D93040', light: '#FDE8EA' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: [require('@tailwindcss/typography')]
};
