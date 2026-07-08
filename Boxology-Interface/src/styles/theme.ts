// Shared design tokens for the app chrome (toolbar, sidebars, dialogs, tab bar).
// Domain/diagram colors (node shapes, patterns, math symbols, color pickers) are
// NOT part of this file — those live in src/data/* and represent the Boxology
// visual grammar itself, not UI chrome, and must not be touched here.

export const colors = {
  primary: {
    main: '#6c72d9',
    dark: '#4f4b79',
    darker: '#373361',
    light: '#8680ce',
    lighter: '#ede9fb',
    contrastText: '#eaf2fa',
  },
  surface: {
    app: '#f8f9fa',
    panel: '#ffffff',
    sunken: '#f4f4f4',
    header: '#a680ce',
    border: '#dee2e6',
    borderStrong: '#d9ddd3',
  },
  text: {
    primary: '#1b1b1b',
    secondary: '#555555',
    muted: '#6c757d',
    onPrimary: '#eaf2fa',
  },
  semantic: {
    info: { main: '#2563eb', dark: '#1d4ed8', contrastText: '#ffffff' },
    success: { main: '#218721', dark: '#1a6b1a', contrastText: '#ffffff' },
    danger: { main: '#BF124D', dark: '#99103e', contrastText: '#ffffff' },
    neutralDark: { main: '#111827', dark: '#0b0f19', contrastText: '#ffffff' },
  },
};

export const radii = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  pill: 999,
};

export const shadows = {
  sm: '0 1px 2px rgba(15, 23, 42, 0.08)',
  md: '0 2px 8px rgba(0, 0, 0, 0.12)',
  lg: '0 10px 18px rgba(15, 23, 42, 0.18)',
  xl: '0 10px 40px rgba(0, 0, 0, 0.3)',
};

export const fontFamily = "'Segoe UI', Arial, sans-serif";
