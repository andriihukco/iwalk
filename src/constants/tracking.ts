/**
 * Константи відстеження iWalk
 */
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
