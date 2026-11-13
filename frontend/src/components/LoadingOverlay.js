import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ANIMATION, COLORS, GRADIENTS, RADIUS, SHADOW } from '../constants/theme';

const LoadingOverlay = ({ fullScreen = true }) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      false
    );
    
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.6, { duration: 1000 })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value
  }));

  const containerStyle = fullScreen ? styles.containerFull : styles.containerInline;

  return (
    <View style={containerStyle}>
      <Animated.View style={[styles.spinnerWrap, animatedStyle]}>
        <LinearGradient
          colors={[COLORS.accentSoft, 'transparent']}
          style={styles.gradient}
        >
          <ActivityIndicator size="large" color={COLORS.accent} />
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  containerFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg
  },
  containerInline: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40
  },
  spinnerWrap: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    ...SHADOW.md
  },
  gradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface
  }
});

export default LoadingOverlay;
