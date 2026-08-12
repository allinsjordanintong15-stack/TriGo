export const colors = {
  primary: '#0B6E4F',
  primaryDark: '#095C42',
  primaryLight: '#E8F5F0',
  background: '#FFFFFF',
  surface: '#F7F9F8',
  text: '#1A1A1A',
  textSecondary: '#666666',
  textMuted: '#999999',
  border: '#E0E0E0',
  error: '#D32F2F',
  errorBackground: '#FFEBEE',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const typography = {
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
