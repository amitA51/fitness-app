/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      /* ── Color Tokens (Driven by CSS Variables) ─────────────────────────── */
      colors: {
        // Primary accent (theme-aware)
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',

        // Semantic colors
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',

        // Text scale
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',

        // Surface scale (OLED Dark)
        surface: {
          DEFAULT: 'var(--color-surface)',
          elevated: 'var(--color-surface-elevated)',
          input: 'var(--color-surface-input)',
          hover: 'var(--color-surface-hover)',
        },

        // Apple OLED static tokens (for reference)
        'surface-1': '#111114',
        'surface-2': '#18181C',
        'surface-3': '#1F1F24',

        // Label colors
        'label-secondary': '#71717A',
        'label-tertiary': '#52525B',

        // Separator
        'separator': 'rgba(255, 255, 255, 0.04)',

        // Premium semantic colors
        'success-muted': 'var(--color-success-muted)',
        'warning-muted': 'var(--color-warning-muted)',
        'error-muted': 'var(--color-error-muted)',
      },

      /* ── Typography ────────────────────────────────────────────────────── */
      fontFamily: {
        sans: ['Outfit', 'system-ui', '-apple-system', 'sans-serif'],
        condensed: ['Outfit Condensed', 'Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
        '8xl': ['6rem', { lineHeight: '1' }],
        '9xl': ['8rem', { lineHeight: '1' }],
      },

      letterSpacing: {
        tighter: '-0.03em',
        tight: '-0.02em',
        normal: '0',
        wide: '0.05em',
        wider: '0.1em',
        widest: '0.15em',
      },

      /* ── Border Radius ─────────────────────────────────────────────────── */
      borderRadius: {
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
        '3xl': '32px',
        '4xl': '40px',
        'pill': '9999px',
      },

      /* ── Box Shadows — Tinted, Diffused, Premium ───────────────────────── */
      boxShadow: {
        'card': '0 4px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.06)',
        'elevated': '0 12px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.12)',
        'glow': '0 0 32px rgba(59, 130, 246, 0.35)',
        'glow-sm': '0 0 16px rgba(59, 130, 246, 0.35)',
        'glow-lg': '0 0 48px rgba(59, 130, 246, 0.4)',
        'inner': 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
        'diffused': '0 20px 40px -15px rgba(0, 0, 0, 0.5)',
      },

      /* ── Backdrop Blur ─────────────────────────────────────────────────── */
      backdropBlur: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
        '3xl': '40px',
      },

      backdropSaturate: {
        '150': '1.5',
        '180': '1.8',
        '200': '2',
      },

      /* ── Animations ────────────────────────────────────────────────────── */
      animation: {
        // Stagger reveal
        'stagger': 'staggerReveal 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
        'fade-scale': 'fadeScale 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',

        // Perpetual micro-interactions
        'float': 'float 4s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
        'breathing': 'breathing 2s ease-in-out infinite',

        // Loading
        'shimmer': 'shimmer 1.8s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',

        // Entry
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',

        // Navigation
        'nav-dot-pop': 'navDotPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      },

      /* ── Keyframes ─────────────────────────────────────────────────────── */
      keyframes: {
        staggerReveal: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeScale: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(59, 130, 246, 0.35)' },
          '50%': { boxShadow: '0 0 24px rgba(59, 130, 246, 0.35), 0 0 48px rgba(59, 130, 246, 0.15)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.85)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        breathing: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(0.95)' },
        },
        navDotPop: {
          '0%': { transform: 'scale(0) translateX(-50%)', opacity: '0' },
          '60%': { transform: 'scale(1.4) translateX(-50%)', opacity: '1' },
          '100%': { transform: 'scale(1) translateX(-50%)', opacity: '1' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
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

      /* ── Transition Timing (Premium Spring Physics) ────────────────────── */
      transitionTimingFunction: {
        'spring-bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'spring-smooth': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'spring-snappy': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'spring-700': 'cubic-bezier(0.32, 0.72, 0, 1)',
      },

      transitionDuration: {
        '0': '0ms',
        '75': '75ms',
        '100': '100ms',
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
        '400': '400ms',
        '500': '500ms',
        '700': '700ms',
      },

      /* ── Z-Index Scale ─────────────────────────────────────────────────── */
      zIndex: {
        'dropdown': '40',
        'sticky': '50',
        'fixed': '60',
        'modal-backdrop': '70',
        'modal': '80',
        'popover': '90',
        'tooltip': '100',
      },
    },
  },
  plugins: [],
};
