/**
 * Модуль обчислення довжини маршруту (Converter)
 * Чисті функції для обчислення Stride, TargetDistance та валідації вхідних даних.
 */

import { ValidationResult } from '../../types/index';

/**
 * Обчислює довжину кроку в метрах.
 * Формула: Stride (м) = Height (см) × 0.414 / 100
 */
export function calculateStride(heightCm: number): number {
  return (heightCm * 0.414) / 100;
}

/**
 * Обчислює цільову дистанцію в кілометрах.
 * Формула: TargetDistance (км) = (StepGoal × Stride) / 1000
 */
export function calculateTargetDistance(stepGoal: number, stride: number): number {
  return (stepGoal * stride) / 1000;
}

/**
 * Валідує зріст користувача.
 * Допустимий діапазон: 100–250 см.
 */
export function validateHeight(heightCm: number): ValidationResult {
  if (heightCm < 100 || heightCm > 250) {
    return {
      valid: false,
      error: 'Зріст має бути від 100 до 250 см',
    };
  }
  return { valid: true };
}

/**
 * Валідує ціль кроків.
 * Допустимий діапазон: 500–50 000 кроків.
 */
export function validateStepGoal(stepGoal: number): ValidationResult {
  if (stepGoal < 500 || stepGoal > 50_000) {
    return {
      valid: false,
      error: 'Ціль кроків має бути від 500 до 50 000',
    };
  }
  return { valid: true };
}
