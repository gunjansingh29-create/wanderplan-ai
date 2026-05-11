/**
 * WanderPlan AI – Design Tokens
 *
 * Mirrors the color palette used in the web app so the two products
 * share a consistent visual identity.
 */

export const Colors = {
  // Brand
  primary: '#0D7377',
  primaryLight: '#1A9A9F',
  primaryDark: '#095456',
  secondary: '#E8634A',
  secondaryLight: '#F08872',
  accent: '#4DA8DA',
  accentLight: '#7CC2E8',

  // Backgrounds & surfaces
  bg: '#F6F8FA',
  surface: '#FFFFFF',
  surfaceSecondary: '#F0F3F7',

  // Text
  text: '#1A1A2E',
  text2: '#5A6A7A',
  text3: '#8E99A8',

  // Borders
  border: '#E2E8F0',
  borderLight: '#F0F3F7',

  // Status
  success: '#22C55E',
  successBg: '#F0FDF4',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  error: '#EF4444',
  errorBg: '#FEF2F2',

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  overlay: 'rgba(26,26,46,0.55)',
} as const;

export const Typography = {
  // Font families (must be linked via react-native-vector-icons / system fonts)
  fontRegular: 'System',
  fontMedium: 'System',
  fontSemiBold: 'System',
  fontBold: 'System',

  // Scale
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  xxxl: 36,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Radii = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const Shadows = {
  sm: {
    shadowColor: '#1A1A2E',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#1A1A2E',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1A1A2E',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

export type ColorToken = keyof typeof Colors;
