import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

// Colors - matching Figma design tokens
export const COLORS = {
  // Brand colors
  primary: '#1FC85C',
  primaryLight: '#47E17E',
  primaryDark: '#13A648',

  // Secondary colors
  secondary: '#47E17E',
  secondaryLight: '#BAF8D0',
  secondaryDark: '#13A648',

  // Accent colors
  accent: '#F0FDF4',
  accentLight: '#DBFDE7',
  accentDark: '#13A648',

  // Background colors
  background: '#FFFFFF',
  backgroundSecondary: '#F5F5F6',
  backgroundTertiary: '#E7E8EA',

  // Text colors
  text: '#18191C',
  textSecondary: '#7E838C',
  textTertiary: '#454A51',
  textLight: '#FFFFFF',

  // Status colors
  success: '#1FC85C',
  warning: '#FAC515',
  error: '#FF4D5B',
  info: '#00AFFE',

  // Status Container colors
  errorContainer: '#FF4D5B1A',
  warningContainer: '#FFF3CC',
  successContainer: '#E5F9E0',
  infoContainer: '#E5F9E0',

  // Border colors
  border: '#F5F5F6',
  borderLight: '#E7E8EA',

  // Card colors
  card: '#FFFFFF',
  cardElevated: '#F5F5F6',

  // Special colors
  barrier: '#7A000000',
  overlay: 'rgba(0, 0, 0, 0.3)',
  ripple: '#12000000',
  rippleHover: '#0C5B5B5B',
  shimmer: '#1B000000',

  // Gradient colors
  gradientStart: '#1FC85C',
  gradientEnd: '#47E17E',

  // Pro/Premium colors
  proGold: '#FFD700',
  proPurple: '#9C27B0',

  // Reminder colors
  watering: '#00AFFE',
  fertilizing: '#1FC85C',
  repotting: '#795548',

  // Custom colors
  warning2: '#EF7920',
  textfieldColor: '#E7E8EA',
  bottomSheetBack: '#F5F5F6',
  bottomSheetBackground: '#FFFFFF',
  loader: '#333333',

  // Accent palette
  accent1: '#FFFFFF',
  accent2: '#F5F5F6',
  accent3: '#E7E8EA',
  accent4: '#D3D5D9',
};

// Dark theme colors - matching Figma dark mode tokens
export const DARK_COLORS = {
  ...COLORS,

  // Background colors
  background: '#1D1D1D',
  backgroundSecondary: '#151515',
  backgroundTertiary: '#252525',

  // Text colors
  text: '#FFFFFF',
  textSecondary: '#8C8C8C',
  textTertiary: '#8C8C8C',

  // Card colors
  card: '#1D1D1D',
  cardElevated: '#252525',

  // Border colors
  border: '#232323',
  borderLight: '#2D2D2D',

  // Status colors
  error: '#FF5963',

    // Status Container colors
    errorContainer: '#FF4D5B1A',
    warningContainer: '#FFF3CC',
    successContainer: '#E5F9E0',
    infoContainer: '#E5F9E0',

  // Custom colors
  textfieldColor: '#252525',
  bottomSheetBack: '#1D1D1D',
  bottomSheetBackground: '#252525',
  loader: '#8C8C8C',

  // Accent palette
  accent1: '#1D1D1D',
  accent2: '#252525',
  accent3: '#2D2D2D',
  accent4: '#3B3B3B',

  // Special colors
  ripple: '#12636363',
};

// Typography
export const FONTS = {
  regular: Platform.select({
    ios: 'System',
    android: 'Roboto',
  }),
  medium: Platform.select({
    ios: 'System',
    android: 'Roboto',
  }),
  bold: Platform.select({
    ios: 'System',
    android: 'Roboto',
  }),
};

export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  title: 28,
  header: 32,
  hero: 40,
};

// Spacing
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Border radius
export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  round: 9999,
};

// Shadow styles
export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
};

// Screen dimensions
export const SCREEN = {
  width,
  height,
  isSmall: width < 375,
  isMedium: width >= 375 && width < 414,
  isLarge: width >= 414,
};

// Animation durations
export const ANIMATION = {
  fast: 150,
  normal: 300,
  slow: 500,
};

// Common styles
export const COMMON_STYLES = {
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContent: {
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  rowBetween: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.medium,
  },
  input: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    fontSize: FONT_SIZES.lg,
    color: COLORS.text,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  buttonText: {
    color: COLORS.textLight,
    fontSize: FONT_SIZES.lg,
    fontWeight: '600' as const,
  },
  title: {
    fontSize: FONT_SIZES.title,
    fontWeight: 'bold' as const,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600' as const,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
};

// Image placeholder
export const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/300x300/E8F5E9/1B5E20?text=Plant';

// Icon sizes
export const ICON_SIZES = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  xxl: 32,
};
