import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { COLORS, LAYOUT, SPACING } from '../constants/theme';
import { useResponsive } from '../hooks/useResponsive';

const ScreenContainer = ({ 
  children, 
  scroll = true, 
  contentContainerStyle,
  showGradient = true
}) => {
  const { isWeb, isMobile } = useResponsive();
  const Body = scroll ? ScrollView : View;
  const bodyProps = scroll
    ? {
        contentContainerStyle: [styles.content, isMobile && styles.contentMobile, contentContainerStyle],
        showsVerticalScrollIndicator: false,
        bounces: true
      }
    : {
        style: [styles.content, isMobile && styles.contentMobile, { flex: 1 }, contentContainerStyle]
      };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {showGradient && (
        <View style={styles.backgroundTint} pointerEvents="none" />
      )}
      
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, isWeb && styles.containerWeb]}>
          <Body {...bodyProps}>
            {children}
          </Body>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  backgroundTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F9FBFF',
    zIndex: 0
  },
  safeArea: {
    flex: 1,
    zIndex: 1
  },
  container: {
    flex: 1,
    width: '100%'
  },
  containerWeb: {
    maxWidth: LAYOUT.contentMaxWidth,
    marginHorizontal: 'auto'
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxxl
  },
  contentMobile: {
    padding: SPACING.sm,
    paddingBottom: SPACING.xxl
  }
});

export default ScreenContainer;
