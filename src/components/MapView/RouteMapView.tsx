/**
 * RouteMapView — компонент карти на базі MapLibre.
 *
 * Відображає полілінію маршруту та перетягувані маркери вейпоінтів.
 * Підтримує Shared Element Transition через Reanimated 3.
 *
 * Вимоги: 6.2, 6.3, 6.4, 7.7
 *
 * ПРИМІТКА: MapLibre потребує EAS Build — не працює в Expo Go.
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { SharedTransition, withSpring } from 'react-native-reanimated';
import MapLibreGL from '@maplibre/maplibre-react-native';

import { Waypoint } from '../../types/index';
import { Colors } from '../../constants/colors';
import { SpringConfig } from '../../constants/animation';

// ─── Константи ────────────────────────────────────────────────────────────────

/**
 * Стиль карти у форматі Apple Maps через Stadia Maps.
 * Не потребує API-ключа для розробки.
 */
const MAP_STYLE_URL = 'https://tiles.stadiamaps.com/styles/alidade_smooth.json';

/** Ідентифікатор джерела GeoJSON для полілінії */
const POLYLINE_SOURCE_ID = 'route-polyline-source';

/** Ідентифікатор шару полілінії */
const POLYLINE_LAYER_ID = 'route-polyline-layer';

// ─── Типи ─────────────────────────────────────────────────────────────────────

interface RouteMapViewProps {
  /** GeoJSON-полілінія маршруту (null — не відображати) */
  polyline: GeoJSON.LineString | null;
  /** Масив вейпоінтів маршруту */
  waypoints: Waypoint[];
  /** Поточна геолокація користувача */
  userLocation: Waypoint | null;
  /** Callback при завершенні перетягування вейпоінту */
  onWaypointDrag: (index: number, newPosition: Waypoint) => void;
  /** Якщо true — карта займає весь екран (для ActiveStage) */
  fullScreen?: boolean;
  /** Тег для Shared Element Transition (Reanimated 3) */
  sharedTransitionTag?: string;
}

// ─── Допоміжні функції ─────────────────────────────────────────────────────────

/**
 * Перетворює GeoJSON.LineString на GeoJSON Feature для ShapeSource.
 */
function polylineToFeature(
  polyline: GeoJSON.LineString,
): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    geometry: polyline,
    properties: {},
  };
}

/**
 * Обчислює центр карти на основі вейпоінтів або геолокації.
 * Повертає [longitude, latitude] для MapLibre.
 */
function computeMapCenter(
  waypoints: Waypoint[],
  userLocation: Waypoint | null,
): [number, number] {
  if (waypoints.length > 0) {
    // Центр як середнє арифметичне координат вейпоінтів
    const sumLat = waypoints.reduce((acc, wp) => acc + wp.latitude, 0);
    const sumLng = waypoints.reduce((acc, wp) => acc + wp.longitude, 0);
    return [sumLng / waypoints.length, sumLat / waypoints.length];
  }
  if (userLocation) {
    return [userLocation.longitude, userLocation.latitude];
  }
  // Київ як fallback
  return [30.5234, 50.4501];
}

// ─── Компонент ────────────────────────────────────────────────────────────────

/**
 * RouteMapView — відображає MapLibre карту з полілінією та вейпоінтами.
 *
 * Вимоги: 6.2, 6.3, 6.4, 7.7
 */
export function RouteMapView({
  polyline,
  waypoints,
  userLocation,
  onWaypointDrag,
  fullScreen = false,
  sharedTransitionTag,
}: RouteMapViewProps): React.JSX.Element {
  // Центр карти
  const mapCenter = useMemo(
    () => computeMapCenter(waypoints, userLocation),
    [waypoints, userLocation],
  );

  // GeoJSON Feature для ShapeSource (мемоізовано)
  const polylineFeature = useMemo(
    () => (polyline ? polylineToFeature(polyline) : null),
    [polyline],
  );

  // Обробник завершення перетягування маркера вейпоінту.
  // Примітка: типи MapLibre оголошують onDragEnd як () => void, але
  // реальна реалізація передає GeoJSON Feature як перший аргумент.
  // Використовуємо type assertion для коректної обробки.
  const handleDragEnd = useCallback(
    (index: number) => (event: unknown) => {
      const feature = event as { geometry: { coordinates: [number, number] } };
      if (feature?.geometry?.coordinates) {
        const [longitude, latitude] = feature.geometry.coordinates;
        onWaypointDrag(index, { latitude, longitude });
      }
    },
    [onWaypointDrag],
  );

  // Стиль контейнера: повноекранний або звичайний
  const containerStyle = fullScreen
    ? StyleSheet.absoluteFillObject
    : styles.container;

  // Shared Element Transition через Reanimated 3
  const sharedTransition = sharedTransitionTag
    ? SharedTransition.custom((values) => {
        'worklet';
        return {
          width: withSpring(values.targetWidth, SpringConfig),
          height: withSpring(values.targetHeight, SpringConfig),
          originX: withSpring(values.targetOriginX, SpringConfig),
          originY: withSpring(values.targetOriginY, SpringConfig),
        };
      })
    : undefined;

  const mapContent = (
    <View style={containerStyle}>
      <MapLibreGL.MapView
        style={styles.map}
        styleURL={MAP_STYLE_URL}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
      >
        {/* Камера: центрується на маршруті або геолокації */}
        <MapLibreGL.Camera
          centerCoordinate={mapCenter}
          zoomLevel={13}
          animationMode="flyTo"
          animationDuration={500}
        />

        {/* Полілінія маршруту (Вимога 6.2) */}
        {polylineFeature && (
          <MapLibreGL.ShapeSource
            id={POLYLINE_SOURCE_ID}
            shape={polylineFeature}
          >
            <MapLibreGL.LineLayer
              id={POLYLINE_LAYER_ID}
              style={{
                lineColor: Colors.routeGreen,
                lineWidth: 4,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* Маркери вейпоінтів з підтримкою drag (Вимоги 6.3, 6.4) */}
        {waypoints.map((waypoint, index) => (
          <MapLibreGL.PointAnnotation
            key={`waypoint-${index}`}
            id={`waypoint-${index}`}
            coordinate={[waypoint.longitude, waypoint.latitude]}
            draggable
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onDragEnd={handleDragEnd(index) as any}
          >
            <View style={styles.waypointMarker}>
              <View style={styles.waypointDot} />
            </View>
          </MapLibreGL.PointAnnotation>
        ))}

        {/* Маркер поточної геолокації */}
        {userLocation && (
          <MapLibreGL.PointAnnotation
            id="user-location"
            coordinate={[userLocation.longitude, userLocation.latitude]}
          >
            <View style={styles.userLocationMarker}>
              <View style={styles.userLocationDot} />
            </View>
          </MapLibreGL.PointAnnotation>
        )}
      </MapLibreGL.MapView>
    </View>
  );

  // Якщо є sharedTransitionTag — обгортаємо в Animated.View (Вимога 7.7)
  if (sharedTransitionTag) {
    return (
      <Animated.View
        style={containerStyle}
        sharedTransitionTag={sharedTransitionTag}
        sharedTransitionStyle={sharedTransition}
      >
        {mapContent}
      </Animated.View>
    );
  }

  return mapContent;
}

// ─── Стилі ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 16,
  },
  map: {
    flex: 1,
  },
  // Маркер вейпоінту (Вимога 6.3)
  waypointMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  waypointDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.routeGreen,
  },
  // Маркер геолокації користувача
  userLocationMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  userLocationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
});

export default RouteMapView;
