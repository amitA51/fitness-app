/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      /* ── Color tokens ──────────────────────────────────────────────────── */
      colors: {
        // Semantic theme colors (driven by CSS variables)
        primary:          'var(--color-primary)',
        secondary:        'var(--color-secondary)',
        accent:           'var(--color-accent)',
        background:       'var(--color-background)',
        surface:          'var(--color-surface)',
        text:             'var(--color-text)',
        'text-secondary': 'var(--color-text-secondary)',
        success:          'var(--color-success)',
        warning:          'var(--color-warning)',
        error:            'var(--color-error)',

        // Apple OLED surface scale (static tokens)
        'surface-1': '#111111',
        'surface-2': '#1C1C1E',
        'surface-3': '#2C2C2E',

        // Label / text scale
        'label-secondary': '#8E8E93',
        'label-tertiary':  '#48484A',

        // Separator
        'separator': '#38383A',

        // Apple system colors (static — available as bg-apple-blue, etc.)
        apple: {
          blue:   '#0A84FF',
          indigo: '#5E5CE6',
          purple: '#BF5AF2',
          pink:   '#FF375F',
          red:    '#FF453A',
          orange: '#FF9F0A',
          yellow: '#FFD60A',
          green:  '#30D158',
          teal:   '#5AC8FA',
          cyan:   '#64D2FF',
        },
      },

      /* ── Typography ────────────────────────────────────────────────────── */
      fontFamily: {
        sans:       ['Barlow', 'system-ui', '-apple-system', 'sans-serif'],
        condensed:  ['Barlow Condensed', 'Barlow', 'system-ui', 'sans-serif'],
        mono:       ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },

      /* ── Border radius ─────────────────────────────────────────────────── */
      borderRadius: {
        '2.5xl': '20px',   // card radius
        '3xl':   '24px',   // large card
        '4xl':   '32px',   // extra large
      },

      /* ── Box shadows ───────────────────────────────────────────────────── */
      boxShadow: {
        'card':     '0 2px 8px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
        'elevated': '0 8px 32px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.6)',
        'glow':     '0 0 24px rgba(10,132,255,0.25)',
        'glow-sm':  '0 0 12px rgba(10,132,255,0.2)',
        'glow-lg':  '0 0 48px rgba(10,132,255,0.3)',
        'inner-sm': 'inset 0 1px 0 rgba(255,255,255,0.06)',
      },

      /* ── Backdrop blur ─────────────────────────────────────────────────── */
      backdropBlur: {
        xs:  '4px',
        sm:  '8px',
        md:  '12px',
        lg:  '16px',
        xl:  '20px',
        '2xl': '24px',
        '3xl': '40px',
      },

      /* ── Backdrop saturate ─────────────────────────────────────────────── */
      backdropSaturate: {
        150: '1.5',
        180: '1.8',
        200: '2',
      },

      /* ── Animations ────────────────────────────────────────────────────── */
      animation: {
        'fade-in':     'fadeIn 0.25s ease-out both',
        'slide-up':    'slideUp 0.3s cubic-bezier(0.25,0.46,0.45,0.94) both',
        'slide-down':  'slideDown 0.25s cubic-bezier(0.25,0.46,0.45,0.94) both',
        'fade-scale':  'fadeScale 0.2s cubic-bezier(0.25,0.46,0.45,0.94) both',
        'scale-in':    'scaleIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both',
        'shimmer':     'shimmer 1.8s ease-in-out infinite',
        'pulse-glow':  'pulseGlow 2.5s ease-in-out infinite',
        'spin-slow':   'spin 3s linear infinite',
      },

      /* ── Keyframes ─────────────────────────────────────────────────────── */
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeScale: {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(10,132,255,0.3)' },
          '50%':      { boxShadow: '0 0 24px rgba(10,132,255,0.6), 0 0 48px rgba(10,132,255,0.2)' },
        },
      },

      /* ── Spacing scale (Tailwind 4/8/12/16/24/32/48/64 — confirmed) ────── */
      // Tailwind includes the 4px base scale by default.
      // Extend only custom steps here:
      spacing: {
        '4.5': '18px',
        '13':  '52px',
        '15':  '60px',
        '18':  '72px',
        '22':  '88px',
        '26':  '104px',
        '30':  '120px',
        '34':  '136px',
      },

      /* ── Transition timing ─────────────────────────────────────────────── */
      transitionTimingFunction: {
        'spring':      'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'apple':       'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'apple-fast':  'cubic-bezier(0.4, 0, 0.2, 1)',
        'decelerate':  'cubic-bezier(0, 0, 0.2, 1)',
        'accelerate':  'cubic-bezier(0.4, 0, 1, 1)',
      },

      /* ── Transition duration ───────────────────────────────────────────── */
      transitionDuration: {
        '0':   '0ms',
        '150': '150ms',
        '250': '250ms',
        '350': '350ms',
        '400': '400ms',
      },
    },
  },
  plugins: [],
};
