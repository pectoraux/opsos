/**
 * @kernel/twin-runtime/domain — barrel.
 *
 * The domain layer of the Twin Runtime. Pure types + pure helpers. Depends
 * ONLY on `@kernel/shared-kernel`.
 *
 * Public surface:
 *   - TwinState + TwinSnapshot + DEFAULT_TWIN_FIDELITY + clampUnit
 *   - TwinHistory + HistoryStore PORT
 *   - TwinTelemetry + TelemetryReading + TelemetryQuality + TelemetryStream PORT
 *   - TwinHealth + TwinIssue + TwinHealthStatus + TwinIssueSeverity +
 *     HealthMonitor PORT
 *   - TwinPrediction + TwinPredictionMethod + PredictionEngine PORT
 *   - TwinSimulation + SimulationProjectedEvent + SimulationRunner PORT
 *   - TwinRecommendation + TwinRecommendationCategory +
 *     TwinRecommendationEvidence + RecommendationGenerator PORT
 *   - TwinRegistry PORT
 */

export * from "./twin-state";
export * from "./twin-history";
export * from "./twin-telemetry";
export * from "./twin-health";
export * from "./twin-prediction";
export * from "./twin-simulation";
export * from "./twin-recommendation";
export * from "./twin-registry";
