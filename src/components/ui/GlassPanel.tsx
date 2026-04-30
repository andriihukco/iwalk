/**
 * GlassPanel — панель з ефектом розмиття (Glass morphism)
 * Використовує ExpoBlurView для Variable Blur ефекту
 * Вимоги: 6.5, 11.5
 */
import React from 'react';
import { StyleSheet, useColorScheme, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors } from '../../constants/colors';

interface GlassPanelProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Інтенсивність розмиття, за замовчуванням 20 */
  intensity?: number;
}

/**
 * Панель з ефектом скла (Glass morphism) на основі ExpoBlurView.
 * Світла тема: rgba(255,255,255,0.6)
 * Темна тема: rgba(28,28,30,0.7)
 */
export function GlassPanel({ children, style, intensity = 20 }: GlassPanelProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Tint color відповідно до теми
  const tintColor = isDark ? Colors.glass.dark : Colors.glass.light;

  return (
    <BlurView
      intensity={intensity}
      tint={isDark ? 'dark' : 'light'}
      style={[styles.container, { backgroundColor: tintColor }, style]}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
  },
});

export default GlassPanel;
