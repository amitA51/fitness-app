/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      /* ── Color Tokens ──────────────────────────────────────────────────── */
      colors: {
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',

        accent: {
          dashboard: 'var(--accent-dashboard)',
          workout: 'var(--accent-workout)',
          nutrition: 'var(--accent-nutrition)',
          history: 'var(--accent-history)',
          progress: 'var(--accent-progress)',
          templates: 'var(--accent-templates)',
          settings: 'var(--accent-settings)',
          current: 'var(--accent-current)',
        },

        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',

        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',

        surface: {
          DEFAULT: 'var(--color-surface)',
          elevated: 'var(--color-surface-elevated)',
          input: 'var(--color-surface-input)',
          hover: 'var(--color-surface-hover)',
        },

        bone: {
          DEFAULT: 'var(--bone)',
          deep: 'var(--bone-deep)',
          faint: 'var(--bone-faint)',
        },
        navy: {
          DEFAULT: 'var(--navy)',
          deep: 'var(--navy-deep)',
          light: 'var(--navy-light)',
        },
        mustard: {
          DEFAULT: 'var(--mustard)',
          dark: 'var(--mustard-dark)',
        },
        ink: 'var(--ink)',
        stone: {
          DEFAULT: 'var(--stone)',
          light: 'var(--stone-light)',
        },

        'label-secondary': '#7E7D78',
        'label-tertiary': '#A5A49F',
        'separator': 'var(--bone-deep)',

        'success-muted': 'var(--color-success-muted)',
        'warning-muted': 'var(--color-warning-muted)',
        'error-muted': 'var(--color-error-muted)',

        gray: {
          100: '#F5F1EB',
          200: '#EAE4DA',
          300: '#A5A49F',
          400: '#7E7D78',
          500: '#5A5955',
          600: '#3F3F46',
          700: '#27272A',
          800: '#1A1A1A',
          900: '#132018',
        },
      },

      /* ── Typography ────────────────────────────────────────────────────── */
      fontFamily: {
        sans: ['IBM Plex Sans', 'Assistant', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Bricolage Grotesque', 'Assistant', 'Impact', 'sans-serif'],
        condensed: ['Bricolage Grotesque', 'Assistant', 'Impact', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
        hebrew: ['Assistant', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1.4' }],
        'caption': ['0.625rem', { lineHeight: '1.4' }],
        'label': ['0.6875rem', { lineHeight: '1.4' }],
        'sm': ['0.8125rem', { lineHeight: '1.5' }],
        'base': ['0.9375rem', { lineHeight: '1.55' }],
        'lg': ['1.0625rem', { lineHeight: '1.55' }],
        'headline': ['1.125rem', { lineHeight: '1.2' }],
        'title': ['1.25rem', { lineHeight: '1.1' }],
        'display-sm': ['1.5rem', { lineHeight: '1' }],
        'display': ['2.25rem', { lineHeight: '0.95' }],
        'display-lg': ['3rem', { lineHeight: '0.9' }],
        'display-xl': ['5.5rem', { lineHeight: '0.85' }],
        'display-hero': ['7.5rem', { lineHeight: '0.82' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
        '8xl': ['6rem', { lineHeight: '1' }],
        '9xl': ['8rem', { lineHeight: '1' }],
      },
      letterSpacing: {
        tighter: '-0.04em',
        tight: '-0.02em',
        normal: '0',
        wide: '0.05em',
        wider: '0.1em',
        widest: '0.15em',
        'editorial': '0.08em',
        'label': '0.18em',
        'ribbon': '0.22em',
      },

      /* ── Border Radius ─────────────────────────────────────────────────── */
      borderRadius: {
        'none': '0px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '24px',
        '3xl': '32px',
        '4xl': '40px',
        'pill': '9999px',
      },

      /* ── Shadows ──────────────────────────────────────────────────────── */
      boxShadow: {
        'card': '0 1px 3px rgba(19, 32, 24, 0.08)',
        'elevated': '0 4px 12px rgba(19, 32, 24, 0.12)',
        'navy': '0 8px 24px rgba(9, 17, 13, 0.25)',
        'glow': '0 0 24px rgba(19, 32, 24, 0.15)',
        'glow-sm': '0 0 12px rgba(19, 32, 24, 0.12)',
        'inner': 'inset 0 1px 0 rgba(255, 255, 255, 0.4)',
        'button': '0 2px 8px rgba(19, 32, 24, 0.15)',
      },

      /* ── Backdrop Blur ───────────────────────────────────────────────── */
      backdropBlur: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
        '3xl': '40px',
      },

      /* ── Animation ────────────────────────────────────────────────────── */
      animation: {
        'shimmer': 'shimmer 1.8s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'slide-up': 'slideUp 250ms cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'chapter-reveal': 'chapterReveal 500ms cubic-bezier(0.16, 1, 0.3, 1)',
      },

      /* ── Keyframes ────────────────────────────────────────────────────── */
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        chapterReveal: {
          '0%': { clipPath: 'inset(0 100% 0 0)' },
          '100%': { clipPath: 'inset(0 0 0 0)' },
        },
      },

      /* ── Spacing ──────────────────────────────────────────────────────── */
      spacing: {
        '4.5': '18px',
        '13': '52px',
        '15': '60px',
        '18': '72px',
        '22': '88px',
        '26': '104px',
        '30': '120px',
        '34': '136px',
      },

      /* ── Transition Timing ──────────────────────────────────────────────── */
      transitionTimingFunction: {
        'spring-bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'spring-smooth': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'spring-snappy': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'spring-soft': 'cubic-bezier(0.32, 0.72, 0, 1)',
        'editorial': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },

      transitionDuration: {
        '0': '0ms',
        '75': '75ms',
        '100': '100ms',
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
        '500': '500ms',
      },

      /* ── Z-Index ────────────────────────────────────────────────────── */
      zIndex: {
        'base': '0',
        'sticky': '20',
        'nav': '40',
        'dropdown': '60',
        'overlay': '80',
        'modal': '90',
        'toast': '100',
        'tooltip': '110',
        'dropdown-legacy': '40',
        'sticky-legacy': '50',
        'fixed': '60',
        'modal-backdrop': '80',
        'popover': '90',
      },
    },
  },
  plugins: [],
};
