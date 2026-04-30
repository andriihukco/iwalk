/**
 * ProgressRing — кільце прогресу для відображення пройденої дистанції
 * Анімується через useAnimatedStyle (Reanimated 3)
 * Вимоги: 7.3
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withSpring } from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import { SpringConfig } from '../../constants/animation';

interface ProgressRingProps {
  walkedDistanceMeters: number;
  targetDistanceKm: number;
  /** Діаметр кільця, за замовчуванням 120 */
  size?: number;
  /** Товщина кільця, за замовчуванням 10 */
  strokeWidth?: number;
}

const BACKGROUND_COLOR = '#E5E5EA';
const PROGRESS_COLOR = Colors.routeGreen;

/**
 * Обчислює прогрес у діапазоні [0, 1]
 */
function computeProgress(walkedDistanceMeters: number, targetDistanceKm: number): number {
  if (targetDistanceKm <= 0) return 0;
  const raw = walkedDistanceMeters / (targetDistanceKm * 1000);
  return Math.min(1, Math.max(0, raw));
}

/**
 * Кільце прогресу, реалізоване через техніку двох напівкіл (clip technique).
 *
 * Структура:
 * - Зовнішнє кільце (фон) — сіре
 * - Два напівкола, що обертаються для відображення прогресу
 *   - Перше напівколо: перші 50% прогресу (0° → 180°)
 *   - Друге напівколо: наступні 50% прогресу (180° → 360°)
 */
export function ProgressRing({
  walkedDistanceMeters,
  targetDistanceKm,
  size = 120,
  strokeWidth = 10,
}: ProgressRingProps) {
  const progress = computeProgress(walkedDistanceMeters, targetDistanceKm);

  // Анімований прогрес через Reanimated
  const animatedProgress = useDerivedValue(() =>
    withSpring(progress, SpringConfig)
  );

  // Перше напівколо: відображає перші 50% (0 → 180°)
  const firstHalfStyle = useAnimatedStyle(() => {
    const p = animatedProgress.value;
    // Перше напівколо обертається від -180° до 0° (перші 50%)
    const rotation = p <= 0.5
      ? -180 + p * 2 * 180  // від -180° до 0°
      : 0;                   // зафіксовано на 0° при > 50%
    return {
      transform: [{ rotate: `${rotation}deg` }],
    };
  });

  // Друге напівколо: відображає наступні 50% (180° → 360°)
  const secondHalfStyle = useAnimatedStyle(() => {
    const p = animatedProgress.value;
    // Друге напівколо видиме тільки при > 50%
    const rotation = p > 0.5
      ? (p - 0.5) * 2 * 180  // від 0° до 180°
      : 0;
    const opacity = p > 0.5 ? 1 : 0;
    return {
      transform: [{ rotate: `${rotation}deg` }],
      opacity,
    };
  });

  const halfSize = size / 2;
  const innerSize = size - strokeWidth * 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Фонове кільце */}
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: halfSize,
            borderWidth: strokeWidth,
            borderColor: BACKGROUND_COLOR,
          },
        ]}
      />

      {/* Перше напівколо (ліва половина) — перші 50% прогресу */}
      <View
        style={[
          styles.halfCircleContainer,
          { width: halfSize, height: size, left: 0 },
        ]}
      >
        <Animated.View
          style={[
            styles.halfCircle,
            {
              width: size,
              height: size,
              borderRadius: halfSize,
              borderWidth: strokeWidth,
              borderColor: PROGRESS_COLOR,
            },
            firstHalfStyle,
          ]}
        />
      </View>

      {/* Друге напівколо (права половина) — наступні 50% прогресу */}
      <View
        style={[
          styles.halfCircleContainer,
          { width: halfSize, height: size, right: 0 },
        ]}
      >
        <Animated.View
          style={[
            styles.halfCircle,
            {
              width: size,
              height: size,
              borderRadius: halfSize,
              borderWidth: strokeWidth,
              borderColor: PROGRESS_COLOR,
              right: 0,
            },
            secondHalfStyle,
          ]}
        />
      </View>

      {/* Внутрішнє коло (вирізає центр для ефекту кільця) */}
      <View
        style={[
          styles.innerCircle,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            top: strokeWidth,
            left: strokeWidth,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  halfCircleContainer: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  halfCircle: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  innerCircle: {
    position: 'absolute',
    backgroundColor: 'white',
  },
});

export default ProgressRing;
