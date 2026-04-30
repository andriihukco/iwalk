/**
 * Спільні TypeScript-типи для iWalk
 */

// Географічна точка
export interface Waypoint {
  latitude: number;   // -90 до 90
  longitude: number;  // -180 до 180
}

// Результат побудови маршруту
export interface RouteResult {
  polyline: GeoJSON.LineString;
  distanceMeters: number;
  durationSeconds: number;
}

// Помилка маршруту
export interface RouteError {
  code: 'NETWORK_ERROR' | 'TIMEOUT' | 'OSRM_ERROR' | 'NO_ROUTE';
  message: string;
  retryable: boolean;
}

// Параметри маршруту (персистуються)
export interface RouteConfig {
  heightCm: number;           // 100–250
  stepGoal: number;           // 500–50 000
  routeMode: 'loop' | 'destination';
  discoveryMode: boolean;
  intensityMode: boolean;
  destinationWaypoint?: Waypoint;
}

// Стан відстеження (персистується для відновлення)
export interface TrackingSession {
  sessionId: string;          // UUID
  startedAt: number;          // Unix timestamp
  walkedDistanceMeters: number;
  targetDistanceKm: number;
  lastLocation: Waypoint | null;
  isPaused: boolean;
  pausedAt?: number;
}

// Результат валідації
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Узагальнений Result тип
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
