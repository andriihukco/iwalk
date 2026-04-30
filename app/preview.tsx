/**
 * PreviewStage — екран перегляду та редагування маршруту iWalk
 *
 * Вимоги: 3.3, 3.6, 6.1–6.6, 10.3, 12.3
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';

import { RouteMapView } from '../src/components/MapView/RouteMapView';
import { GlassPanel } from '../src/components/ui/GlassPanel';
import { buildRoute } from '../src/modules/route-builder/routeBuilder';
import { useRouteStore } from '../src/store/useRouteStore';
import { Colors } from '../src/constants/colors';
import type { Waypoint } from '../src/types';

// ─── Константи ────────────────────────────────────────────────────────────────

/** Тег для Shared Element Transition між PreviewStage та ActiveStage */
const SHARED_MAP_TAG = 'route-map';

/** Тривалість показу Toast-повідомлення (мс) */
const TOAST_DURATION_MS = 3500;

// ─── Допоміжні функції ─────────────────────────────────────────────────────────

/** Форматує дистанцію у зручний рядок */
function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} м`;
  }
  return `${km.toFixed(1)} км`;
}

/** Форматує тривалість у хвилини */
function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `~${minutes} хв`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `~${hours} год ${mins} хв`;
}

// ─── Компонент Toast ──────────────────────────────────────────────────────────

interface ToastProps {
  message: string;
  visible: boolean;
}

function Toast({ message, visible }: ToastProps): React.JSX.Element | null {
  if (!visible) return null;
  return (
    <View style={styles.toast} accessibilityLiveRegion="polite">
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}

// ─── Компонент PreviewStage ───────────────────────────────────────────────────

export default function PreviewStage(): React.JSX.Element {
  const router = useRouter();

  // ── Стан зі store ──────────────────────────────────────────────────────────
  const waypoints = useRouteStore((s) => s.waypoints);
  const polyline = useRouteStore((s) => s.polyline);
  const targetDistanceKm = useRouteStore((s) => s.targetDistanceKm);
  const isLoading = useRouteStore((s) => s.isLoading);
  const error = useRouteStore((s) => s.error);

  const setWaypoints = useRouteStore((s) => s.setWaypoints);
  const setPolyline = useRouteStore((s) => s.setPolyline);
  const setIsLoading = useRouteStore((s) => s.setIsLoading);
  const setError = useRouteStore((s) => s.setError);

  // ── Локальний стан ─────────────────────────────────────────────────────────
  /** Тривалість маршруту в секундах (з останньої успішної відповіді OSRM) */
  const [routeDurationSeconds, setRouteDurationSeconds] = useState<number>(0);
  /** Фактична дистанція маршруту в метрах (з OSRM) */
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number>(0);

  /** Видимість Toast-повідомлення про помилку */
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Показати Toast (Вимога 3.4) ────────────────────────────────────────────
  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    setToastVisible(true);
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
    }, TOAST_DURATION_MS);
  }, []);

  // Показати Toast при появі помилки у store
  useEffect(() => {
    if (error) {
      showToast(error.message);
    }
  }, [error, showToast]);

  // Очистити таймер при розмонтуванні
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // ── Перебудова маршруту після перетягування маркера (Вимоги 3.6, 6.4) ─────
  const handleWaypointDrag = useCallback(
    async (index: number, newPosition: Waypoint) => {
      // Оновити вейпоінт у масиві
      const updatedWaypoints = waypoints.map((wp, i) =>
        i === index ? newPosition : wp,
      );
      setWaypoints(updatedWaypoints);

      // Показати індикатор завантаження
      setIsLoading(true);
      setError(null);

      // Надіслати новий запит до OSRM (Вимога 3.6)
      const result = await buildRoute(updatedWaypoints);

      if (!result.ok) {
        setError(result.error);
        setIsLoading(false);
        // Toast показується через useEffect вище
        return;
      }

      // Оновити полілінію та метрики маршруту (Вимога 3.3)
      setPolyline(result.value.polyline);
      setRouteDurationSeconds(result.value.durationSeconds);
      setRouteDistanceMeters(result.value.distanceMeters);
      setIsLoading(false);
    },
    [waypoints, setWaypoints, setIsLoading, setError, setPolyline],
  );

  // ── Навігація "Start" → ActiveStage (Вимога 6.6) ──────────────────────────
  const handleStart = useCallback(() => {
    // Shared Element Transition відбувається автоматично через sharedTransitionTag
    router.push('/active');
  }, [router]);

  // ── Навігація "Назад" → ConfigStage (Вимога 10.3) ─────────────────────────
  // Параметри зберігаються у store автоматично (persist middleware)
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // ── Відображення метрик маршруту ───────────────────────────────────────────
  const displayDistanceKm =
    routeDistanceMeters > 0
      ? routeDistanceMeters / 1000
      : targetDistanceKm;

  // ── Рендер ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/*
       * MotiView — анімована поява карти (Вимога 6.1)
       * Spring-анімація: opacity 0→1, translateY 20→0
       */}
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{
          type: 'spring',
          mass: 1,
          damping: 15,
          stiffness: 120,
        }}
        style={styles.mapContainer}
      >
        {/*
         * RouteMapView з sharedTransitionTag для Shared Element Transition
         * між PreviewStage та ActiveStage (Вимога 6.6, 7.7)
         */}
        <RouteMapView
          polyline={polyline}
          waypoints={waypoints}
          userLocation={null}
          onWaypointDrag={handleWaypointDrag}
          sharedTransitionTag={SHARED_MAP_TAG}
        />
      </MotiView>

      {/* Індикатор завантаження при перебудові маршруту */}
      {isLoading ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <View style={styles.loadingBadge}>
            <ActivityIndicator color={Colors.routeGreen} size="small" />
            <Text style={styles.loadingText}>Оновлення маршруту…</Text>
          </View>
        </View>
      ) : null}

      {/* Toast-повідомлення про помилку OSRM (Вимога 3.4) */}
      <Toast message={toastMessage} visible={toastVisible} />

      {/*
       * GlassPanel — панель керування з ефектом скла (Вимога 6.5)
       * Відображає метрики маршруту та кнопки "Назад" / "Start"
       */}
      <GlassPanel style={styles.glassPanel}>
        {/* Метрики маршруту */}
        <View style={styles.routeInfo}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>
              {formatDistance(displayDistanceKm)}
            </Text>
            <Text style={styles.metricLabel}>Дистанція</Text>
          </View>

          {routeDurationSeconds > 0 ? (
            <View style={styles.metricDivider} />
          ) : null}

          {routeDurationSeconds > 0 ? (
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>
                {formatDuration(routeDurationSeconds)}
              </Text>
              <Text style={styles.metricLabel}>Час</Text>
            </View>
          ) : null}
        </View>

        {/* Кнопки навігації */}
        <View style={styles.buttonRow}>
          {/* Кнопка "Назад" (Вимога 10.3) */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Назад до налаштувань"
          >
            <Text style={styles.backButtonText}>Назад</Text>
          </TouchableOpacity>

          {/* Кнопка "Start" (Вимога 6.6) */}
          <TouchableOpacity
            style={[styles.startButton, isLoading && styles.startButtonDisabled]}
            onPress={handleStart}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Розпочати маршрут"
            accessibilityState={{ disabled: isLoading }}
          >
            <Text style={styles.startButtonText}>Start</Text>
          </TouchableOpacity>
        </View>

        {/* Індикатор "Дані обробляються локально" (Вимога 12.3) */}
        <View style={styles.privacyIndicator}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <Text style={styles.privacyText}>Дані обробляються локально</Text>
        </View>
      </GlassPanel>
    </View>
  );
}

// ─── Стилі ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  mapContainer: {
    flex: 1,
  },
  // Накладка завантаження поверх карти
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 60,
  },
  loadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  // Toast-повідомлення про помилку
  toast: {
    position: 'absolute',
    bottom: 220,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.92)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  // GlassPanel — нижня панель керування
  glassPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  // Метрики маршруту
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  metricItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  // Рядок кнопок
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  // Кнопка "Назад"
  backButton: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  // Кнопка "Start"
  startButton: {
    flex: 2,
    backgroundColor: Colors.routeGreen,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: Colors.routeGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  startButtonDisabled: {
    backgroundColor: '#C7C7CC',
    shadowOpacity: 0,
    elevation: 0,
  },
  startButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  // Індикатор приватності
  privacyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyIcon: {
    fontSize: 13,
    marginRight: 5,
  },
  privacyText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
});
