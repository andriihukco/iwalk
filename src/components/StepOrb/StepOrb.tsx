/**
 * StepOrb — сферичний слайдер для введення цілі кроків.
 *
 * Жест обертання змінює значення з кроком 500.
 * Розмір сфери пропорційно зростає зі значенням.
 * Тактильний відгук надається кожні 500 кроків.
 *
 * Вимоги: 5.1, 5.2, 5.3
 */

import React, { useCallback, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../constants/colors';
import { SpringConfig } from '../../constants/animation';

// ─── Константи ────────────────────────────────────────────────────────────────

/** Мінімальний розмір сфери в пікселях */
const BASE_SIZE = 120;

/** Максимальне значення цілі кроків */
const MAX_VALUE = 50_000;

/** Діапазон зміни розміру (120 → 200 пікселів) */
const SIZE_RANGE = 80;

/**
 * Кількість кроків на один повний оберт (2π радіан).
 * Один повний оберт = 5 000 кроків.
 */
const STEPS_PER_FULL_ROTATION = 5_000;

// ─── Чиста функція обчислення розміру ─────────────────────────────────────────

/**
 * Обчислює візуальний розмір сфери StepOrb.
 *
 * @param value    Поточне значення кроків (500–50 000)
 * @param maxValue Максимальне значення (за замовчуванням 50 000)
 * @returns        Розмір сфери в пікселях
 *
 * Вимога 5.3: розмір монотонно зростає зі значенням.
 */
export function computeOrbSize(value: number, maxValue: number = MAX_VALUE): number {
  return BASE_SIZE + (value / maxValue) * SIZE_RANGE;
}

// ─── Допоміжні функції ─────────────────────────────────────────────────────────

/**
 * Обмежує значення діапазоном [min, max] та округлює до кратного step.
 */
function clampAndSnap(value: number, min: number, max: number, step: number): number {
  const snapped = Math.round(value / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

// ─── Типи ─────────────────────────────────────────────────────────────────────

interface StepOrbProps {
  /** Поточне значення (500–50 000) */
  value: number;
  onChange: (value: number) => void;
  /** За замовчуванням 500 */
  minValue?: number;
  /** За замовчуванням 50 000 */
  maxValue?: number;
  /** За замовчуванням 500 */
  step?: number;
}

// ─── Компонент ────────────────────────────────────────────────────────────────

/**
 * StepOrb — сферичний слайдер для введення цілі кроків.
 *
 * Вимоги: 5.1, 5.2, 5.3
 */
export function StepOrb({
  value,
  onChange,
  minValue = 500,
  maxValue = MAX_VALUE,
  step = 500,
}: StepOrbProps): React.JSX.Element {
  // Зберігаємо значення на початку жесту для обчислення дельти
  const baseValueRef = useRef(value);
  // Зберігаємо попереднє значення для визначення моменту тактильного відгуку
  const lastHapticValueRef = useRef(value);

  // Shared value для анімованого розміру
  const animatedSize = useSharedValue(computeOrbSize(value, maxValue));

  // Оновлюємо анімований розмір при зміні value ззовні
  React.useEffect(() => {
    animatedSize.value = withSpring(computeOrbSize(value, maxValue), SpringConfig);
  }, [value, maxValue, animatedSize]);

  // Анімований стиль сфери (Вимога 5.3)
  const animatedStyle = useAnimatedStyle(() => ({
    width: animatedSize.value,
    height: animatedSize.value,
    borderRadius: animatedSize.value / 2,
  }));

  // Обробник зміни значення з тактильним відгуком
  const handleValueChange = useCallback(
    (newValue: number) => {
      const clamped = clampAndSnap(newValue, minValue, maxValue, step);

      // Тактильний відгук кожні 500 кроків (Вимога 5.2)
      const prevStep = Math.round(lastHapticValueRef.current / step);
      const currStep = Math.round(clamped / step);
      if (currStep !== prevStep) {
        lastHapticValueRef.current = clamped;
        Haptics.selectionAsync();
      }

      onChange(clamped);
    },
    [minValue, maxValue, step, onChange],
  );

  // Жест обертання (Вимога 5.2)
  const rotationGesture = Gesture.Rotation()
    .runOnJS(true)
    .onBegin(() => {
      baseValueRef.current = value;
      lastHapticValueRef.current = value;
    })
    .onChange((event) => {
      // event.rotation — кут у радіанах від початку жесту
      // Один повний оберт (2π) = STEPS_PER_FULL_ROTATION кроків
      const deltaSteps =
        (event.rotation / (2 * Math.PI)) * STEPS_PER_FULL_ROTATION;
      const newValue = baseValueRef.current + deltaSteps;
      handleValueChange(newValue);
    });

  const orbSize = computeOrbSize(value, maxValue);

  return (
    <GestureDetector gesture={rotationGesture}>
      <Animated.View
        style={[styles.orb, animatedStyle, { backgroundColor: Colors.systemBlue.light }]}
        accessibilityRole="adjustable"
        accessibilityLabel={`Ціль кроків: ${value}`}
        accessibilityHint="Обертайте для зміни цілі кроків"
        accessibilityValue={{ min: minValue, max: maxValue, now: value }}
      >
        <View style={styles.content}>
          <Text
            style={[styles.valueText, { fontSize: orbSize * 0.22 }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {value.toLocaleString('uk-UA')}
          </Text>
          <Text style={styles.labelText}>кроків</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Стилі ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    // Тінь для ефекту сфери
    shadowColor: Colors.systemBlue.light,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  labelText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
});

export default StepOrb;
