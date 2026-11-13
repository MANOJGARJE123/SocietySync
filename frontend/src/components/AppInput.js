import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { ANIMATION, COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useResponsive } from '../hooks/useResponsive';

const AppInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  multiline = false,
  numberOfLines = 1,
  error,
  leftIcon,
  rightIcon,
  floatingLabel = false,
  disabled = false,
  helperText,
  noMargin = false,
  maxLength,
  onFocus,
  onBlur,
  onSubmitEditing,
  onKeyPress,
  returnKeyType,
  blurOnSubmit
}) => {
  const { isMobile } = useResponsive();
  const [focused, setFocused] = useState(false);
  const focusAnim = useSharedValue(0);
  const hasValue = String(value || '').length > 0;
  const shouldFloat = floatingLabel && (focused || hasValue);

  useEffect(() => {
    if (!floatingLabel) return;
    focusAnim.value = withTiming(shouldFloat ? 1 : 0, { duration: ANIMATION.normal });
  }, [ANIMATION.normal, floatingLabel, shouldFloat, focusAnim]);

  const handleFocus = () => {
    setFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setFocused(false);
    onBlur?.();
  };

  const borderAnimatedStyle = useAnimatedStyle(() => ({
    borderColor: error 
      ? COLORS.danger 
      : focusAnim.value === 1 
        ? COLORS.accent
        : COLORS.border
  }));

  const iconColor = error 
    ? COLORS.danger 
    : focused 
      ? COLORS.accent 
      : COLORS.textTertiary;

  const floatingLabelAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(focusAnim.value, [0, 1], [0, -22]) },
      { scale: interpolate(focusAnim.value, [0, 1], [1, 0.88]) }
    ]
  }));

  return (
    <View style={[styles.container, noMargin && styles.containerNoMargin]}>
      {label && !floatingLabel ? (
        <Text style={[styles.label, isMobile && styles.labelMobile]}>{label}</Text>
      ) : null}
      
      {label && floatingLabel ? (
        <Animated.Text 
          style={[
            styles.floatingLabel,
            isMobile && styles.floatingLabelMobile,
            shouldFloat && styles.floatingLabelRaised,
            error && styles.floatingLabelError
            ,floatingLabelAnimatedStyle
          ]}
        >
          {label}
        </Animated.Text>
      ) : null}

      <Animated.View
        style={[
          styles.inputWrap,
          isMobile && styles.inputWrapMobile,
          multiline && styles.multilineWrap,
          multiline && isMobile && styles.multilineWrapMobile,
          disabled && styles.inputWrapDisabled,
          borderAnimatedStyle
        ]}
      >
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={20}
            color={iconColor}
            style={styles.leftIcon}
          />
        ) : null}
        
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={handleFocus}
          onBlur={handleBlur}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={!disabled}
          maxLength={maxLength}
          onSubmitEditing={onSubmitEditing}
          onKeyPress={onKeyPress}
          returnKeyType={returnKeyType}
          blurOnSubmit={blurOnSubmit}
          style={[
            styles.input,
            isMobile && styles.inputMobile,
            leftIcon && styles.inputWithIcon,
            rightIcon && styles.inputWithRightIcon,
            floatingLabel && shouldFloat && styles.inputWithFloatingLabelRaised,
            multiline && styles.multiline,
            multiline && isMobile && styles.multilineMobile
          ]}
          placeholderTextColor={COLORS.textTertiary}
          placeholder={floatingLabel ? '' : placeholder}
          selectionColor={COLORS.accent}
        />
        
        {rightIcon ? (
          <View style={styles.rightIcon}>
            {rightIcon}
          </View>
        ) : null}
      </Animated.View>

      {error ? (
        <View style={styles.messageRow}>
          <Ionicons name="alert-circle" size={14} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md
  },
  containerNoMargin: {
    marginBottom: 0
  },
  label: {
    marginBottom: SPACING.xs,
    color: COLORS.textTertiary,
    ...TYPOGRAPHY.label
  },
  labelMobile: {
    fontSize: 12,
    lineHeight: 16
  },
  floatingLabel: {
    position: 'absolute',
    left: SPACING.md,
    top: 16,
    zIndex: 3,
    color: COLORS.textTertiary,
    fontSize: 15,
    fontWeight: '400',
    backgroundColor: COLORS.inputBg,
    paddingHorizontal: 4,
  },
  floatingLabelMobile: {
    top: 15,
    fontSize: 13
  },
  floatingLabelRaised: {
    top: 16,
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: '600'
  },
  floatingLabelError: {
    color: COLORS.danger
  },
  inputWrap: {
    minHeight: 52,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBg,
    justifyContent: 'center',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center'
  },
  inputWrapMobile: {
    minHeight: 48,
    borderRadius: RADIUS.sm
  },
  inputWrapDisabled: {
    opacity: 0.6,
    backgroundColor: COLORS.surfaceAlt
  },
  input: {
    flex: 1,
    minHeight: 52,
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.md,
    ...TYPOGRAPHY.body,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {})
  },
  inputMobile: {
    minHeight: 48,
    paddingHorizontal: SPACING.sm,
    fontSize: 14,
    lineHeight: 20
  },
  inputWithIcon: {
    paddingLeft: 48
  },
  inputWithRightIcon: {
    paddingRight: 48
  },
  inputWithFloatingLabelRaised: {
    paddingTop: 24,
    paddingBottom: 6
  },
  leftIcon: {
    position: 'absolute',
    left: SPACING.md,
    zIndex: 2
  },
  rightIcon: {
    position: 'absolute',
    right: SPACING.md,
    zIndex: 2
  },
  multilineWrap: {
    minHeight: 120,
    paddingVertical: SPACING.sm
  },
  // Keeps long textareas from dominating mobile screens.
  multilineWrapMobile: {
    minHeight: 96
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md
  },
  multilineMobile: {
    minHeight: 96,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
    marginTop: SPACING.xs
  },
  errorText: {
    color: COLORS.danger,
    ...TYPOGRAPHY.caption,
    fontWeight: '500'
  },
  helperText: {
    marginTop: SPACING.xs,
    color: COLORS.textTertiary,
    ...TYPOGRAPHY.caption
  }
});

export default AppInput;
