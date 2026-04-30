/**
 * LiveActivityDashboard — панель активного відстеження
 * Відображає прогрес-кільце, залишок дистанції та кнопку Pause/Resume
 * Вимоги: 7.3, 7.4, 7.5
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GlassPanel } from '../ui/GlassPanel';
import { ProgressRing } from '../ui/ProgressRing';
import { useTrackingStore } from '../../store/useTrackingStore';
import { Colors } from '../../constants/colors';

interface LiveActivityDashboardProps {
  /** Цільова дистанція маршруту в кілометрах */
  targetDistanceKm: number;
  /** Callback при натисканні кнопки Pause/Resume */
  onPause: () => void;
  /** Callback при натисканні кнопки Stop */
  onStop: () => void;
}

/**
 * Форматує залишок дистанції:
 * - Менше 1000 м → "X м"
 * - 1000 м і більше → "X.X км"
 */
function formatRemainingDistance(remainingMeters: number): string {
  if (remainingMeters <= 0) return '0 м';
  if (remainingMeters < 1000) {
    return `${Math.round(remainingMeters)} м`;
  }
  return `${(remainingMeters / 1000).toFixed(1)} км`;
}

/**
 * Панель активного відстеження з прогрес-кільцем, залишком дистанції
 * та кнопками керування. Підключена до useTrackingStore для реактивних оновлень.
 */
export function LiveActivityDashboard({
  targetDistanceKm,
  onPause,
  onStop,
}: LiveActivityDashboardProps) {
  // Реактивні дані з useTrackingStore (оновлення протягом 2 секунд — Вимога 7.4)
  const walkedDistanceMeters = useTrackingStore((s) => s.walkedDistanceMeters);
  const isPaused = useTrackingStore((s) => s.isPaused);

  const remainingMeters = Math.max(0, targetDistanceKm * 1000 - walkedDistanceMeters);
  const remainingFormatted = formatRemainingDistance(remainingMeters);

  return (
    <GlassPanel style={styles.panel}>
      <View style={styles.content}>
        {/* Прогрес-кільце */}
        <ProgressRing
          walkedDistanceMeters={walkedDistanceMeters}
          targetDistanceKm={targetDistanceKm}
          size={120}
          strokeWidth={10}
        />

        {/* Залишок дистанції */}
        <View style={styles.distanceContainer}>
          <Text style={styles.distanceLabel}>Залишилось</Text>
          <Text style={styles.distanceValue}>{remainingFormatted}</Text>
        </View>

        {/* Кнопки керування */}
        <View style={styles.controls}>
          {/* Кнопка Pause / Resume — Вимога 7.5 */}
          <TouchableOpacity
            style={[styles.button, styles.pauseButton]}
            onPress={onPause}
            accessibilityRole="button"
            accessibilityLabel={isPaused ? 'Продовжити відстеження' : 'Призупинити відстеження'}
          >
            <Text style={styles.pauseButtonText}>
              {isPaused ? 'Продовжити' : 'Пауза'}
            </Text>
          </TouchableOpacity>

          {/* Кнопка Stop */}
          <TouchableOpacity
            style={[styles.button, styles.stopButton]}
            onPress={onStop}
            accessibilityRole="button"
            accessibilityLabel="Зупинити маршрут"
          >
            <Text style={styles.stopButtonText}>Стоп</Text>
          </TouchableOpacity>
        </View>
      </View>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: 16,
    marginBottom: 32,
  },
  content: {
    padding: 20,
    alignItems: 'center',
    gap: 16,
  },
  distanceContainer: {
    alignItems: 'center',
  },
  distanceLabel: {
    fontSize: 13,
    color: '#8E8E93',
    fontFamily: 'System',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  distanceValue: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1C1C1E',
    fontFamily: 'System',
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseButton: {
    backgroundColor: Colors.systemBlue.light,
  },
  pauseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
});

export default LiveActivityDashboard;
