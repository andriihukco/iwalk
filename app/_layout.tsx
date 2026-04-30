/**
 * Root Layout — ініціалізація Expo Router, TaskManager та теми iWalk
 *
 * ВАЖЛИВО: імпорт `src/tasks/locationTask.ts` у глобальному скоупі
 * забезпечує реєстрацію TaskManager задачі при старті додатку.
 * TaskManager.defineTask() ОБОВ'ЯЗКОВО викликається поза компонентами.
 *
 * Вимоги: 8.1, 10.1, 10.2
 */

// ─── Глобальна реєстрація TaskManager задачі (Вимога 8.1) ────────────────────
// Цей імпорт ОБОВ'ЯЗКОВО знаходиться на верхньому рівні модуля,
// щоб TaskManager.defineTask() виконався до монтування будь-якого компонента.
import '../src/tasks/locationTask';

import React from 'react';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Colors } from '../src/constants/colors';

// ─── Root Layout ──────────────────────────────────────────────────────────────

export default function RootLayout(): React.JSX.Element {
  // Визначення поточної теми (темна/світла) для NativeWind та акцентних кольорів
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Акцентний колір відповідно до теми (Вимога 11.2)
  const accentColor = isDark ? Colors.systemBlue.dark : Colors.systemBlue.light;

  return (
    <>
      {/*
       * StatusBar адаптується до теми:
       * - темна тема → світлий контент
       * - світла тема → темний контент
       */}
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/*
       * Expo Router Stack з підтримкою Deep Linking (Вимоги 10.1, 10.2)
       *
       * Екрани:
       * - index    → ConfigStage  (головний екран)
       * - preview  → PreviewStage (перегляд маршруту)
       * - active   → ActiveStage  (активне відстеження)
       *
       * Deep Linking для ActiveStage дозволяє відновити екран
       * при відкритті додатку з повідомлення або Live Activity (Вимога 10.2).
       *
       * headerShown: false — повноекранний UI без нативного заголовка.
       */}
      <Stack
        screenOptions={{
          headerShown: false,
          // Анімація переходу між екранами
          animation: 'slide_from_right',
          // Колір фону під час переходу
          contentStyle: {
            backgroundColor: isDark ? '#000000' : '#F2F2F7',
          },
        }}
      >
        {/* ConfigStage — головний екран налаштування маршруту */}
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
            // Без анімації для першого екрану
            animation: 'none',
          }}
        />

        {/* PreviewStage — перегляд та редагування маршруту */}
        <Stack.Screen
          name="preview"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />

        {/*
         * ActiveStage — активне відстеження маршруту
         * Підтримує Deep Linking для відновлення при перезапуску (Вимога 10.2)
         * URL схема: iwalk://active
         */}
        <Stack.Screen
          name="active"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            // Заборонити свайп назад під час активного відстеження
            gestureEnabled: false,
          }}
        />
      </Stack>
    </>
  );
}
