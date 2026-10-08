export const colors = {
  primary: '#1B5E3A',
  primaryDark: '#0F3D26',
  primaryLight: '#E8F3EC',
  accent: '#C9A66B',
  // Alias of accent, for places that mean "TriGo gold" (e.g. the destination pin).
  gold: '#C9A66B',
  goldLight: '#F5EDE0',
  error: '#D32F2F',
  errorBackground: '#FFEBEE',
  // Dark green scrim over photos and behind dialogs.
  overlay: 'rgba(15,61,38,0.45)',
  background: '#FAFAF8',
  // Cards and subtle surfaces use Primary Light per the TriGo design system.
  surface: '#E8F3EC',
  text: '#1A1A1A',
  textSecondary: '#666666',
  textMuted: '#999999',
  border: '#E0E0E0',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

export const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const;

export const typography = {
  // Brand wordmark on the sign-in screens.
  display: {
    fontSize: 40,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400' as const,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
  },
};
