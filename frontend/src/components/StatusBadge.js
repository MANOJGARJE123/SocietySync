import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useResponsive } from '../hooks/useResponsive';

const STATUS_CONFIG = {
  // Success states
  resolved: { bg: COLORS.tealSoft, border: COLORS.teal, text: COLORS.teal, icon: 'checkmark-circle' },
  paid: { bg: COLORS.tealSoft, border: COLORS.teal, text: COLORS.teal, icon: 'checkmark-circle' },
  approved: { bg: COLORS.tealSoft, border: COLORS.teal, text: COLORS.teal, icon: 'checkmark-circle' },
  completed: { bg: COLORS.tealSoft, border: COLORS.teal, text: COLORS.teal, icon: 'checkmark-circle' },
  
  // Warning states
  pending: { bg: COLORS.amberSoft, border: COLORS.amber, text: COLORS.amber, icon: 'time' },
  'in progress': { bg: COLORS.blueSoft, border: COLORS.blue, text: COLORS.blue, icon: 'hourglass' },
  
  // Danger states
  overdue: { bg: COLORS.coralSoft, border: COLORS.coral, text: COLORS.coral, icon: 'alert-circle' },
  rejected: { bg: COLORS.coralSoft, border: COLORS.coral, text: COLORS.coral, icon: 'close-circle' },
  due: { bg: COLORS.coralSoft, border: COLORS.coral, text: COLORS.coral, icon: 'alert-circle' },
  failed: { bg: COLORS.coralSoft, border: COLORS.coral, text: COLORS.coral, icon: 'close-circle' }
};

const StatusBadge = ({ status, showIcon = true, size = 'medium' }) => {
  const { isMobile } = useResponsive();
  const normalized = String(status || '').toLowerCase();
  const config = STATUS_CONFIG[normalized] || {
    bg: COLORS.accentSoft,
    border: COLORS.accent,
    text: COLORS.accent,
    icon: 'ellipse'
  };

  const sizeStyles = {
    small: styles.badgeSmall,
    medium: styles.badgeMedium,
    large: styles.badgeLarge
  };

  const textSizeStyles = {
    small: styles.textSmall,
    medium: styles.textMedium,
    large: styles.textLarge
  };

  const iconSizes = {
    small: 12,
    medium: 14,
    large: 16
  };

  return (
    <View style={[
      styles.badge,
      sizeStyles[size],
      isMobile && styles.badgeMobile,
      { backgroundColor: config.bg, borderColor: config.border }
    ]}>
      {showIcon && (
        <Ionicons 
          name={config.icon} 
          size={isMobile ? Math.max(11, iconSizes[size] - 1) : iconSizes[size]} 
          color={config.text} 
        />
      )}
      <Text style={[
        styles.text,
        textSizeStyles[size],
        isMobile && styles.textMobile,
        { color: config.text }
      ]}>
        {normalized || 'unknown'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    borderWidth: 1
  },
  badgeSmall: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 4,
    gap: 4
  },
  badgeMedium: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    gap: 6
  },
  badgeLarge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    gap: 6
  },
  badgeMobile: {
    paddingVertical: 4
  },
  text: {
    fontWeight: '700',
    textTransform: 'capitalize'
  },
  textSmall: {
    ...TYPOGRAPHY.captionSmall
  },
  textMedium: {
    ...TYPOGRAPHY.caption
  },
  textLarge: {
    ...TYPOGRAPHY.labelSmall
  },
  textMobile: {
    fontSize: 11,
    lineHeight: 14
  }
});

export default StatusBadge;
