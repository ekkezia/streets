const plugin = require('tailwindcss/plugin');
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      sm: "420px",
      // => @media (min-width: 640px) { ... }

      md: "640px",
      // => @media (min-width: 768px) { ... }

      lg: "900px",
      // => @media (min-width: 1024px) { ... }

      xl: "1280px",
      // => @media (min-width: 1280px) { ... }

      "2xl": "1536px",
      // => @media (min-width: 1536px) { ... }
    },
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [
    plugin(function({ addComponents }: { addComponents: (components: Record<string, any>) => void }) {
      const newUtilities = {
        '.canvas-col-left': {
          position: 'fixed',
          width: '100vw',
          height: '50vh',
          top: '0',
          left: '0',
          '@screen sm': {
            width: '50vw',
            height: '100vh',
          }
        },
        '.canvas-col-right': {
          position: 'fixed',
          width: '100vw',
          height: '50vh',
          top: '50vh',
          left: '0',
          '@screen sm': {
            width: '50vw',
            height: '100vh',
            top: 0,
            left: '50vw'
          }
        },
      };

      addComponents(newUtilities);
    }),
  ],
};
export default config;
