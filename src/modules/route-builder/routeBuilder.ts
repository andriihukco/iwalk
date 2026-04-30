/**
 * RouteBuilder — OSRM API клієнт для побудови пішохідних маршрутів
 * Вимоги: 3.1, 3.2, 3.4
 */

import { Waypoint, RouteResult, RouteError, Result } from '../../types/index';
import { TrackingConfig } from '../../constants/tracking';

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/foot';

/**
 * Формує URL запиту до OSRM (тільки координати, без PII)
 * Вимога 3.2: передаються виключно координати вейпоінтів
 */
export function buildOsrmUrl(waypoints: Waypoint[]): string {
  // OSRM використовує формат lng,lat (довгота першою)
  const coords = waypoints
    .map((wp) => `${wp.longitude},${wp.latitude}`)
    .join(';');

  return `${OSRM_BASE_URL}/${coords}?overview=full&geometries=geojson&steps=false`;
}

/**
 * Виконує один запит до OSRM з тайм-аутом 10 секунд
 */
async function fetchRoute(
  url: string
): Promise<Result<RouteResult, RouteError>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    TrackingConfig.osrmTimeoutMs
  );

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: 'OSRM_ERROR',
          message: `OSRM повернув помилку: HTTP ${response.status}`,
          retryable: true,
        },
      };
    }

    const data = await response.json();

    // Перевірка коду відповіді OSRM
    if (data.code !== 'Ok') {
      return {
        ok: false,
        error: {
          code: 'OSRM_ERROR',
          message: `OSRM повернув код: ${data.code}`,
          retryable: true,
        },
      };
    }

    // Перевірка наявності маршруту
    if (!data.routes || data.routes.length === 0) {
      return {
        ok: false,
        error: {
          code: 'NO_ROUTE',
          message: 'Маршрут не знайдено. Спробуйте змінити параметри.',
          retryable: false,
        },
      };
    }

    const route = data.routes[0];

    return {
      ok: true,
      value: {
        polyline: route.geometry as GeoJSON.LineString,
        distanceMeters: route.distance,
        durationSeconds: route.duration,
      },
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    // AbortController спрацював — тайм-аут
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        ok: false,
        error: {
          code: 'TIMEOUT',
          message: 'OSRM не відповів протягом 10 секунд. Перевірте з\'єднання.',
          retryable: true,
        },
      };
    }

    // Мережева помилка
    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Мережа недоступна. Перевірте підключення до інтернету.',
        retryable: true,
      },
    };
  }
}

/**
 * Будує пішохідний маршрут через OSRM API
 * Вимога 3.1: анонімізований запит до OSRM API
 * Вимога 3.4: тайм-аут 10 с, 1 автоматичний повтор при NETWORK_ERROR
 */
export async function buildRoute(
  waypoints: Waypoint[]
): Promise<Result<RouteResult, RouteError>> {
  const url = buildOsrmUrl(waypoints);

  // Перший спроба
  const firstResult = await fetchRoute(url);

  // 1 автоматичний повтор тільки при NETWORK_ERROR
  if (!firstResult.ok && firstResult.error.code === 'NETWORK_ERROR') {
    return fetchRoute(url);
  }

  return firstResult;
}
