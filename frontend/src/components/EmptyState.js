import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useResponsive } from '../hooks/useResponsive';

const EmptyState = ({ 
  title, 
  subtitle, 
  icon = 'folder-open-outline',
  action
}) => {
  const { isMobile } = useResponsive();
  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <LinearGradient
        colors={[COLORS.accentSoft, 'transparent']}
        style={[styles.iconWrap, isMobile && styles.iconWrapMobile]}
      >
        <Ionicons name={icon} size={isMobile ? 34 : 48} color={COLORS.accent} />
      </LinearGradient>
      
      <Text style={[styles.title, isMobile && styles.titleMobile]}>{title}</Text>
      
      {subtitle ? (
        <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>{subtitle}</Text>
      ) : null}
      
      {action ? (
        <View style={[styles.actionWrap, isMobile && styles.actionWrapMobile]}>
          {action}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    marginVertical: SPACING.md
  },
  containerMobile: {
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    borderRadius: RADIUS.md
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderStrong
  },
  iconWrapMobile: {
    width: 64,
    height: 64,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
    textAlign: 'center'
  },
  titleMobile: {
    fontSize: 16,
    lineHeight: 22
  },
  subtitle: {
    marginTop: SPACING.sm,
    color: COLORS.textSecondary,
    ...TYPOGRAPHY.body,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320
  },
  subtitleMobile: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.xs,
    lineHeight: 20
  },
  actionWrap: {
    marginTop: SPACING.lg,
    width: '100%',
    maxWidth: 280
  },
  actionWrapMobile: {
    marginTop: SPACING.md
  }
});

export default EmptyState;
