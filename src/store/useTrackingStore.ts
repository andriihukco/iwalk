/**
 * Zustand store для стану відстеження iWalk
 * Вимоги: 7.2, 9.1, 9.2, 9.4, 10.4
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Waypoint } from '../types';
import { TrackingConfig } from '../constants/tracking';

/**
 * Обчислює відстань між двома координатами за формулою Haversine (в метрах)
 */
function haversineDistance(a: Waypoint, b: Waypoint): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

interface TrackingState {
  isTracking: boolean;
  isPaused: boolean;
  walkedDistanceMeters: number;
  lastLocation: Waypoint | null;
  startedAt: number | null; // Unix timestamp
  isEnergyMode: boolean;
  setIsTracking: (tracking: boolean) => void;
  setIsPaused: (paused: boolean) => void;
  setLastLocation: (location: Waypoint | null) => void;
  setStartedAt: (timestamp: number | null) => void;
  setIsEnergyMode: (energyMode: boolean) => void;
  updateDistance: (newLocation: Waypoint) => void;
  reset: () => void;
}

const initialState = {
  isTracking: false,
  isPaused: false,
  walkedDistanceMeters: 0,
  lastLocation: null,
  startedAt: null,
  isEnergyMode: false,
};

export const useTrackingStore = create<TrackingState>()(
  persist(
    (set, get) => ({
      // Default values
      ...initialState,

      // Setters
      setIsTracking: (tracking) => set({ isTracking: tracking }),
      setIsPaused: (paused) => set({ isPaused: paused }),
      setLastLocation: (location) => set({ lastLocation: location }),
      setStartedAt: (timestamp) => set({ startedAt: timestamp }),
      setIsEnergyMode: (energyMode) => set({ isEnergyMode: energyMode }),

      /**
       * Оновлює пройдену дистанцію на основі нової геолокації.
       * Дистанція оновлюється тільки якщо відстань від попередньої точки
       * перевищує поріг (50 м у стандартному режимі, 100 м у EnergyMode).
       * Вимоги: 7.2, 9.2
       */
      updateDistance: (newLocation: Waypoint) => {
        const { lastLocation, isEnergyMode, walkedDistanceMeters } = get();

        // Перше оновлення — просто зберігаємо позицію
        if (lastLocation === null) {
          set({ lastLocation: newLocation });
          return;
        }

        const distance = haversineDistance(lastLocation, newLocation);
        const threshold = isEnergyMode
          ? TrackingConfig.energyDistanceInterval
          : TrackingConfig.normalDistanceInterval;

        // Оновлюємо тільки якщо відстань перевищує поріг
        if (distance >= threshold) {
          set({
            walkedDistanceMeters: walkedDistanceMeters + distance,
            lastLocation: newLocation,
          });
        }
      },

      /**
       * Скидає стан відстеження до початкових значень
       */
      reset: () => set(initialState),
    }),
    {
      name: 'iwalk-tracking-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
