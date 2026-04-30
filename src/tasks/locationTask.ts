/**
 * Фонова задача відстеження геолокації для iWalk
 * ВАЖЛИВО: цей файл ОБОВ'ЯЗКОВО імпортується у глобальному скоупі (_layout.tsx),
 * а не всередині компонентів — інакше iOS/Android не зможуть відновити задачу.
 * Вимоги: 8.1, 8.2
 */
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { useTrackingStore } from '../store/useTrackingStore';

export const LOCATION_TASK_NAME = 'IWALK_BACKGROUND_LOCATION';

TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) {
    // Логуємо помилку задачі
    console.error('[LocationTask] Background task error:', error.message);
    return;
  }

  if (!data) {
    console.warn('[LocationTask] No data received in background task');
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };

  if (!locations || locations.length === 0) {
    return;
  }

  // Отримуємо останню отриману позицію
  const latestLocation = locations[locations.length - 1];

  if (!latestLocation?.coords) {
    console.warn('[LocationTask] Invalid location object received');
    return;
  }

  const { latitude, longitude } = latestLocation.coords;

  // Оновлюємо пройдену дистанцію у store (поза React-компонентами через getState())
  try {
    useTrackingStore.getState().updateDistance({ latitude, longitude });
  } catch (updateError) {
    console.error('[LocationTask] Failed to update distance in store:', updateError);
  }
});
