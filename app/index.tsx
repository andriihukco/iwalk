/**
 * ConfigStage — екран налаштування маршруту iWalk
 *
 * Вимоги: 1.1–1.6, 4.1, 4.3, 5.1–5.6, 12.3
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';

import { StepOrb } from '../src/components/StepOrb/StepOrb';
import {
  calculateStride,
  calculateTargetDistance,
  validateHeight,
  validateStepGoal,
} from '../src/modules/converter/converter';
import { generateWaypoints } from '../src/modules/waypoint-engine/waypointEngine';
import { buildRoute } from '../src/modules/route-builder/routeBuilder';
import { useAppStore } from '../src/store/useAppStore';
import { useRouteStore } from '../src/store/useRouteStore';
import { Colors } from '../src/constants/colors';

// ─── Компонент ────────────────────────────────────────────────────────────────

export default function ConfigStage(): React.JSX.Element {
  const router = useRouter();

  // ── Стан зі store ──────────────────────────────────────────────────────────
  const heightCm = useAppStore((s) => s.heightCm);
  const stepGoal = useAppStore((s) => s.stepGoal);
  const routeMode = useAppStore((s) => s.routeMode);
  const discoveryMode = useAppStore((s) => s.discoveryMode);
  const intensityMode = useAppStore((s) => s.intensityMode);

  const setHeight = useAppStore((s) => s.setHeight);
  const setStepGoal = useAppStore((s) => s.setStepGoal);
  const setRouteMode = useAppStore((s) => s.setRouteMode);
  const setDiscoveryMode = useAppStore((s) => s.setDiscoveryMode);
  const setIntensityMode = useAppStore((s) => s.setIntensityMode);

  const setWaypoints = useRouteStore((s) => s.setWaypoints);
  const setPolyline = useRouteStore((s) => s.setPolyline);
  const setTargetDistanceKm = useRouteStore((s) => s.setTargetDistanceKm);
  const setIsLoading = useRouteStore((s) => s.setIsLoading);
  const setError = useRouteStore((s) => s.setError);
  const isLoading = useRouteStore((s) => s.isLoading);
  const routeError = useRouteStore((s) => s.error);

  // ── Локальний стан ─────────────────────────────────────────────────────────
  // Текстове поле зросту (рядок для inline-редагування)
  const [heightText, setHeightText] = useState(String(heightCm));
  const [heightError, setHeightError] = useState<string | undefined>();
  const [stepGoalError, setStepGoalError] = useState<string | undefined>();
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

  // Ref для дебаунсу перерахунку (Вимога 1.3: < 50 мс)
  const recalcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Запит дозволу на геолокацію (Вимога 4.1) ──────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationPermissionDenied(true);
      }
    })();
  }, []);

  // ── Валідація зросту в реальному часі (Вимога 1.3, 1.4) ───────────────────
  const handleHeightChange = useCallback(
    (text: string) => {
      setHeightText(text);

      if (recalcTimerRef.current) {
        clearTimeout(recalcTimerRef.current);
      }

      recalcTimerRef.current = setTimeout(() => {
        const parsed = parseFloat(text);
        if (isNaN(parsed)) {
          setHeightError('Введіть числове значення зросту');
          return;
        }
        const validation = validateHeight(parsed);
        if (!validation.valid) {
          setHeightError(validation.error);
        } else {
          setHeightError(undefined);
          setHeight(parsed);
        }
      }, 0); // Негайно, але асинхронно — < 50 мс (Вимога 1.3)
    },
    [setHeight],
  );

  // ── Валідація цілі кроків (Вимога 1.5) ────────────────────────────────────
  const handleStepGoalChange = useCallback(
    (value: number) => {
      const validation = validateStepGoal(value);
      if (!validation.valid) {
        setStepGoalError(validation.error);
      } else {
        setStepGoalError(undefined);
        setStepGoal(value);
      }
    },
    [setStepGoal],
  );

  // ── Перевірка валідності форми ─────────────────────────────────────────────
  const isFormValid =
    !heightError &&
    !stepGoalError &&
    !locationPermissionDenied &&
    heightText.trim() !== '' &&
    !isNaN(parseFloat(heightText));

  // ── Обробник кнопки підтвердження (Вимога 5.6) ────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (!isFormValid) return;

    setIsLoading(true);
    setError(null);

    try {
      // a. Обчислити stride (Вимога 1.1)
      const stride = calculateStride(heightCm);

      // b. Обчислити targetDistance (Вимога 1.2)
      const targetDistanceKm = calculateTargetDistance(stepGoal, stride);
      setTargetDistanceKm(targetDistanceKm);

      // c. Отримати поточну геолокацію
      const locationResult = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const origin = {
        latitude: locationResult.coords.latitude,
        longitude: locationResult.coords.longitude,
      };

      // d. Згенерувати вейпоінти (Вимога 2.1–2.4)
      const waypoints = generateWaypoints({
        mode: routeMode,
        discoveryMode,
        intensityMode,
        targetDistanceKm,
        origin,
      });
      setWaypoints(waypoints);

      // e. Побудувати маршрут через OSRM (Вимога 3.1)
      const result = await buildRoute(waypoints);

      if (!result.ok) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      // f. Зберегти полілінію у store
      setPolyline(result.value.polyline);
      setIsLoading(false);

      // g. Перейти до preview зі Spring-анімацією (Вимога 5.6)
      router.push('/preview');
    } catch (err) {
      setError({
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Невідома помилка',
        retryable: true,
      });
      setIsLoading(false);
    }
  }, [
    isFormValid,
    heightCm,
    stepGoal,
    routeMode,
    discoveryMode,
    intensityMode,
    setIsLoading,
    setError,
    setTargetDistanceKm,
    setWaypoints,
    setPolyline,
    router,
  ]);

  // ── Відкрити системні налаштування (Вимога 4.3) ───────────────────────────
  const handleOpenSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  // ── Рендер ─────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Заголовок */}
      <Text style={styles.title}>iWalk</Text>

      {/* StepOrb — сферичний слайдер (Вимога 5.1–5.3) */}
      <View style={styles.orbContainer}>
        <StepOrb
          value={stepGoal}
          onChange={handleStepGoalChange}
          minValue={500}
          maxValue={50_000}
          step={500}
        />
      </View>

      {stepGoalError ? (
        <Text style={styles.errorText}>{stepGoalError}</Text>
      ) : null}

      {/* Поле введення зросту з inline-валідацією (Вимога 1.4, 1.6) */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Зріст (см)</Text>
        <TextInput
          style={[styles.input, heightError ? styles.inputError : null]}
          value={heightText}
          onChangeText={handleHeightChange}
          keyboardType="numeric"
          placeholder="100–250"
          placeholderTextColor="#999"
          accessibilityLabel="Зріст у сантиметрах"
          accessibilityHint="Введіть ваш зріст від 100 до 250 сантиметрів"
        />
        {heightError ? (
          <Text style={styles.errorText}>{heightError}</Text>
        ) : null}
      </View>

      {/* Перемикач Loop Mode / Destination Mode (Вимога 5.4) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Режим маршруту</Text>
        <View style={styles.modeToggleRow}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              routeMode === 'loop' && styles.modeButtonActive,
            ]}
            onPress={() => setRouteMode('loop')}
            accessibilityRole="button"
            accessibilityState={{ selected: routeMode === 'loop' }}
          >
            <Text
              style={[
                styles.modeButtonText,
                routeMode === 'loop' && styles.modeButtonTextActive,
              ]}
            >
              Loop Mode
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeButton,
              routeMode === 'destination' && styles.modeButtonActive,
            ]}
            onPress={() => setRouteMode('destination')}
            accessibilityRole="button"
            accessibilityState={{ selected: routeMode === 'destination' }}
          >
            <Text
              style={[
                styles.modeButtonText,
                routeMode === 'destination' && styles.modeButtonTextActive,
              ]}
            >
              Destination Mode
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Discovery Mode та Intensity Mode — тільки для Loop Mode (Вимога 5.5) */}
      {routeMode === 'loop' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Додаткові режими</Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Discovery Mode</Text>
              <Text style={styles.toggleDescription}>
                Ентропійне відхилення для нових місць
              </Text>
            </View>
            <Switch
              value={discoveryMode}
              onValueChange={setDiscoveryMode}
              trackColor={{ false: '#ccc', true: Colors.systemBlue.light }}
              thumbColor="#fff"
              accessibilityLabel="Discovery Mode"
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Intensity Mode</Text>
              <Text style={styles.toggleDescription}>
                Зигзагоподібна траєкторія
              </Text>
            </View>
            <Switch
              value={intensityMode}
              onValueChange={setIntensityMode}
              trackColor={{ false: '#ccc', true: Colors.systemBlue.light }}
              thumbColor="#fff"
              accessibilityLabel="Intensity Mode"
            />
          </View>
        </View>
      ) : null}

      {/* Індикатор "Дані обробляються локально" (Вимога 12.3) */}
      <View style={styles.privacyIndicator}>
        <Text style={styles.privacyIcon}>🔒</Text>
        <Text style={styles.privacyText}>Дані обробляються локально</Text>
      </View>

      {/* Попередження про відхилений дозвіл геолокації (Вимога 4.3) */}
      {locationPermissionDenied ? (
        <View style={styles.permissionWarning}>
          <Text style={styles.permissionWarningText}>
            Для побудови маршруту необхідний доступ до геолокації.
          </Text>
          <TouchableOpacity
            onPress={handleOpenSettings}
            accessibilityRole="button"
          >
            <Text style={styles.settingsLink}>Відкрити налаштування</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Повідомлення про помилку маршруту */}
      {routeError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{routeError.message}</Text>
          {routeError.retryable ? (
            <TouchableOpacity
              onPress={handleConfirm}
              style={styles.retryButton}
              accessibilityRole="button"
            >
              <Text style={styles.retryButtonText}>Повторити</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* Кнопка підтвердження (Вимога 5.6) */}
      <TouchableOpacity
        style={[
          styles.confirmButton,
          (!isFormValid || isLoading) && styles.confirmButtonDisabled,
        ]}
        onPress={handleConfirm}
        disabled={!isFormValid || isLoading}
        accessibilityRole="button"
        accessibilityLabel="Побудувати маршрут"
        accessibilityState={{ disabled: !isFormValid || isLoading }}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.confirmButtonText}>Побудувати маршрут</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Стилі ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    marginBottom: 32,
    alignSelf: 'flex-start',
  },
  orbContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 17,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 13,
    color: '#FF3B30',
    marginTop: 4,
  },
  section: {
    width: '100%',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  modeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#E5E5EA',
    borderRadius: 12,
    padding: 3,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  modeButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  modeButtonTextActive: {
    color: '#1C1C1E',
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  toggleDescription: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  privacyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
    width: '100%',
  },
  privacyIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  privacyText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '500',
  },
  permissionWarning: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    width: '100%',
  },
  permissionWarningText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 8,
  },
  settingsLink: {
    fontSize: 14,
    color: Colors.systemBlue.light,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    width: '100%',
  },
  errorBannerText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 8,
  },
  retryButton: {
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    fontSize: 14,
    color: Colors.systemBlue.light,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: Colors.systemBlue.light,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: Colors.systemBlue.light,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmButtonDisabled: {
    backgroundColor: '#C7C7CC',
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
});
