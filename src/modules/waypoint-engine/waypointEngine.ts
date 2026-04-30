/**
 * Модуль генерації вейпоінтів маршруту (WaypointEngine)
 * Чисті функції для генерації вейпоінтів у Loop Mode та Destination Mode,
 * з підтримкою Discovery Mode та Intensity Mode.
 */

import { Waypoint } from '../../types/index';

export { Waypoint };

export interface WaypointOptions {
  mode: 'loop' | 'destination';
  discoveryMode: boolean;
  intensityMode: boolean;
  targetDistanceKm: number;
  origin: Waypoint;
  destination?: Waypoint; // Тільки для Destination Mode
}

/**
 * Кількість кілометрів на один градус широти/довготи (наближення).
 */
const KM_PER_DEGREE = 111.32;

/**
 * Обмежує значення в діапазоні [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Детермінований PRNG на основі sin (LCG-подібний).
 * Повертає значення в діапазоні [0, 1).
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

/**
 * Обчислює радіус кола для Loop Mode.
 * Формула: R = TargetDistance / (2π)
 */
export function calculateLoopRadius(targetDistanceKm: number): number {
  return targetDistanceKm / (2 * Math.PI);
}

/**
 * Застосовує ентропійне відхилення для Discovery Mode.
 * Зміщує вейпоінт на випадковий вектор величиною до 40% від radiusKm.
 * Використовує детермінований PRNG для відтворюваності.
 */
export function applyDiscoveryOffset(
  waypoint: Waypoint,
  radiusKm: number,
  seed: number
): Waypoint {
  // Генеруємо два незалежних зміщення для lat та lng
  const latRandom = seededRandom(seed * 2) * 2 - 1;       // [-1, 1)
  const lngRandom = seededRandom(seed * 2 + 1) * 2 - 1;   // [-1, 1)

  const maxOffsetKm = 0.4 * radiusKm;

  const latOffsetKm = latRandom * maxOffsetKm;
  const lngOffsetKm = lngRandom * maxOffsetKm;

  // Конвертуємо км у градуси
  const latOffsetDeg = latOffsetKm / KM_PER_DEGREE;
  const lngOffsetDeg =
    lngOffsetKm / (KM_PER_DEGREE * Math.cos((waypoint.latitude * Math.PI) / 180));

  return {
    latitude: waypoint.latitude + latOffsetDeg,
    longitude: waypoint.longitude + lngOffsetDeg,
  };
}

/**
 * Генерує масив вейпоінтів (4–20 точок) відповідно до параметрів маршруту.
 *
 * Loop Mode: тригонометрична проекція від origin по колу радіуса R.
 * Destination Mode: рівномірний розподіл вздовж вектора від origin до destination.
 *
 * Discovery Mode: додає детерміноване випадкове відхилення до кожного вейпоінту.
 * Intensity Mode: збільшує кількість вейпоінтів (множник 4 замість 2).
 */
export function generateWaypoints(options: WaypointOptions): Waypoint[] {
  const { mode, discoveryMode, intensityMode, targetDistanceKm, origin, destination } = options;

  // Визначаємо кількість вейпоінтів
  const multiplier = intensityMode ? 4 : 2;
  const n = clamp(Math.floor(targetDistanceKm * multiplier), 4, 20);

  const radiusKm = calculateLoopRadius(targetDistanceKm);

  let waypoints: Waypoint[];

  if (mode === 'loop') {
    waypoints = generateLoopWaypoints(origin, n, radiusKm);
  } else {
    waypoints = generateDestinationWaypoints(origin, destination ?? origin, n);
  }

  // Застосовуємо Discovery Mode
  if (discoveryMode) {
    waypoints = waypoints.map((wp, index) =>
      applyDiscoveryOffset(wp, radiusKm, index)
    );
  }

  return waypoints;
}

/**
 * Генерує вейпоінти для Loop Mode через тригонометричну проекцію.
 * Координати: lat_i = origin.lat + R * sin(i * θ) / 111.32
 *             lng_i = origin.lng + R * cos(i * θ) / (111.32 * cos(origin.lat * π/180))
 */
function generateLoopWaypoints(
  origin: Waypoint,
  n: number,
  radiusKm: number
): Waypoint[] {
  const theta = (2 * Math.PI) / n;
  const cosLat = Math.cos((origin.latitude * Math.PI) / 180);

  const waypoints: Waypoint[] = [];

  for (let i = 0; i < n; i++) {
    const angle = i * theta;
    const latitude = origin.latitude + (radiusKm * Math.sin(angle)) / KM_PER_DEGREE;
    const longitude =
      origin.longitude + (radiusKm * Math.cos(angle)) / (KM_PER_DEGREE * cosLat);

    waypoints.push({ latitude, longitude });
  }

  return waypoints;
}

/**
 * Генерує вейпоінти для Destination Mode — рівномірний розподіл вздовж вектора.
 * Перша точка — origin, остання — destination, проміжні — лінійна інтерполяція.
 */
function generateDestinationWaypoints(
  origin: Waypoint,
  destination: Waypoint,
  n: number
): Waypoint[] {
  const waypoints: Waypoint[] = [];

  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    waypoints.push({
      latitude: origin.latitude + t * (destination.latitude - origin.latitude),
      longitude: origin.longitude + t * (destination.longitude - origin.longitude),
    });
  }

  return waypoints;
}
