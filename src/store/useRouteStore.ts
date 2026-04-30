/**
 * Zustand store для стану маршруту iWalk
 * Вимоги: 3.5, 6.4
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Waypoint, RouteError } from '../types';

interface RouteState {
  waypoints: Waypoint[];
  polyline: GeoJSON.LineString | null;
  targetDistanceKm: number;
  isLoading: boolean;
  error: RouteError | null;
  setWaypoints: (waypoints: Waypoint[]) => void;
  setPolyline: (polyline: GeoJSON.LineString) => void;
  setTargetDistanceKm: (km: number) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: RouteError | null) => void;
}

export const useRouteStore = create<RouteState>()(
  persist(
    (set) => ({
      // Default values
      waypoints: [],
      polyline: null,
      targetDistanceKm: 0,
      isLoading: false,
      error: null,

      // Setters
      setWaypoints: (waypoints) => set({ waypoints }),
      setPolyline: (polyline) => set({ polyline }),
      setTargetDistanceKm: (km) => set({ targetDistanceKm: km }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'iwalk-route-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
