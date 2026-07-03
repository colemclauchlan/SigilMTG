/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // ── Sigil / Arcane Foil design tokens ──────────────────────────────
      colors: {
        // base surfaces
        navy:     { DEFAULT: '#070d1a', 2: '#0a1322' },
        ink:      { DEFAULT: '#0e1a2e', 2: '#142440', 3: '#1b2f50', 4: '#27436b' },
        // text
        paper:    { DEFAULT: '#eef4ff', dim: '#c2d2e8' },
        muted:    '#90a4c2',
        faint:    '#62748f',
        // brand accent (azure)
        brand:    { DEFAULT: '#4da3ff', bright: '#8fd0ff', deep: '#1f6fc0', soft: 'rgba(77,163,255,0.16)' },
        // mana
        mana: {
          w: '#eef0ea',
          u: '#4aa3e6',
          b: '#9b86c4',
          r: '#e0655c',
          g: '#46b277',
        },
        // semantic aliases
        danger:   '#e0655c',
        success:  '#46b277',
        line:     '#22344f',
        hairline: 'rgba(120,170,230,0.16)',
      },
      fontFamily: {
        display: ['"Cinzel"', '"Cormorant Garamond"', 'Georgia', 'serif'],
        serif:   ['"Cormorant Garamond"', 'Georgia', '"Times New Roman"', 'serif'],
        body:    ['"Inter"', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono:    ['"Spline Sans Mono"', 'ui-monospace', '"SFMono-Regular"', 'monospace'],
      },
      borderRadius: {
        xs:   '6px',
        sm:   '9px',
        md:   '13px',
        card: '14px',
        lg:   '18px',
        xl:   '26px',
        pill: '999px',
      },
      boxShadow: {
        sm:   '0 1px 2px rgba(0,0,0,0.45)',
        md:   '0 10px 28px rgba(2,8,20,0.55)',
        lg:   '0 26px 64px rgba(2,8,20,0.62)',
        glow: '0 0 0 1px rgba(77,163,255,0.35), 0 0 26px rgba(77,163,255,0.22)',
        'glow-soft': '0 0 30px rgba(77,163,255,0.12)',
      },
      backgroundImage: {
        'foil-gradient': 'linear-gradient(105deg, #8fd0ff 0%, #eaf4ff 15%, #a9eef0 32%, #9fb6ff 52%, #c7b9ff 68%, #8fd0ff 84%, #f2f8ff 100%)',
        'body-bg': 'radial-gradient(120% 80% at 50% -10%, rgba(77,163,255,0.14), transparent 55%), linear-gradient(180deg, #070d1a 0%, #091327 52%, #060b16 100%)',
      },
      transitionTimingFunction: {
        'ease-out': 'cubic-bezier(0.16,1,0.3,1)',
        'spring':   'cubic-bezier(0.34,1.4,0.5,1)',
      },
      transitionDuration: {
        fast: '130ms',
        DEFAULT: '220ms',
        slow: '460ms',
      },
    },
  },
  plugins: [],
}
