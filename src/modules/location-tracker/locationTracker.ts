/**
 * Модуль фонового відстеження геолокації для iWalk
 * Вимоги: 7.1, 7.5, 8.3, 8.4
 */
import * as Location from 'expo-location';
import { LOCATION_TASK_NAME } from '../../tasks/locationTask';
import type { Waypoint } from '../../types';

export interface TrackingOptions {
  accuracy: Location.Accuracy;
  distanceInterval: number; // метри між оновленнями
  timeInterval?: number;    // мс між оновленнями (опціонально)
}

/**
 * Запускає фонове відстеження геолокації через Expo TaskManager.
 * Реєструє задачу LOCATION_TASK_NAME для отримання оновлень у фоні.
 * Вимоги: 7.1, 8.3
 */
export async function startTracking(options: TrackingOptions): Promise<void> {
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: options.accuracy,
    distanceInterval: options.distanceInterval,
    timeInterval: options.timeInterval,
    // Показувати індикатор фонового відстеження на iOS
    showsBackgroundLocationIndicator: true,
    // Пауза оновлень при відсутності руху (економія батареї)
    pausesUpdatesAutomatically: false,
  });
}

/**
 * Зупиняє фонове відстеження геолокації.
 * Вимоги: 7.5, 8.4
 */
export async function stopTracking(): Promise<void> {
  const isRegistered = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}

/**
 * Обчислює відстань між двома географічними координатами за формулою Haversine.
 * Повертає відстань у метрах.
 */
export function haversineDistance(a: Waypoint, b: Waypoint): number {
  const R = 6371000; // Радіус Землі в метрах
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
