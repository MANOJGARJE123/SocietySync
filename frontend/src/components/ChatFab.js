import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOW } from '../constants/theme';
import { useResponsive } from '../hooks/useResponsive';

const ChatFab = ({ onPress }) => {
  const { isMobile } = useResponsive();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}>
      <View style={[styles.fab, isMobile && styles.fabMobile]}>
        <Ionicons name="sparkles-outline" size={isMobile ? 20 : 24} color="#FFFFFF" />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 22,
    bottom: 32,
    zIndex: 20
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: COLORS.accentDark,
    ...SHADOW
  },
  fabMobile: {
    width: 52,
    height: 52
  },
  pressed: {
    transform: [{ scale: 0.95 }]
  }
});

export default ChatFab;
