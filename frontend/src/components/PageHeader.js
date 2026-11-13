import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useResponsive } from '../hooks/useResponsive';

const PageHeader = ({ 
  title, 
  subtitle, 
  icon = 'sparkles-outline', 
  rightNode,
  variant = 'default'
}) => {
  const { isMobile } = useResponsive();
  const showIcon = variant !== 'minimal';
  
  return (
    <View style={[styles.container, variant === 'compact' && styles.containerCompact, isMobile && styles.containerMobile]}>
      <View style={[styles.content, isMobile && styles.contentMobile]}>
        <View style={styles.textWrap}>
          <Text style={[
            styles.title,
            variant === 'large' && styles.titleLarge,
            isMobile && styles.titleMobile,
            isMobile && variant === 'large' && styles.titleLargeMobile
          ]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[
              styles.subtitle,
              variant === 'compact' && styles.subtitleCompact,
              isMobile && styles.subtitleMobile
            ]}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {rightNode ? (
          <View style={styles.rightNode}>{rightNode}</View>
        ) : showIcon ? (
          <View style={[styles.iconBubble, isMobile && styles.iconBubbleMobile]}>
            <Ionicons name={icon} size={isMobile ? 18 : 22} color={COLORS.white} />
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg
  },
  containerCompact: {
    marginBottom: SPACING.md
  },
  containerMobile: {
    marginBottom: SPACING.md
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md
  },
  contentMobile: {
    gap: SPACING.sm
  },
  textWrap: {
    flex: 1
  },
  title: {
    ...TYPOGRAPHY.h1,
    color: COLORS.textPrimary
  },
  titleMobile: {
    fontSize: 18,
    lineHeight: 24
  },
  titleLarge: {
    ...TYPOGRAPHY.displayLarge,
    color: COLORS.textPrimary
  },
  titleLargeMobile: {
    fontSize: 22,
    lineHeight: 30
  },
  subtitle: {
    marginTop: SPACING.xs,
    color: COLORS.textSecondary,
    ...TYPOGRAPHY.body,
    lineHeight: 22
  },
  subtitleMobile: {
    ...TYPOGRAPHY.bodySmall,
    lineHeight: 20
  },
  subtitleCompact: {
    ...TYPOGRAPHY.bodySmall
  },
  rightNode: {
    flexShrink: 0
  },
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: COLORS.accentDark,
    flexShrink: 0
  },
  iconBubbleMobile: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm
  }
});

export default PageHeader;
