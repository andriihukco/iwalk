/**
 * ActiveStage — екран активного відстеження маршруту iWalk
 *
 * Вимоги: 7.1–7.7, 8.3–8.5, 9.1–9.4, 10.2, 10.4
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as Battery from 'expo-battery';

import { RouteMapView } from '../src/components/MapView/RouteMapView';
import { LiveActivityDashboard } from '../src/components/LiveActivityDashboard/LiveActivityDashboard';
import { startTracking, stopTracking } from '../src/modules/location-tracker/locationTracker';
import { useTrackingStore } from '../src/store/useTrackingStore';
import { useRouteStore } from '../src/store/useRouteStore';
import { TrackingConfig } from '../src/constants/tracking';
import { Colors } from '../src/constants/colors';
import type { Waypoint } from '../src/types';

// ─── Константи ────────────────────────────────────────────────────────────────

/** Тег для Shared Element Transition між PreviewStage та ActiveStage */
const SHARED_MAP_TAG = 'route-map';

// ─── Допоміжні функції ─────────────────────────────────────────────────────────

/** Форматує час у секундах у рядок "Xгод Xхв Xс" */
function formatElapsedTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}год ${m}хв ${s}с`;
  }
  if (m > 0) {
    return `${m}хв ${s}с`;
  }
  return `${s}с`;
}

/** Форматує дистанцію у зручний рядок */
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} м`;
  }
  return `${(meters / 1000).toFixed(2)} км`;
}

// ─── Компонент CompletionModal ────────────────────────────────────────────────

interface CompletionModalProps {
  visible: boolean;
  walkedDistanceMeters: number;
  elapsedSeconds: number;
  onDone: () => void;
}

function CompletionModal({
  visible,
  walkedDistanceMeters,
  elapsedSeconds,
  onDone,
}: CompletionModalProps): React.JSX.Element {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Заголовок */}
          <Text style={styles.modalTitle}>🎉 Маршрут завершено!</Text>
          <Text style={styles.modalSubtitle}>Вітаємо з успішною прогулянкою</Text>

          {/* Статистика */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {formatDistance(walkedDistanceMeters)}
              </Text>
              <Text style={styles.statLabel}>Пройдено</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {formatElapsedTime(elapsedSeconds)}
              </Text>
              <Text style={styles.statLabel}>Час</Text>
            </View>
          </View>

          {/* Кнопка Done */}
          <TouchableOpacity
            style={styles.doneButton}
            onPress={onDone}
            accessibilityRole="button"
            accessibilityLabel="Завершити та повернутися на головний екран"
          >
            <Text style={styles.doneButtonText}>Готово</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Компонент ActiveStage ────────────────────────────────────────────────────

export default function ActiveStage(): React.JSX.Element {
  const router = useRouter();

  // ── Дані зі stores ─────────────────────────────────────────────────────────
  const waypoints = useRouteStore((s) => s.waypoints);
  const polyline = useRouteStore((s) => s.polyline);
  const targetDistanceKm = useRouteStore((s) => s.targetDistanceKm);

  const isTracking = useTrackingStore((s) => s.isTracking);
  const isPaused = useTrackingStore((s) => s.isPaused);
  const walkedDistanceMeters = useTrackingStore((s) => s.walkedDistanceMeters);
  const lastLocation = useTrackingStore((s) => s.lastLocation);
  const startedAt = useTrackingStore((s) => s.startedAt);
  const isEnergyMode = useTrackingStore((s) => s.isEnergyMode);

  const setIsTracking = useTrackingStore((s) => s.setIsTracking);
  const setIsPaused = useTrackingStore((s) => s.setIsPaused);
  const setStartedAt = useTrackingStore((s) => s.setStartedAt);
  const setIsEnergyMode = useTrackingStore((s) => s.setIsEnergyMode);
  const resetTracking = useTrackingStore((s) => s.reset);

  // ── Локальний стан ─────────────────────────────────────────────────────────
  const [showCompletion, setShowCompletion] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completionTriggered, setCompletionTriggered] = useState(false);
  /**
   * Поточний FPS для карти: 60 у стандартному режимі, 15 у EnergyMode.
   * Використовується для throttle оновлень userLocation на карті.
   * Вимога 9.1
   */
  const [mapFPS, setMapFPS] = useState<number>(TrackingConfig.normalFPS);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackingStartedRef = useRef(false);
  /**
   * Ref для throttle оновлень карти відповідно до поточного FPS.
   * Зберігає timestamp останнього оновлення userLocation на карті.
   */
  const lastMapUpdateRef = useRef<number>(0);
  /**
   * Ref для відстеження, чи вже було показано повідомлення про EnergyMode.
   * Забезпечує одноразове відображення (Вимога 9.3).
   */
  const energyModeAlertShownRef = useRef(false);
  /**
   * Throttled userLocation для карти — оновлюється не частіше ніж mapFPS разів на секунду.
   */
  const [throttledUserLocation, setThrottledUserLocation] = useState<Waypoint | null>(null);

  // ── Таймер прогресу ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isTracking && !isPaused && startedAt) {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        setElapsedSeconds(Math.floor((now - startedAt) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isTracking, isPaused, startedAt]);

  // ── Відновлення ActiveStage при перезапуску (Вимога 10.4) ─────────────────
  // Якщо store вже містить активну сесію (гідратація з AsyncStorage),
  // відновлюємо elapsed time без повторного запуску трекера
  useEffect(() => {
    if (isTracking && startedAt && !trackingStartedRef.current) {
      // Відновлення після перезапуску — трекер вже запущений у фоні
      trackingStartedRef.current = true;
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - startedAt) / 1000));
    }
  }, [isTracking, startedAt]);

  // ── Запуск відстеження при монтуванні (Вимоги 7.1, 8.3) ──────────────────
  useEffect(() => {
    let mounted = true;

    async function initTracking() {
      // Якщо вже відстежуємо (відновлення після перезапуску) — не запускати повторно
      if (isTracking && trackingStartedRef.current) {
        return;
      }

      // Запитати дозвіл на фонову геолокацію (Вимога 4.2)
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (!mounted) return;

      if (status !== 'granted') {
        // Продовжуємо без фонового відстеження (Вимога 4.4)
        console.warn('[ActiveStage] Фоновий дозвіл на геолокацію відхилено');
      }

      // Визначити інтервал відстеження залежно від EnergyMode (Вимоги 9.1, 9.2)
      const distanceInterval = isEnergyMode
        ? TrackingConfig.energyDistanceInterval
        : TrackingConfig.normalDistanceInterval;

      try {
        await startTracking({
          accuracy: Location.Accuracy.Balanced,
          distanceInterval,
        });

        if (!mounted) return;

        trackingStartedRef.current = true;
        const now = Date.now();
        setStartedAt(now);
        setIsTracking(true);
        setIsPaused(false);
      } catch (err) {
        console.error('[ActiveStage] Помилка запуску відстеження:', err);
      }
    }

    initTracking();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Підписка на рівень заряду батареї (Вимоги 9.1–9.4) ──────────────────
  useEffect(() => {
    const subscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      if (batteryLevel < TrackingConfig.batteryThresholdLow && !isEnergyMode) {
        // Активувати EnergyMode (Вимоги 9.1, 9.2, 9.3)
        setIsEnergyMode(true);
        setMapFPS(TrackingConfig.energyFPS);

        // Показати одноразове повідомлення (Вимога 9.3)
        if (!energyModeAlertShownRef.current) {
          energyModeAlertShownRef.current = true;
          Alert.alert(
            'Режим енергозбереження',
            'Режим енергозбереження активовано. Частота оновлень знижена для збереження заряду батареї.',
            [{ text: 'OK' }],
          );
        }

        // Перезапустити відстеження з новим distanceInterval (Вимога 9.2)
        if (isTracking && !isPaused) {
          stopTracking()
            .then(() =>
              startTracking({
                accuracy: Location.Accuracy.Balanced,
                distanceInterval: TrackingConfig.energyDistanceInterval,
              }),
            )
            .catch((err) =>
              console.error('[ActiveStage] Помилка перезапуску відстеження (EnergyMode):', err),
            );
        }
      } else if (batteryLevel > TrackingConfig.batteryThresholdRestore && isEnergyMode) {
        // Деактивувати EnergyMode (Вимога 9.4)
        setIsEnergyMode(false);
        setMapFPS(TrackingConfig.normalFPS);

        // Перезапустити відстеження зі стандартним distanceInterval (Вимога 9.4)
        if (isTracking && !isPaused) {
          stopTracking()
            .then(() =>
              startTracking({
                accuracy: Location.Accuracy.Balanced,
                distanceInterval: TrackingConfig.normalDistanceInterval,
              }),
            )
            .catch((err) =>
              console.error('[ActiveStage] Помилка перезапуску відстеження (відновлення):', err),
            );
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isEnergyMode, isTracking, isPaused, setIsEnergyMode]);

  // ── Throttle оновлень userLocation для карти відповідно до mapFPS ─────────
  useEffect(() => {
    const minIntervalMs = 1000 / mapFPS;
    const now = Date.now();
    if (now - lastMapUpdateRef.current >= minIntervalMs) {
      lastMapUpdateRef.current = now;
      setThrottledUserLocation(lastLocation);
    }
  }, [lastLocation, mapFPS]);

  // ── Перевірка досягнення цільової дистанції (Вимога 7.6) ─────────────────
  useEffect(() => {
    if (completionTriggered) return;
    if (targetDistanceKm <= 0) return;

    const targetMeters = targetDistanceKm * 1000;
    if (walkedDistanceMeters >= targetMeters) {
      setCompletionTriggered(true);

      // Тактильний відгук (Вимога 7.6)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Зупинити відстеження
      stopTracking().catch((err) =>
        console.error('[ActiveStage] Помилка зупинки відстеження:', err),
      );
      setIsTracking(false);

      // Показати екран завершення
      setShowCompletion(true);
    }
  }, [walkedDistanceMeters, targetDistanceKm, completionTriggered, setIsTracking]);

  // ── Обробник Pause / Resume (Вимога 7.5) ──────────────────────────────────
  const handlePause = useCallback(async () => {
    if (isPaused) {
      // Resume — перезапустити відстеження
      const distanceInterval = isEnergyMode
        ? TrackingConfig.energyDistanceInterval
        : TrackingConfig.normalDistanceInterval;

      try {
        await startTracking({
          accuracy: Location.Accuracy.Balanced,
          distanceInterval,
        });
        setIsPaused(false);
        setIsTracking(true);
      } catch (err) {
        console.error('[ActiveStage] Помилка відновлення відстеження:', err);
      }
    } else {
      // Pause — зупинити відстеження
      try {
        await stopTracking();
        setIsPaused(true);
        setIsTracking(false);
      } catch (err) {
        console.error('[ActiveStage] Помилка паузи відстеження:', err);
      }
    }
  }, [isPaused, isEnergyMode, setIsPaused, setIsTracking]);

  // ── Обробник Stop ──────────────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    try {
      await stopTracking();
    } catch (err) {
      console.error('[ActiveStage] Помилка зупинки відстеження:', err);
    }
    setIsTracking(false);
    setIsPaused(false);
    router.replace('/');
  }, [setIsTracking, setIsPaused, router]);

  // ── Обробник Done (екран завершення) ──────────────────────────────────────
  const handleDone = useCallback(() => {
    setShowCompletion(false);
    resetTracking();
    router.replace('/');
  }, [resetTracking, router]);

  // ── Поточна геолокація для карти ──────────────────────────────────────────
  // Використовуємо throttledUserLocation для обмеження FPS карти (Вимога 9.1)
  const userLocation: Waypoint | null = throttledUserLocation;

  // ── Рендер ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/*
       * RouteMapView на весь екран зі Shared Element Transition (Вимога 7.7)
       * sharedTransitionTag="route-map" — той самий тег, що й у PreviewStage
       */}
      <RouteMapView
        polyline={polyline}
        waypoints={waypoints}
        userLocation={userLocation}
        onWaypointDrag={() => {
          // У ActiveStage перетягування маркерів вимкнено
        }}
        fullScreen
        sharedTransitionTag={SHARED_MAP_TAG}
      />

      {/*
       * LiveActivityDashboard поверх карти (Вимога 7.3)
       * Відображає прогрес-кільце, залишок дистанції та кнопку Pause
       */}
      <View style={styles.dashboardContainer}>
        <LiveActivityDashboard
          targetDistanceKm={targetDistanceKm}
          onPause={handlePause}
          onStop={handleStop}
        />
      </View>

      {/*
       * Екран завершення маршруту (Вимога 7.6)
       * Показується при досягненні TargetDistance
       */}
      <CompletionModal
        visible={showCompletion}
        walkedDistanceMeters={walkedDistanceMeters}
        elapsedSeconds={elapsedSeconds}
        onDone={handleDone}
      />
    </View>
  );
}

// ─── Стилі ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  // Контейнер для LiveActivityDashboard — прикріплений до низу екрану
  dashboardContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 36,
  },
  // ── Completion Modal ──────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 28,
  },
  // Рядок статистики
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 28,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    marginHorizontal: 16,
  },
  // Кнопка Done
  doneButton: {
    backgroundColor: Colors.routeGreen,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
    shadowColor: Colors.routeGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
