import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate
} from 'react-native-reanimated';
import { ANIMATION, COLORS, RADIUS, SHADOW, SPACING } from '../constants/theme';
import { useResponsive } from '../hooks/useResponsive';

const AppCard = ({ 
  children, 
  style, 
  onPress,
  variant = 'default',
  noPadding = false,
  noShadow = false
}) => {
  const { isMobile } = useResponsive();
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);
  
  const animatedStyle = useAnimatedStyle(() => {
    const shadowOpacity = interpolate(
      pressed.value,
      [0, 1],
      [0.15, 0.08]
    );
    
    return {
      transform: [{ scale: scale.value }],
      shadowOpacity: noShadow ? 0 : shadowOpacity
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.98, ANIMATION.spring);
    pressed.value = withTiming(1, { duration: ANIMATION.fast });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, ANIMATION.spring);
    pressed.value = withTiming(0, { duration: ANIMATION.fast });
  };

  const variantStyles = {
    default: styles.cardDefault,
    elevated: styles.cardElevated,
    outlined: styles.cardOutlined,
    flat: styles.cardFlat
  };

  const content = (
    <Animated.View 
      style={[
        styles.card,
        isMobile && styles.cardMobile,
        variantStyles[variant],
        noPadding && styles.noPadding,
        noShadow && styles.noShadow,
        style,
        animatedStyle
      ]}
    >
      {children}
    </Animated.View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.pressable,
        Platform.OS === 'web' && styles.pressableWeb
      ]}
    >
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    marginBottom: SPACING.md
  },
  pressableWeb: {
    cursor: 'pointer'
  },
  card: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  cardMobile: {
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.sm
  },
  cardDefault: {
    backgroundColor: COLORS.surface,
    ...SHADOW.md
  },
  cardElevated: {
    backgroundColor: COLORS.surfaceElevated,
    borderColor: COLORS.borderStrong,
    ...SHADOW.lg
  },
  cardOutlined: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.borderStrong
  },
  cardFlat: {
    backgroundColor: COLORS.surface,
    borderWidth: 0
  },
  noPadding: {
    padding: 0
  },
  noShadow: {
    shadowOpacity: 0,
    elevation: 0
  }
});

export default AppCard;
