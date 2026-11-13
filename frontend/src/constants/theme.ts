export const COLORS = {
  // Core backgrounds
  bg: '#F6F8FC',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  surfaceElevated: '#FFFFFF',
  
  // Borders
  border: '#E6EAF2',
  borderStrong: '#D8E0EC',
  borderFocus: 'rgba(28, 100, 242, 0.35)',
  
  // Primary brand colors
  accent: '#1C64F2',
  accentLight: '#5E92FF',
  accentDark: '#174EA6',
  accentSoft: '#EAF2FF',
  accentGlow: 'rgba(28, 100, 242, 0.2)',
  
  // Semantic colors
  teal: '#0E9F6E',
  tealSoft: 'rgba(14,159,110,0.12)',
  coral: '#E02424',
  coralSoft: 'rgba(224,36,36,0.12)',
  amber: '#B45309',
  amberSoft: 'rgba(180,83,9,0.12)',
  blue: '#1C64F2',
  blueSoft: 'rgba(28,100,242,0.12)',
  
  // Text hierarchy
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textTertiary: '#64748B',
  textDisabled: '#94A3B8',
  
  // Legacy aliases for backward compatibility
  textMuted: '#64748B',
  textHint: '#94A3B8',
  
  // Utility colors
  white: '#FFFFFF',
  black: '#000000',
  sidebar: '#FFFFFF',
  inputBg: '#FFFFFF',
  tabBar: '#FFFFFF',
  overlay: 'rgba(15,23,42,0.24)',
  overlayLight: 'rgba(15,23,42,0.12)',
  
  // Semantic aliases
  primary: '#7C58FF',
  primaryDark: '#6344E6',
  secondary: '#0E9F6E',
  success: '#0E9F6E',
  warning: '#B45309',
  danger: '#E02424',
  info: '#1C64F2',
  
  // Status colors
  statusPending: '#B45309',
  statusSuccess: '#0E9F6E',
  statusError: '#E02424',
  statusInfo: '#1C64F2',
  
  // Gradients base
  gradientStart: '#1C64F2',
  gradientEnd: '#174EA6',
  
  // Legacy aliases
  text: '#F5F5F7',
  subText: '#A1A1AA',
  background: '#F6F8FC',
  surfaceMuted: '#EFF4FB',
  accentText: '#1E3A8A'
};

export const GRADIENTS = {
  page: ['#F7F9FD', '#F6F8FC', '#EEF3FA'],
  card: ['#FFFFFF', '#F9FBFF'],
  hero: ['#1C64F2', '#2E7BFF'],
  heroDark: ['#174EA6', '#1E429F'],
  primaryButton: ['#1C64F2', '#2E7BFF'],
  secondaryButton: ['#0E9F6E', '#0B8A5F'],
  dangerButton: ['#E02424', '#C81E1E'],
  avatar: ['#1C64F2', '#174EA6'],
  panel: ['#EAF2FF', '#EFF4FB'],
  glow: ['rgba(28,100,242,0.12)', 'rgba(14,159,110,0.08)'],
  shimmer: ['transparent', 'rgba(15,23,42,0.06)', 'transparent']
};

export const SPACING = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  
  // Legacy aliases
  small: 12,
  medium: 16,
  large: 20,
  xlarge: 24,
  xxlarge: 32
};

export const RADIUS = {
  xs: 10,
  sm: 14,
  md: 18,
  lg: 22,
  xl: 24,
  xxl: 28,
  pill: 999,
  round: 9999
};

export const SHADOW = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12
  },
  // Legacy default shadow
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 4
};

export const TYPOGRAPHY = {
  // Display styles
  displayLarge: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 40,
    letterSpacing: -0.5
  },
  display: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    letterSpacing: -0.3
  },
  
  // Heading styles
  h1: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: -0.2
  },
  h2: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
    letterSpacing: -0.1
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24
  },
  
  // Body styles
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20
  },
  
  // Label styles
  label: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    letterSpacing: 0.2
  },
  labelSmall: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.3
  },
  
  // Caption styles
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16
  },
  captionSmall: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14
  },
  
  // Legacy aliases
  heading: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28
  },
  subheading: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24
  }
};

export const LAYOUT = {
  sidebarWidth: 260,
  contentMaxWidth: 1200,
  mobileBreakpoint: 768,
  tabletBreakpoint: 1024
};

export const ANIMATION = {
  // Spring configs
  spring: {
    damping: 20,
    stiffness: 300
  },
  springGentle: {
    damping: 25,
    stiffness: 200
  },
  springBouncy: {
    damping: 15,
    stiffness: 400
  },
  
  // Timing configs
  fast: 200,
  normal: 300,
  slow: 500,
  
  // Easing
  easeOut: 'cubic-bezier(0.33, 1, 0.68, 1)',
  easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)'
};

export const HAPTICS = {
  light: 'light',
  medium: 'medium',
  heavy: 'heavy',
  success: 'success',
  warning: 'warning',
  error: 'error'
};
