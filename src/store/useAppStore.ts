/**
 * Zustand store для головного стану додатку iWalk
 * Вимоги: 1.6, 5.4, 5.5, 10.3
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppState {
  stage: 'config' | 'preview' | 'active' | 'completion';
  heightCm: number;
  stepGoal: number;
  routeMode: 'loop' | 'destination';
  discoveryMode: boolean;
  intensityMode: boolean;
  setStage: (stage: AppState['stage']) => void;
  setHeight: (cm: number) => void;
  setStepGoal: (steps: number) => void;
  setRouteMode: (mode: 'loop' | 'destination') => void;
  setDiscoveryMode: (enabled: boolean) => void;
  setIntensityMode: (enabled: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Default values
      stage: 'config',
      heightCm: 170,
      stepGoal: 10000,
      routeMode: 'loop',
      discoveryMode: false,
      intensityMode: false,

      // Setters
      setStage: (stage) => set({ stage }),
      setHeight: (cm) => set({ heightCm: cm }),
      setStepGoal: (steps) => set({ stepGoal: steps }),
      setRouteMode: (mode) => set({ routeMode: mode }),
      setDiscoveryMode: (enabled) => set({ discoveryMode: enabled }),
      setIntensityMode: (enabled) => set({ intensityMode: enabled }),
    }),
    {
      name: 'iwalk-app-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
