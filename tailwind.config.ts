import type { Config } from 'tailwindcss';

/**
 * Lock the body + monospace stacks so numbers (countdowns, balances, ticket
 * IDs) and prose render consistently with the locally bundled pixel typeface.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /**
       * Brand color tokens — the single rebrand surface.
       *
       * MegaPlanets uses an electric-cyan space palette. A fork changes its identity by editing
       * `brand.primary` here; every `bg-brand-primary-600`,
       * `text-brand-primary-900`, etc. across `src/` updates in one place.
       *
       * Semantic colors (`amber-*`, `rose-*`, `zinc-*`) are intentionally
       * NOT brand tokens — they convey meaning (warning / error / neutral)
       * and stay stable across rebrands.
       *
       * @customize Swap the values below for your fork's brand scale (e.g.
       *            indigo, violet, sky). Generate a full 50-950 scale via
       *            https://uicolors.app/create or copy a Tailwind built-in.
       */
      colors: {
        brand: {
          primary: {
            50: 'rgb(236 254 255)',
            100: 'rgb(207 250 254)',
            200: 'rgb(165 243 252)',
            300: 'rgb(103 232 249)',
            400: 'rgb(34 211 238)',
            500: 'rgb(6 182 212)',
            600: 'rgb(8 145 178)',
            700: 'rgb(14 116 144)',
            800: 'rgb(21 94 117)',
            900: 'rgb(22 78 99)',
            950: 'rgb(8 47 73)',
          },
        },
      },
      fontFamily: {
        sans: [
          'Bitram',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'monospace',
        ],
        pixel: ['Bitram', 'ui-monospace', 'monospace'],
        mono: [
          'Bitram',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'Liberation Mono',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
