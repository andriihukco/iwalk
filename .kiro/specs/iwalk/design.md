# Документ дизайну: iWalk

## Огляд

iWalk — мобільний фітнес-додаток для iOS та Android (Expo SDK 50+), що перетворює абстрактну ціль у кроках на реальний, валідований пішохідний маршрут. Додаток проходить через три чітко визначені стани: **ConfigStage** (налаштування), **PreviewStage** (перегляд маршруту) та **ActiveStage** (активне відстеження).

### Ключові технічні рішення

| Рішення | Обґрунтування |
|---|---|
| **MapLibre React Native** (`@maplibre/maplibre-react-native`) | Відкрита векторна карта без прив'язки до платного API; підтримує кастомні стилі у форматі Apple Maps |
| **OSRM API** (публічний демо-сервер або self-hosted) | Безкоштовний пішохідний маршрутизатор на базі OpenStreetMap; анонімні запити без ключів |
| **Zustand + `persist` middleware** з `@react-native-async-storage/async-storage` | Мінімалістичний стейт-менеджер; вбудована підтримка персистентності для React Native |
| **Expo Task Manager + Expo Location** | Єдиний офіційний спосіб фонового відстеження геолокації в Expo managed workflow |
| **Reanimated 3 Shared Element Transitions** | Нативні переходи між екранами через `sharedTransitionTag`; підтримується в Expo Router |
| **Moti** | Декларативні анімації поверх Reanimated; Spring-анімації через `useAnimatedStyle` |
| **NativeWind v4** (Tailwind CSS v4) | Утилітарні класи для стилізації; підтримує темну тему через `dark:` префікс |
| **expo-haptics** | Тактильний відгук через нативні API iOS/Android |
| **expo-battery** | Моніторинг рівня заряду для EnergyMode |

### Дослідницькі висновки

**MapLibre в Expo:** Бібліотека `@maplibre/maplibre-react-native` потребує EAS Build (не працює в Expo Go). Для стилю карти у форматі Apple Maps рекомендується використовувати безкоштовний тайловий сервер [MapTiler](https://www.maptiler.com/) або [Stadia Maps](https://stadiamaps.com/) з відповідним JSON-стилем.

**OSRM API:** Публічний демо-сервер `router.project-osrm.org` підтримує пішохідний профіль через URL: `https://router.project-osrm.org/route/v1/foot/{coords}?overview=full&geometries=geojson`. Координати передаються у форматі `lng,lat;lng,lat`. Відповідь містить GeoJSON-геометрію маршруту.

**Expo Task Manager:** `TaskManager.defineTask()` ОБОВ'ЯЗКОВО викликається у глобальному скоупі (поза компонентами), інакше iOS/Android не зможуть відновити задачу після вбивання процесу. Задача реєструється через `Location.startLocationUpdatesAsync()` з параметром `accuracy: Location.Accuracy.Balanced`.

**Zustand persist:** Для React Native використовується `zustand/middleware` з кастомним `storage` адаптером на базі `AsyncStorage`. Гідратація стану відбувається асинхронно — необхідно обробляти стан завантаження.

---

## Архітектура

### Загальна архітектура

```
┌─────────────────────────────────────────────────────────────┐
│                        Expo Router                          │
│  app/                                                       │
│  ├── _layout.tsx          (Root layout, TaskManager init)   │
│  ├── index.tsx            (ConfigStage)                     │
│  ├── preview.tsx          (PreviewStage)                    │
│  └── active.tsx           (ActiveStage)                     │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  Converter   │   │  WaypointEngine  │   │  RouteBuilder    │
│  (pure fn)   │   │  (pure fn)       │   │  (async, OSRM)   │
└──────────────┘   └──────────────────┘   └──────────────────┘
         │                    │                    │
         └────────────────────┴────────────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │    StateManager      │
                   │    (Zustand store)   │
                   │    + AsyncStorage    │
                   └──────────────────────┘
                              │
                   ┌──────────┴──────────┐
                   ▼                     ▼
         ┌──────────────────┐  ┌──────────────────────┐
         │  LocationTracker │  │  LiveActivityDashboard│
         │  (TaskManager)   │  │  (Lock Screen / DI)  │
         └──────────────────┘  └──────────────────────┘
```

### Файлова структура проєкту

```
app/
├── _layout.tsx                 # Root layout: ініціалізація TaskManager, тема
├── index.tsx                   # ConfigStage
├── preview.tsx                 # PreviewStage
└── active.tsx                  # ActiveStage

src/
├── modules/
│   ├── converter/
│   │   ├── converter.ts        # Чисті функції обчислення Stride/TargetDistance
│   │   └── converter.test.ts
│   ├── waypoint-engine/
│   │   ├── waypointEngine.ts   # Генерація вейпоінтів (Loop/Destination/Discovery/Intensity)
│   │   └── waypointEngine.test.ts
│   ├── route-builder/
│   │   ├── routeBuilder.ts     # OSRM API клієнт
│   │   └── routeBuilder.test.ts
│   └── location-tracker/
│       ├── locationTracker.ts  # Expo Location + TaskManager
│       └── locationTracker.test.ts
├── store/
│   ├── useAppStore.ts          # Zustand store (головний)
│   ├── useRouteStore.ts        # Zustand store (маршрут)
│   └── useTrackingStore.ts     # Zustand store (відстеження)
├── components/
│   ├── StepOrb/
│   │   ├── StepOrb.tsx         # Сферичний слайдер
│   │   └── StepOrb.test.tsx
│   ├── MapView/
│   │   └── RouteMapView.tsx    # MapLibre обгортка
│   ├── LiveActivityDashboard/
│   │   └── LiveActivityDashboard.tsx
│   └── ui/
│       ├── GlassPanel.tsx      # ExpoBlurView панель
│       └── ProgressRing.tsx    # Кільце прогресу
├── constants/
│   ├── colors.ts               # Кольорова палітра
│   └── animation.ts            # Spring-параметри
└── tasks/
    └── locationTask.ts         # TaskManager.defineTask (глобальний скоуп)
```

### Потік даних між станами

```
ConfigStage
  │  Введення: зріст, ціль кроків, режим маршруту
  │  Обчислення: Converter → TargetDistance
  │  Генерація: WaypointEngine → Waypoints[]
  │  Побудова: RouteBuilder → Polyline (OSRM)
  ▼
PreviewStage
  │  Відображення: MapView + Polyline + Draggable Markers
  │  Редагування: перетягування маркерів → RouteBuilder → нова Polyline
  ▼
ActiveStage
  │  Реєстрація: LocationTracker → TaskManager
  │  Відстеження: фонові оновлення → StateManager
  │  Відображення: LiveActivityDashboard (Lock Screen / Dynamic Island)
  ▼
CompletionScreen
     Підсумкова статистика + тактильний відгук
```

---

## Компоненти та інтерфейси

### 1. Converter (модуль обчислення)

```typescript
// src/modules/converter/converter.ts

/** Обчислює довжину кроку в метрах */
export function calculateStride(heightCm: number): number;

/** Обчислює цільову дистанцію в кілометрах */
export function calculateTargetDistance(stepGoal: number, stride: number): number;

/** Валідує зріст (100–250 см) */
export function validateHeight(heightCm: number): ValidationResult;

/** Валідує ціль кроків (500–50 000) */
export function validateStepGoal(stepGoal: number): ValidationResult;

interface ValidationResult {
  valid: boolean;
  error?: string; // Повідомлення про помилку для відображення
}
```

### 2. WaypointEngine (генерація вейпоінтів)

```typescript
// src/modules/waypoint-engine/waypointEngine.ts

export interface Waypoint {
  latitude: number;
  longitude: number;
}

export interface WaypointOptions {
  mode: 'loop' | 'destination';
  discoveryMode: boolean;
  intensityMode: boolean;
  targetDistanceKm: number;
  origin: Waypoint;
  destination?: Waypoint; // Тільки для Destination Mode
}

/** Генерує масив вейпоінтів (4–20 точок) */
export function generateWaypoints(options: WaypointOptions): Waypoint[];

/** Обчислює радіус кола для Loop Mode */
export function calculateLoopRadius(targetDistanceKm: number): number;

/** Застосовує ентропійне відхилення для Discovery Mode */
export function applyDiscoveryOffset(
  waypoint: Waypoint,
  radiusKm: number,
  seed: number
): Waypoint;
```

**Алгоритм Loop Mode:**
- Радіус: `R = TargetDistance / (2π)` (км)
- Кількість вейпоінтів: `n = clamp(floor(TargetDistance * 2), 4, 20)`
- Кут між вейпоінтами: `θ = 2π / n`
- Координати: `lat_i = origin.lat + R * sin(i * θ) / 111.32`, `lng_i = origin.lng + R * cos(i * θ) / (111.32 * cos(origin.lat))`

**Алгоритм Discovery Mode:**
- Для кожного вейпоінту додається випадковий вектор: `offset = random(-0.4R, 0.4R)`
- Використовується детермінований PRNG (seeded) для відтворюваності

### 3. RouteBuilder (OSRM клієнт)

```typescript
// src/modules/route-builder/routeBuilder.ts

export interface RouteResult {
  polyline: GeoJSON.LineString;
  distanceMeters: number;
  durationSeconds: number;
}

export interface RouteError {
  code: 'NETWORK_ERROR' | 'TIMEOUT' | 'OSRM_ERROR' | 'NO_ROUTE';
  message: string;
}

/** Будує пішохідний маршрут через OSRM API */
export async function buildRoute(
  waypoints: Waypoint[]
): Promise<Result<RouteResult, RouteError>>;

/** Формує URL запиту до OSRM (тільки координати, без PII) */
export function buildOsrmUrl(waypoints: Waypoint[]): string;
```

**OSRM URL формат:**
```
https://router.project-osrm.org/route/v1/foot/{lng1,lat1;lng2,lat2;...}
  ?overview=full
  &geometries=geojson
  &steps=false
```

**Тайм-аут:** 10 секунд через `AbortController`.

**Retry-логіка:** 1 автоматичний повтор при мережевій помилці, потім показ UI-помилки.

### 4. LocationTracker (фонове відстеження)

```typescript
// src/tasks/locationTask.ts (ГЛОБАЛЬНИЙ СКОУП)

export const LOCATION_TASK_NAME = 'IWALK_BACKGROUND_LOCATION';

TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) { /* обробка помилки */ return; }
  const { locations } = data as { locations: Location.LocationObject[] };
  // Оновлення пройденої дистанції у store
});
```

```typescript
// src/modules/location-tracker/locationTracker.ts

/** Запускає фонове відстеження */
export async function startTracking(options: TrackingOptions): Promise<void>;

/** Зупиняє фонове відстеження */
export async function stopTracking(): Promise<void>;

/** Обчислює відстань між двома координатами (Haversine) */
export function haversineDistance(a: Waypoint, b: Waypoint): number;

interface TrackingOptions {
  accuracy: Location.Accuracy;
  distanceInterval: number; // метри між оновленнями
  timeInterval?: number;    // мс між оновленнями (опціонально)
}
```

### 5. StateManager (Zustand stores)

```typescript
// src/store/useAppStore.ts
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
  // ... інші сеттери
}

// src/store/useRouteStore.ts
interface RouteState {
  waypoints: Waypoint[];
  polyline: GeoJSON.LineString | null;
  targetDistanceKm: number;
  isLoading: boolean;
  error: RouteError | null;
  setWaypoints: (waypoints: Waypoint[]) => void;
  setPolyline: (polyline: GeoJSON.LineString) => void;
  // ... інші сеттери
}

// src/store/useTrackingStore.ts
interface TrackingState {
  isTracking: boolean;
  isPaused: boolean;
  walkedDistanceMeters: number;
  lastLocation: Waypoint | null;
  startedAt: number | null; // timestamp
  isEnergyMode: boolean;
  updateDistance: (newLocation: Waypoint) => void;
  // ... інші сеттери
}
```

**Персистентність:** `useAppStore` та `useRouteStore` персистуються через `zustand/middleware` `persist` з `AsyncStorage`. `useTrackingStore` персистується для відновлення ActiveStage.

### 6. StepOrb (компонент-слайдер)

```typescript
// src/components/StepOrb/StepOrb.tsx

interface StepOrbProps {
  value: number;           // Поточне значення (500–50 000)
  onChange: (value: number) => void;
  minValue?: number;       // За замовчуванням 500
  maxValue?: number;       // За замовчуванням 50 000
  step?: number;           // За замовчуванням 500
}
```

**Реалізація:**
- Жест обертання через `react-native-gesture-handler` `RotationGesture`
- Розмір сфери: `size = BASE_SIZE + (value / MAX_VALUE) * SIZE_RANGE`
- Анімація розміру через `useAnimatedStyle` (Reanimated)
- Тактильний відгук: `Haptics.selectionAsync()` кожні 500 кроків

### 7. RouteMapView (компонент карти)

```typescript
// src/components/MapView/RouteMapView.tsx

interface RouteMapViewProps {
  polyline: GeoJSON.LineString | null;
  waypoints: Waypoint[];
  userLocation: Waypoint | null;
  onWaypointDrag: (index: number, newPosition: Waypoint) => void;
  fullScreen?: boolean;
  sharedTransitionTag?: string; // Для Shared Element Transition
}
```

**MapLibre конфігурація:**
- Стиль: JSON-стиль у форматі Apple Maps (через MapTiler або Stadia Maps)
- Полілінія: `ShapeSource` + `LineLayer` з кольором `#34C759`
- Маркери вейпоінтів: `PointAnnotation` з підтримкою drag
- Shared Element Transition: `Animated.View` обгортка з `sharedTransitionTag`

---

## Моделі даних

### Основні типи

```typescript
// Географічна точка
interface Waypoint {
  latitude: number;   // -90 до 90
  longitude: number;  // -180 до 180
}

// Результат побудови маршруту
interface RouteResult {
  polyline: GeoJSON.LineString;
  distanceMeters: number;
  durationSeconds: number;
}

// Помилка маршруту
interface RouteError {
  code: 'NETWORK_ERROR' | 'TIMEOUT' | 'OSRM_ERROR' | 'NO_ROUTE';
  message: string;
  retryable: boolean;
}

// Параметри маршруту (персистуються)
interface RouteConfig {
  heightCm: number;           // 100–250
  stepGoal: number;           // 500–50 000
  routeMode: 'loop' | 'destination';
  discoveryMode: boolean;
  intensityMode: boolean;
  destinationWaypoint?: Waypoint; // Тільки для Destination Mode
}

// Стан відстеження (персистується для відновлення)
interface TrackingSession {
  sessionId: string;          // UUID
  startedAt: number;          // Unix timestamp
  walkedDistanceMeters: number;
  targetDistanceKm: number;
  lastLocation: Waypoint | null;
  isPaused: boolean;
  pausedAt?: number;
}

// Результат валідації
interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Узагальнений Result тип
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

### Схема персистентності AsyncStorage

| Ключ | Тип | Опис |
|---|---|---|
| `iwalk-app-store` | `RouteConfig` | Налаштування маршруту між сесіями |
| `iwalk-route-store` | `{ waypoints, polyline }` | Останній побудований маршрут |
| `iwalk-tracking-store` | `TrackingSession` | Активна сесія відстеження |

### Константи

```typescript
// src/constants/colors.ts
export const Colors = {
  routeGreen: '#34C759',
  systemBlue: { light: '#007AFF', dark: '#0A84FF' },
  glass: {
    light: 'rgba(255,255,255,0.6)',
    dark: 'rgba(28,28,30,0.7)',
  },
} as const;

// src/constants/animation.ts
export const SpringConfig = {
  mass: 1,
  damping: 15,
  stiffness: 120,
} as const;

// src/constants/tracking.ts
export const TrackingConfig = {
  normalDistanceInterval: 50,      // метри
  energyDistanceInterval: 100,     // метри (EnergyMode)
  normalFPS: 60,
  energyFPS: 15,
  batteryThresholdLow: 0.20,       // 20%
  batteryThresholdRestore: 0.25,   // 25%
  osrmTimeoutMs: 10_000,
  maxWaypoints: 20,
  minWaypoints: 4,
} as const;
```

---

## Властивості коректності

*Властивість — це характеристика або поведінка, яка має бути істинною для всіх допустимих виконань системи. Властивості слугують мостом між людиночитаними специфікаціями та машинно-верифікованими гарантіями коректності.*

### Властивість 1: Коректність формул Converter

*Для будь-якого* значення зросту `heightCm` в діапазоні [100, 250] та будь-якого значення цілі кроків `stepGoal` в діапазоні [500, 50 000]: `calculateStride(heightCm)` повинен дорівнювати `heightCm * 0.414 / 100`, а `calculateTargetDistance(stepGoal, stride)` повинен дорівнювати `(stepGoal * stride) / 1000`.

**Validates: Requirements 1.1, 1.2**

---

### Властивість 2: Коректність валідації вхідних даних

*Для будь-якого* числового значення: `validateHeight(x)` повинен повертати `{ valid: true }` тоді і тільки тоді, коли `x ∈ [100, 250]`; `validateStepGoal(x)` повинен повертати `{ valid: true }` тоді і тільки тоді, коли `x ∈ [500, 50 000]`. Для всіх значень поза цими діапазонами функції повинні повертати `{ valid: false }` з непорожнім повідомленням про помилку.

**Validates: Requirements 1.4, 1.5**

---

### Властивість 3: Round-trip персистентності стану

*Для будь-якого* допустимого значення зросту `heightCm` та будь-якої валідної GeoJSON-полілінії: після запису значення у Zustand store, серіалізації через `persist` middleware та десеріалізації (гідратації) — отримане значення повинно бути ідентичним збереженому.

**Validates: Requirements 1.6, 3.5**

---

### Властивість 4: Інваріант радіуса Loop Mode

*Для будь-якого* значення `targetDistanceKm > 0` та будь-якої початкової точки `origin`: всі вейпоінти, згенеровані у Loop Mode, повинні знаходитись на відстані від `origin`, що відрізняється від `R = targetDistanceKm / (2π)` не більше ніж на 5%.

**Validates: Requirements 2.1**

---

### Властивість 5: Інваріант кількості вейпоінтів

*Для будь-яких* допустимих параметрів маршруту (будь-який режим, будь-яка дистанція, будь-яка початкова точка): `generateWaypoints(options)` повинен повертати масив довжиною від 4 до 20 включно.

**Validates: Requirements 2.6**

---

### Властивість 6: Обмеження відхилення Discovery Mode

*Для будь-якого* маршруту з увімкненим Discovery Mode: відхилення кожного вейпоінту від його "базової" позиції (позиція без Discovery Mode) не повинно перевищувати `0.4 * R`, де `R` — радіус маршруту.

**Validates: Requirements 2.3**

---

### Властивість 7: Intensity Mode збільшує кількість вейпоінтів

*Для будь-яких* однакових параметрів маршруту: кількість вейпоінтів при увімкненому Intensity Mode повинна бути строго більшою за кількість вейпоінтів при вимкненому Intensity Mode.

**Validates: Requirements 2.4**

---

### Властивість 8: OSRM URL містить тільки координати

*Для будь-якого* масиву вейпоінтів: `buildOsrmUrl(waypoints)` повинен повертати рядок, що містить виключно координати (широту та довготу) і не містить жодних ідентифікаторів пристрою, облікових даних, токенів або будь-яких інших персональних даних.

**Validates: Requirements 3.2, 12.2**

---

### Властивість 9: Монотонність розміру StepOrb

*Для будь-яких* двох значень `v1 > v2` в діапазоні [500, 50 000]: візуальний розмір StepOrb при значенні `v1` повинен бути строго більшим за розмір при значенні `v2`.

**Validates: Requirements 5.3**

---

### Властивість 10: Поріг оновлення пройденої дистанції

*Для будь-якої* послідовності оновлень геолокації: `walkedDistanceMeters` у TrackingStore повинен оновлюватись тільки тоді, коли відстань між поточною та попередньою зафіксованою позицією перевищує або дорівнює `distanceInterval` (50 м у стандартному режимі, 100 м у EnergyMode).

**Validates: Requirements 7.2, 9.2**

---

### Властивість 11: Round-trip активації/деактивації EnergyMode

*Для будь-якого* рівня заряду батареї: якщо рівень опускається нижче 20%, `isEnergyMode` повинен стати `true`; якщо після цього рівень піднімається вище 25%, `isEnergyMode` повинен стати `false` і параметри відстеження повинні повернутись до стандартних значень.

**Validates: Requirements 9.2, 9.4**

---

## Обробка помилок

### Стратегія обробки помилок

| Сценарій | Поведінка | Відновлення |
|---|---|---|
| Геолокація недоступна | Блокування генерації вейпоінтів, показ пояснення | Посилання на системні налаштування |
| Дозвіл на геолокацію відхилено (foreground) | Показ пояснення + посилання на налаштування | Повторний запит при наступному запуску |
| Дозвіл на фонову геолокацію відхилено | Продовження без фонового відстеження + попередження | Робота у foreground-only режимі |
| OSRM API тайм-аут (>10 с) | Показ повідомлення про помилку + кнопка "Повторити" | Автоматичний 1 повтор, потім ручний |
| OSRM API помилка (4xx/5xx) | Показ повідомлення про помилку + кнопка "Повторити" | Ручний повтор |
| Мережа недоступна | Показ повідомлення + відображення останнього маршруту | Автоматичне відновлення при появі мережі |
| Фонова задача завершена системою | Показ повідомлення про перерву при поверненні | Автоматичне відновлення відстеження |
| Некоректні вхідні дані (зріст/кроки) | Inline-повідомлення про допустимий діапазон | Блокування переходу до PreviewStage |
| Відсутність маршруту від OSRM | Показ повідомлення "Маршрут не знайдено" | Пропозиція змінити параметри |

### Типи помилок та коди

```typescript
// Помилки RouteBuilder
type RouteErrorCode = 
  | 'NETWORK_ERROR'    // Мережа недоступна
  | 'TIMEOUT'          // OSRM не відповів за 10 с
  | 'OSRM_ERROR'       // OSRM повернув помилку
  | 'NO_ROUTE';        // Маршрут не знайдено

// Помилки LocationTracker
type LocationErrorCode =
  | 'PERMISSION_DENIED'           // Дозвіл відхилено
  | 'BACKGROUND_PERMISSION_DENIED' // Фоновий дозвіл відхилено
  | 'LOCATION_UNAVAILABLE'        // GPS недоступний
  | 'TASK_TERMINATED';            // Фонова задача завершена системою

// Помилки валідації
type ValidationErrorCode =
  | 'HEIGHT_OUT_OF_RANGE'    // Зріст поза [100, 250]
  | 'STEP_GOAL_OUT_OF_RANGE'; // Ціль поза [500, 50 000]
```

### Обробка помилок у компонентах

- **ConfigStage:** Inline-валідація під полями введення; блокування кнопки підтвердження при невалідних даних
- **PreviewStage:** Toast-повідомлення при помилці OSRM; збереження попереднього маршруту при помилці оновлення
- **ActiveStage:** Banner-повідомлення при перерві відстеження; збереження прогресу при будь-якій помилці

---

## Стратегія тестування

### Підхід до тестування

Використовується подвійний підхід:
- **Unit-тести** (Jest + React Native Testing Library): конкретні приклади, граничні умови, обробка помилок
- **Property-based тести** (fast-check): універсальні властивості для чистих функцій

**Бібліотека PBT:** [`fast-check`](https://github.com/dubzzz/fast-check) — зрілий PBT-фреймворк для TypeScript/JavaScript з підтримкою Jest.

### Конфігурація property-based тестів

```typescript
// Мінімум 100 ітерацій на кожен property-тест
fc.assert(fc.property(...), { numRuns: 100 });

// Тег формату: Feature: iwalk, Property N: <текст властивості>
// Приклад:
// Feature: iwalk, Property 1: Коректність формул Converter
```

### Покриття по модулях

#### `converter.ts` — Unit + Property тести
```
✓ [Property 1] Формула Stride для будь-якого heightCm ∈ [100, 250]
✓ [Property 1] Формула TargetDistance для будь-яких stepGoal та stride
✓ [Property 2] validateHeight повертає true для [100, 250]
✓ [Property 2] validateHeight повертає false для значень поза діапазоном
✓ [Property 2] validateStepGoal повертає true для [500, 50 000]
✓ [Property 2] validateStepGoal повертає false для значень поза діапазоном
✓ [Unit] Граничні значення: 100, 250, 500, 50 000
✓ [Unit] Повідомлення про помилку непорожнє при невалідних даних
```

#### `waypointEngine.ts` — Unit + Property тести
```
✓ [Property 4] Всі вейпоінти Loop Mode знаходяться на відстані ≈ R від origin
✓ [Property 5] Кількість вейпоінтів завжди в [4, 20]
✓ [Property 6] Відхилення Discovery Mode ≤ 0.4 * R
✓ [Property 7] Intensity Mode генерує більше вейпоінтів
✓ [Unit] Loop Mode з мінімальною дистанцією (генерує 4 вейпоінти)
✓ [Unit] Loop Mode з максимальною дистанцією (генерує 20 вейпоінтів)
✓ [Unit] Destination Mode: вейпоінти вздовж вектора
```

#### `routeBuilder.ts` — Unit + Integration тести
```
✓ [Property 8] buildOsrmUrl не містить PII
✓ [Property 3] Полілінія зберігається та відновлюється з store
✓ [Unit] Обробка NETWORK_ERROR
✓ [Unit] Обробка TIMEOUT (AbortController)
✓ [Unit] Обробка OSRM_ERROR (4xx/5xx)
✓ [Unit] Обробка NO_ROUTE
✓ [Integration] Успішний запит до мок-OSRM сервера
```

#### `locationTracker.ts` — Unit тести
```
✓ [Property 10] Дистанція оновлюється тільки при перевищенні порогу
✓ [Unit] haversineDistance: відома відстань між двома точками
✓ [Unit] startTracking реєструє TaskManager задачу
✓ [Unit] stopTracking зупиняє TaskManager задачу
```

#### `useAppStore.ts` / `useTrackingStore.ts` — Unit + Property тести
```
✓ [Property 3] Round-trip персистентності heightCm
✓ [Property 11] EnergyMode активується при заряді < 20%
✓ [Property 11] EnergyMode деактивується при заряді > 25%
✓ [Unit] Відновлення ActiveStage при перезапуску
```

#### `StepOrb.tsx` — Unit тести
```
✓ [Property 9] Розмір монотонно зростає зі значенням
✓ [Unit] Haptics викликається кожні 500 кроків
✓ [Unit] Значення обмежується діапазоном [500, 50 000]
```

### Інтеграційні тести

- Повний flow: ConfigStage → PreviewStage → ActiveStage (з мок-OSRM та мок-Location)
- Відновлення сесії після "перезапуску" додатку
- Обробка відхилення дозволів геолокації

### Що НЕ тестується автоматично

- Візуальні анімації (Spring, Shared Element Transitions) — ручне тестування
- Тактильний відгук — ручне тестування на пристрої
- Live Activity / Dynamic Island — ручне тестування на iOS
- Variable Blur та Specular Highlights — ручне тестування
- Продуктивність (60 FPS, затримка <50 мс) — профілювання на пристрої

### Команди запуску тестів

```bash
# Unit та property-based тести (одноразовий запуск)
npx jest --testPathPattern="src/(modules|store|components)" --passWithNoTests

# Тільки property-based тести
npx jest --testPathPattern="\.property\.test\." --passWithNoTests

# З покриттям
npx jest --coverage --passWithNoTests
```
