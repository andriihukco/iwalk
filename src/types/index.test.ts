/**
 * Smoke tests — перевірка компіляції типів та констант
 */
import { Colors } from '../constants/colors';
import { SpringConfig } from '../constants/animation';
import { TrackingConfig } from '../constants/tracking';
import type {
  Waypoint,
  RouteResult,
  RouteError,
  RouteConfig,
  TrackingSession,
  ValidationResult,
  Result,
} from './index';

describe('Types and Constants — smoke tests', () => {
  describe('Colors constants', () => {
    it('should have routeGreen color', () => {
      expect(Colors.routeGreen).toBe('#34C759');
    });

    it('should have systemBlue colors for light and dark themes', () => {
      expect(Colors.systemBlue.light).toBe('#007AFF');
      expect(Colors.systemBlue.dark).toBe('#0A84FF');
    });

    it('should have glass colors for light and dark themes', () => {
      expect(Colors.glass.light).toBe('rgba(255,255,255,0.6)');
      expect(Colors.glass.dark).toBe('rgba(28,28,30,0.7)');
    });
  });

  describe('SpringConfig constants', () => {
    it('should have correct spring animation parameters', () => {
      expect(SpringConfig.mass).toBe(1);
      expect(SpringConfig.damping).toBe(15);
      expect(SpringConfig.stiffness).toBe(120);
    });
  });

  describe('TrackingConfig constants', () => {
    it('should have correct distance intervals', () => {
      expect(TrackingConfig.normalDistanceInterval).toBe(50);
      expect(TrackingConfig.energyDistanceInterval).toBe(100);
    });

    it('should have correct FPS values', () => {
      expect(TrackingConfig.normalFPS).toBe(60);
      expect(TrackingConfig.energyFPS).toBe(15);
    });

    it('should have correct battery thresholds', () => {
      expect(TrackingConfig.batteryThresholdLow).toBe(0.20);
      expect(TrackingConfig.batteryThresholdRestore).toBe(0.25);
    });

    it('should have correct OSRM timeout', () => {
      expect(TrackingConfig.osrmTimeoutMs).toBe(10_000);
    });

    it('should have correct waypoint limits', () => {
      expect(TrackingConfig.minWaypoints).toBe(4);
      expect(TrackingConfig.maxWaypoints).toBe(20);
    });
  });

  describe('TypeScript types — compile-time checks', () => {
    it('should create a valid Waypoint', () => {
      const waypoint: Waypoint = { latitude: 50.45, longitude: 30.52 };
      expect(waypoint.latitude).toBe(50.45);
      expect(waypoint.longitude).toBe(30.52);
    });

    it('should create a valid RouteError', () => {
      const error: RouteError = {
        code: 'NETWORK_ERROR',
        message: 'Network unavailable',
        retryable: true,
      };
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.retryable).toBe(true);
    });

    it('should create a valid RouteConfig', () => {
      const config: RouteConfig = {
        heightCm: 175,
        stepGoal: 10000,
        routeMode: 'loop',
        discoveryMode: false,
        intensityMode: false,
      };
      expect(config.heightCm).toBe(175);
      expect(config.routeMode).toBe('loop');
    });

    it('should create a valid TrackingSession', () => {
      const session: TrackingSession = {
        sessionId: 'test-uuid',
        startedAt: Date.now(),
        walkedDistanceMeters: 0,
        targetDistanceKm: 5,
        lastLocation: null,
        isPaused: false,
      };
      expect(session.sessionId).toBe('test-uuid');
      expect(session.lastLocation).toBeNull();
    });

    it('should create a valid ValidationResult', () => {
      const valid: ValidationResult = { valid: true };
      const invalid: ValidationResult = { valid: false, error: 'Out of range' };
      expect(valid.valid).toBe(true);
      expect(invalid.error).toBe('Out of range');
    });

    it('should create a valid Result<T, E> — ok case', () => {
      const result: Result<number, string> = { ok: true, value: 42 };
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it('should create a valid Result<T, E> — error case', () => {
      const result: Result<number, string> = { ok: false, error: 'Something went wrong' };
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Something went wrong');
      }
    });
  });
});
