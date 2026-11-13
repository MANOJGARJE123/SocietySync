import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { ANIMATION, COLORS, RADIUS, SHADOW, SPACING } from '../constants/theme';
import { useResponsive } from '../hooks/useResponsive';

const AppButton = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'medium',
  fullWidth = true,
  leftIcon,
  rightIcon,
  style,
  textStyle
}) => {
  const { isMobile } = useResponsive();
  const isDisabled = loading || disabled;
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';
  
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value
  }));

  const handlePressIn = () => {
    if (!isDisabled) {
      scale.value = withSpring(0.96, ANIMATION.spring);
      opacity.value = withTiming(0.8, { duration: ANIMATION.fast });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, ANIMATION.spring);
    opacity.value = withTiming(1, { duration: ANIMATION.fast });
  };

  const sizeStyles = {
    small: styles.sizeSmall,
    medium: styles.sizeMedium,
    large: styles.sizeLarge
  };

  const textSizeStyles = {
    small: styles.textSmall,
    medium: styles.textMedium,
    large: styles.textLarge
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.buttonShell,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style
      ]}
      disabled={isDisabled}
    >
      <Animated.View style={[animatedStyle, fullWidth && styles.fullWidth]}>
        {isOutline ? (
          <View style={[styles.outlineFill, fullWidth && styles.fullWidth, sizeStyles[size], isMobile && styles.mobileSize]}>
            {loading ? (
              <ActivityIndicator color={COLORS.accent} size="small" />
            ) : (
              <View style={styles.contentRow}>
                {leftIcon}
                <Text style={[styles.text, styles.outlineText, textSizeStyles[size], isMobile && styles.mobileText, textStyle]}>
                  {title}
                </Text>
                {rightIcon}
              </View>
            )}
          </View>
        ) : isGhost ? (
          <View style={[styles.ghostFill, fullWidth && styles.fullWidth, sizeStyles[size], isMobile && styles.mobileSize]}>
            {loading ? (
              <ActivityIndicator color={COLORS.textSecondary} size="small" />
            ) : (
              <View style={styles.contentRow}>
                {leftIcon}
                <Text style={[styles.text, styles.ghostText, textSizeStyles[size], isMobile && styles.mobileText, textStyle]}>
                  {title}
                </Text>
                {rightIcon}
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.filledButton, variant === 'secondary' && styles.secondaryButton, variant === 'danger' && styles.dangerButton, fullWidth && styles.fullWidth, sizeStyles[size], isMobile && styles.mobileSize]}>
            {loading ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <View style={styles.contentRow}>
                {leftIcon}
                <Text style={[styles.text, textSizeStyles[size], isMobile && styles.mobileText, textStyle]}>
                  {title}
                </Text>
                {rightIcon}
              </View>
            )}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  buttonShell: {
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {})
  },
  fullWidth: {
    width: '100%'
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs
  },
  
  // Size variants
  sizeSmall: {
    minHeight: 40,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm
  },
  sizeMedium: {
    minHeight: 52,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md
  },
  sizeLarge: {
    minHeight: 60,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md
  },
  mobileSize: {
    minHeight: 44,
    paddingHorizontal: SPACING.md
  },
  
  // Fill styles
  outlineFill: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.borderStrong,
    backgroundColor: 'transparent'
  },
  ghostFill: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent'
  },
  filledButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: COLORS.accentDark,
    ...SHADOW.md
  },
  secondaryButton: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary
  },
  dangerButton: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger
  },
  
  // Text styles
  text: {
    color: COLORS.white,
    fontWeight: '600',
    letterSpacing: 0.2
  },
  textSmall: {
    fontSize: 14,
    lineHeight: 20
  },
  textMedium: {
    fontSize: 15,
    lineHeight: 22
  },
  textLarge: {
    fontSize: 16,
    lineHeight: 24
  },
  mobileText: {
    fontSize: 13,
    lineHeight: 18
  },
  outlineText: {
    color: COLORS.accent
  },
  ghostText: {
    color: COLORS.textSecondary
  },
  disabled: {
    opacity: 0.5
  }
});

export default AppButton;
