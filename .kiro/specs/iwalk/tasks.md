# План реалізації: iWalk

## Огляд

Реалізація виконується поетапно: спочатку чисті функції ядра (Converter, WaypointEngine, RouteBuilder), потім стейт-менеджмент (Zustand stores), далі фонове відстеження (LocationTracker + TaskManager), UI-компоненти (StepOrb, RouteMapView, LiveActivityDashboard) та, нарешті, екрани Expo Router з повним зв'язуванням усіх частин.

## Завдання

- [x] 1. Налаштування структури проєкту та базових типів
  - Створити директорії `src/modules/`, `src/store/`, `src/components/`, `src/constants/`, `src/tasks/`
  - Визначити спільні TypeScript-типи: `Waypoint`, `RouteResult`, `RouteError`, `RouteConfig`, `TrackingSession`, `ValidationResult`, `Result<T, E>`
  - Створити файли констант: `src/constants/colors.ts`, `src/constants/animation.ts`, `src/constants/tracking.ts`
  - Налаштувати Jest з підтримкою TypeScript та встановити `fast-check`
  - _Вимоги: 1.1, 2.1, 3.1, 7.1_

- [x] 2. Реалізація модуля Converter
  - [x] 2.1 Реалізувати чисті функції в `src/modules/converter/converter.ts`
    - Написати `calculateStride(heightCm)` за формулою `heightCm * 0.414 / 100`
    - Написати `calculateTargetDistance(stepGoal, stride)` за формулою `(stepGoal * stride) / 1000`
    - Написати `validateHeight(heightCm)` — валідний діапазон [100, 250]
    - Написати `validateStepGoal(stepGoal)` — валідний діапазон [500, 50 000]
    - _Вимоги: 1.1, 1.2, 1.4, 1.5_

  - [ ]* 2.2 Написати property-тест для формул Converter
    - **Властивість 1: Коректність формул Converter**
    - Перевірити: `calculateStride(h) === h * 0.414 / 100` для будь-якого `h ∈ [100, 250]`
    - Перевірити: `calculateTargetDistance(s, stride) === (s * stride) / 1000` для будь-яких `s ∈ [500, 50000]`
    - Використати `fc.integer({ min: 100, max: 250 })` та `fc.integer({ min: 500, max: 50000 })`
    - **Validates: Вимоги 1.1, 1.2**

  - [ ]* 2.3 Написати property-тест для валідації вхідних даних Converter
    - **Властивість 2: Коректність валідації вхідних даних**
    - Перевірити: `validateHeight(x).valid === true` тоді і тільки тоді, коли `x ∈ [100, 250]`
    - Перевірити: `validateStepGoal(x).valid === true` тоді і тільки тоді, коли `x ∈ [500, 50000]`
    - Перевірити: при невалідних значеннях `error` є непорожнім рядком
    - **Validates: Вимоги 1.4, 1.5**

  - [ ]* 2.4 Написати unit-тести для граничних значень Converter
    - Тестувати граничні значення: 100, 250, 499, 500, 50000, 50001
    - Тестувати від'ємні значення та нуль
    - _Вимоги: 1.4, 1.5_

- [x] 3. Реалізація модуля WaypointEngine
  - [x] 3.1 Реалізувати генерацію вейпоінтів в `src/modules/waypoint-engine/waypointEngine.ts`
    - Написати `calculateLoopRadius(targetDistanceKm)` за формулою `targetDistanceKm / (2 * Math.PI)`
    - Написати `generateWaypoints(options)` для Loop Mode: тригонометрична проекція, `n = clamp(floor(targetDistanceKm * 2), 4, 20)`
    - Написати `generateWaypoints(options)` для Destination Mode: рівномірний розподіл вздовж вектора
    - Написати `applyDiscoveryOffset(waypoint, radiusKm, seed)` з детермінованим PRNG
    - Застосовувати Discovery Mode та Intensity Mode відповідно до прапорців у `WaypointOptions`
    - _Вимоги: 2.1, 2.2, 2.3, 2.4, 2.6_

  - [ ]* 3.2 Написати property-тест для інваріанта радіуса Loop Mode
    - **Властивість 4: Інваріант радіуса Loop Mode**
    - Перевірити: всі вейпоінти Loop Mode знаходяться на відстані від `origin`, що відрізняється від `R` не більше ніж на 5%
    - Використати `fc.float({ min: 0.5, max: 50 })` для `targetDistanceKm`
    - **Validates: Вимога 2.1**

  - [ ]* 3.3 Написати property-тест для інваріанта кількості вейпоінтів
    - **Властивість 5: Інваріант кількості вейпоінтів**
    - Перевірити: `generateWaypoints(options).length` завжди в діапазоні [4, 20] для будь-яких допустимих параметрів
    - Тестувати обидва режими (loop та destination) та всі комбінації прапорців
    - **Validates: Вимога 2.6**

  - [ ]* 3.4 Написати property-тест для обмеження відхилення Discovery Mode
    - **Властивість 6: Обмеження відхилення Discovery Mode**
    - Перевірити: відхилення кожного вейпоінту від базової позиції не перевищує `0.4 * R`
    - **Validates: Вимога 2.3**

  - [ ]* 3.5 Написати property-тест для Intensity Mode
    - **Властивість 7: Intensity Mode збільшує кількість вейпоінтів**
    - Перевірити: кількість вейпоінтів при `intensityMode: true` строго більша за кількість при `intensityMode: false` за однакових інших параметрів
    - **Validates: Вимога 2.4**

  - [ ]* 3.6 Написати unit-тести для WaypointEngine
    - Loop Mode з мінімальною дистанцією (очікується 4 вейпоінти)
    - Loop Mode з максимальною дистанцією (очікується 20 вейпоінтів)
    - Destination Mode: вейпоінти вздовж вектора
    - _Вимоги: 2.1, 2.2, 2.6_

- [x] 4. Контрольна точка — перевірка ядра
  - Переконатися, що всі тести Converter та WaypointEngine проходять. Запитати користувача, якщо виникнуть питання.

- [x] 5. Реалізація модуля RouteBuilder
  - [x] 5.1 Реалізувати OSRM-клієнт в `src/modules/route-builder/routeBuilder.ts`
    - Написати `buildOsrmUrl(waypoints)`: формат `lng,lat;lng,lat`, параметри `overview=full&geometries=geojson&steps=false`
    - Написати `buildRoute(waypoints)`: `fetch` з `AbortController` (тайм-аут 10 с), повертає `Result<RouteResult, RouteError>`
    - Реалізувати 1 автоматичний повтор при `NETWORK_ERROR`
    - Обробити всі коди помилок: `NETWORK_ERROR`, `TIMEOUT`, `OSRM_ERROR`, `NO_ROUTE`
    - _Вимоги: 3.1, 3.2, 3.4_

  - [ ]* 5.2 Написати property-тест для OSRM URL
    - **Властивість 8: OSRM URL містить тільки координати**
    - Перевірити: `buildOsrmUrl(waypoints)` не містить жодних рядків, що нагадують ідентифікатори, токени або PII (перевірка регулярним виразом)
    - Перевірити: URL містить лише числові координати та дозволені символи запиту
    - **Validates: Вимоги 3.2, 12.2**

  - [ ]* 5.3 Написати unit-тести для RouteBuilder
    - Тестувати обробку `NETWORK_ERROR`, `TIMEOUT`, `OSRM_ERROR`, `NO_ROUTE` через мок `fetch`
    - Тестувати успішну відповідь: перевірити структуру `RouteResult`
    - Тестувати логіку повтору: один автоматичний повтор при мережевій помилці
    - _Вимоги: 3.4_

- [x] 6. Реалізація Zustand stores
  - [x] 6.1 Реалізувати `src/store/useAppStore.ts`
    - Визначити `AppState` з полями: `stage`, `heightCm`, `stepGoal`, `routeMode`, `discoveryMode`, `intensityMode`
    - Додати всі сеттери
    - Підключити `persist` middleware з `AsyncStorage` (ключ `iwalk-app-store`)
    - _Вимоги: 1.6, 5.4, 5.5, 10.3_

  - [x] 6.2 Реалізувати `src/store/useRouteStore.ts`
    - Визначити `RouteState` з полями: `waypoints`, `polyline`, `targetDistanceKm`, `isLoading`, `error`
    - Додати всі сеттери
    - Підключити `persist` middleware з `AsyncStorage` (ключ `iwalk-route-store`)
    - _Вимоги: 3.5, 6.4_

  - [x] 6.3 Реалізувати `src/store/useTrackingStore.ts`
    - Визначити `TrackingState` з полями: `isTracking`, `isPaused`, `walkedDistanceMeters`, `lastLocation`, `startedAt`, `isEnergyMode`
    - Реалізувати `updateDistance(newLocation)` з перевіркою порогу `distanceInterval`
    - Підключити `persist` middleware з `AsyncStorage` (ключ `iwalk-tracking-store`)
    - _Вимоги: 7.2, 9.1, 9.2, 9.4, 10.4_

  - [ ]* 6.4 Написати property-тест для round-trip персистентності стану
    - **Властивість 3: Round-trip персистентності стану**
    - Перевірити: після запису `heightCm` у store, серіалізації та десеріалізації — значення ідентичне збереженому
    - Перевірити: аналогічно для GeoJSON-полілінії у `useRouteStore`
    - **Validates: Вимоги 1.6, 3.5**

  - [ ]* 6.5 Написати property-тест для EnergyMode
    - **Властивість 11: Round-trip активації/деактивації EnergyMode**
    - Перевірити: `isEnergyMode` стає `true` при рівні заряду < 0.20
    - Перевірити: `isEnergyMode` стає `false` при рівні заряду > 0.25 після активації
    - Перевірити: параметри відстеження повертаються до стандартних після деактивації
    - **Validates: Вимоги 9.2, 9.4**

  - [ ]* 6.6 Написати unit-тести для stores
    - Тестувати відновлення `ActiveStage` при перезапуску (гідратація з `AsyncStorage`)
    - Тестувати `updateDistance`: дистанція оновлюється тільки при перевищенні порогу
    - _Вимоги: 7.2, 10.4_

- [x] 7. Реалізація LocationTracker та TaskManager
  - [x] 7.1 Визначити фонову задачу в `src/tasks/locationTask.ts` (глобальний скоуп)
    - Викликати `TaskManager.defineTask(LOCATION_TASK_NAME, ...)` поза компонентами
    - У тілі задачі: отримати `locations`, викликати `useTrackingStore.getState().updateDistance()`
    - Обробити помилки задачі (логування, збереження стану)
    - _Вимоги: 8.1, 8.2_

  - [x] 7.2 Реалізувати `src/modules/location-tracker/locationTracker.ts`
    - Написати `startTracking(options)`: `Location.startLocationUpdatesAsync` з `accuracy: Location.Accuracy.Balanced`
    - Написати `stopTracking()`: `Location.stopLocationUpdatesAsync`
    - Написати `haversineDistance(a, b)`: формула Haversine для відстані між двома координатами
    - _Вимоги: 7.1, 7.5, 8.3, 8.4_

  - [ ]* 7.3 Написати property-тест для порогу оновлення дистанції
    - **Властивість 10: Поріг оновлення пройденої дистанції**
    - Перевірити: `walkedDistanceMeters` оновлюється тільки коли `haversineDistance(prev, curr) >= distanceInterval`
    - Тестувати обидва режими: стандартний (50 м) та EnergyMode (100 м)
    - **Validates: Вимоги 7.2, 9.2**

  - [ ]* 7.4 Написати unit-тести для LocationTracker
    - Тестувати `haversineDistance` з відомими координатами (наприклад, Київ — Харків ≈ 410 км)
    - Тестувати `startTracking` та `stopTracking` через мок Expo Location
    - _Вимоги: 7.1, 8.3, 8.4_

- [x] 8. Контрольна точка — перевірка бізнес-логіки
  - Переконатися, що всі тести модулів та stores проходять. Запитати користувача, якщо виникнуть питання.

- [x] 9. Реалізація компонента StepOrb
  - [x] 9.1 Реалізувати `src/components/StepOrb/StepOrb.tsx`
    - Реалізувати жест обертання через `RotationGesture` з `react-native-gesture-handler`
    - Обчислювати розмір сфери: `size = BASE_SIZE + (value / MAX_VALUE) * SIZE_RANGE`
    - Анімувати розмір через `useAnimatedStyle` (Reanimated 3)
    - Викликати `Haptics.selectionAsync()` кожні 500 кроків
    - Обмежувати значення діапазоном [500, 50 000] з кроком 500
    - _Вимоги: 5.1, 5.2, 5.3_

  - [ ]* 9.2 Написати property-тест для монотонності розміру StepOrb
    - **Властивість 9: Монотонність розміру StepOrb**
    - Перевірити: для будь-яких `v1 > v2 ∈ [500, 50000]` — `computedSize(v1) > computedSize(v2)`
    - Тестувати функцію обчислення розміру як чисту функцію (без рендерингу)
    - **Validates: Вимога 5.3**

  - [ ]* 9.3 Написати unit-тести для StepOrb
    - Тестувати обмеження значення діапазоном [500, 50 000]
    - Тестувати крок зміни значення (500)
    - _Вимоги: 5.1, 5.2_

- [x] 10. Реалізація компонента RouteMapView
  - [x] 10.1 Реалізувати `src/components/MapView/RouteMapView.tsx`
    - Налаштувати `MapLibreGL.MapView` зі стилем у форматі Apple Maps (MapTiler або Stadia Maps)
    - Відобразити полілінію через `ShapeSource` + `LineLayer` з кольором `#34C759`
    - Відобразити вейпоінти як `PointAnnotation` з підтримкою drag
    - Реалізувати `onWaypointDrag` callback для оновлення маршруту
    - Додати `Animated.View` обгортку з `sharedTransitionTag` для Shared Element Transition
    - _Вимоги: 6.2, 6.3, 6.4, 7.7_

- [x] 11. Реалізація UI-компонентів
  - [x] 11.1 Реалізувати `src/components/ui/GlassPanel.tsx`
    - Використати `ExpoBlurView` з параметрами: `rgba(255,255,255,0.6)` у світлій темі, `rgba(28,28,30,0.7)` у темній
    - Підтримати темну тему через NativeWind `dark:` префікс
    - _Вимоги: 6.5, 11.5_

  - [x] 11.2 Реалізувати `src/components/ui/ProgressRing.tsx`
    - Відобразити кільце прогресу на основі `walkedDistanceMeters / targetDistanceKm`
    - Анімувати заповнення через `useAnimatedStyle` (Reanimated 3)
    - _Вимоги: 7.3_

  - [x] 11.3 Реалізувати `src/components/LiveActivityDashboard/LiveActivityDashboard.tsx`
    - Відобразити `ProgressRing`, залишок дистанції в метрах та кнопку Pause
    - Підключити до `useTrackingStore` для реактивних оновлень
    - _Вимоги: 7.3, 7.4, 7.5_

- [x] 12. Реалізація екрану ConfigStage (`app/index.tsx`)
  - [x] 12.1 Реалізувати екран `app/index.tsx`
    - Відобразити `StepOrb` для введення цілі кроків
    - Додати поле введення зросту з inline-валідацією (Converter)
    - Додати перемикач Loop Mode / Destination Mode
    - Додати перемикачі Discovery Mode та Intensity Mode (тільки для Loop Mode)
    - Відобразити індикатор "Дані обробляються локально"
    - Запитати дозвіл на геолокацію у передньому плані (`Location.requestForegroundPermissionsAsync`)
    - Заблокувати кнопку підтвердження при невалідних даних
    - При натисканні кнопки: запустити Converter → WaypointEngine → RouteBuilder, перейти до `preview` зі Spring-анімацією
    - _Вимоги: 1.1–1.6, 4.1, 4.3, 5.1–5.6, 12.3_

- [x] 13. Реалізація екрану PreviewStage (`app/preview.tsx`)
  - [x] 13.1 Реалізувати екран `app/preview.tsx`
    - Відобразити `RouteMapView` з полілінією та перетягуваними маркерами
    - Відобразити `GlassPanel` з кнопками "Назад" та "Start"
    - Показати Toast-повідомлення при помилці OSRM
    - При перетягуванні маркера: викликати `RouteBuilder.buildRoute` та оновити `useRouteStore`
    - При натисканні "Start": перейти до `active` зі Shared Element Transition для `RouteMapView`
    - При натисканні "Назад": повернутися до `index` зі збереженням параметрів у store
    - _Вимоги: 3.3, 3.6, 6.1–6.6_

- [x] 14. Реалізація екрану ActiveStage (`app/active.tsx`)
  - [x] 14.1 Реалізувати екран `app/active.tsx`
    - Відобразити `RouteMapView` на весь екран (Shared Element Transition)
    - Відобразити `LiveActivityDashboard` поверх карти
    - Запустити `LocationTracker.startTracking` при монтуванні
    - Запитати дозвіл на фонову геолокацію (`Location.requestBackgroundPermissionsAsync`)
    - Підписатися на `useTrackingStore` для відображення прогресу
    - Реалізувати кнопку Pause: `LocationTracker` призупиняє відстеження
    - При досягненні `TargetDistance`: показати екран завершення з `Haptics.notificationAsync(NotificationFeedbackType.Success)`
    - Відновлювати `ActiveStage` при перезапуску (гідратація з `useTrackingStore`)
    - _Вимоги: 7.1–7.7, 8.3–8.5, 10.2, 10.4_

- [x] 15. Реалізація Root Layout та ініціалізація TaskManager (`app/_layout.tsx`)
  - [x] 15.1 Реалізувати `app/_layout.tsx`
    - Імпортувати `src/tasks/locationTask.ts` для реєстрації TaskManager задачі у глобальному скоупі
    - Налаштувати Expo Router Stack з підтримкою Deep Linking
    - Ініціалізувати тему (NativeWind, темна/світла)
    - Оголосити режими `location` та `fetch` у `app.json`
    - _Вимоги: 8.1, 10.1, 10.2_

- [x] 16. Реалізація EnergyMode
  - [x] 16.1 Реалізувати логіку EnergyMode в `useTrackingStore` та `app/active.tsx`
    - Підписатися на `expo-battery` (`Battery.addBatteryLevelListener`)
    - При рівні < 0.20: встановити `isEnergyMode: true`, змінити `distanceInterval` на 100 м, знизити FPS до 15
    - При рівні > 0.25: встановити `isEnergyMode: false`, відновити стандартні параметри
    - Показати одноразове повідомлення при активації EnergyMode
    - _Вимоги: 9.1–9.4_

- [x] 17. Контрольна точка — фінальна перевірка
  - Переконатися, що всі тести проходять. Перевірити повний flow: ConfigStage → PreviewStage → ActiveStage. Запитати користувача, якщо виникнуть питання.

## Примітки

- Завдання, позначені `*`, є необов'язковими і можуть бути пропущені для швидшого MVP
- Кожне завдання посилається на конкретні вимоги для забезпечення трасованості
- Контрольні точки забезпечують поетапну валідацію
- Property-тести перевіряють універсальні властивості коректності (fast-check, мінімум 100 ітерацій)
- Unit-тести перевіряють конкретні приклади та граничні умови
- `src/tasks/locationTask.ts` ОБОВ'ЯЗКОВО імпортується у глобальному скоупі (`_layout.tsx`), а не всередині компонентів
- MapLibre потребує EAS Build — не працює в Expo Go
