/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Clean Light-Mode Enterprise Color Mapping
        slate: {
          950: '#F8FAFC', // Page background -> Soft light gray
          900: '#FFFFFF', // Container background -> White
          800: '#F1F5F9', // Card backgrounds -> Light gray-blue
          700: '#E2E8F0', // Border lines -> Light gray
          600: '#CBD5E1', // Inactive icons/lines
          500: '#64748B', // Regular subtext
          400: '#475569', // Body text
          300: '#334155', // Bold subtext
          200: '#1E293B', // Headers
          100: '#0F172A', // Main titles & strong text
          50: '#090D1A',  // Deep brand navy
        },
        indigo: {
          50: '#E0F2FE',  // Nav background hover / focus
          100: '#BAE6FD',
          400: '#009AC1',
          500: '#007A9A', // Brand Teal (Logo Pill Top)
          600: '#006782', // Darker Teal (Logo Pill Hover)
          700: '#005067',
          800: '#003C4F',
          900: '#002937',
        },
        emerald: {
          50: '#ECFDF5',  // Success alert bg
          400: '#10B981', // Success badge
          500: '#0F4E18', // Brand Green (Logo leaves)
          600: '#0a3810',
        },
        amber: {
          50: '#FFF7ED',  // Warning alert bg
          400: '#fb923c',
          500: '#E0530A', // Brand Orange-red (Logo pill bottom)
          600: '#c2410c',
          700: '#9a3412',
        }
      }
    },
  },
  plugins: [],
}
