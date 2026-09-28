export const RISK_WEIGHTS = {
  dryDays: 0.25,
  rainfall: 0.2,
  catchment: 0.15,
  traffic: 0.15,
  construction: 0.1,
  waste: 0.1,
  waterSensitivity: 0.05
};

export const DEFAULT_SCENARIO = {
  dryDays: 18,
  rainfallMm: 62
};

export function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function riskLevel(score) {
  if (score >= 80) return 'very-high';
  if (score >= 65) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

export function scoreBreakdown(location, scenario = DEFAULT_SCENARIO) {
  const dryDaysFactor = clamp((Number(scenario.dryDays || 0) / 18) * 100);
  const rainfallFactor = clamp((Number(scenario.rainfallMm || 0) / 62) * 100);
  const waterSensitivity = location.waterBody ? 80 : 40;
  const base = Number(location.base || 50);

  const weightedRaw = (
    RISK_WEIGHTS.dryDays * dryDaysFactor +
    RISK_WEIGHTS.rainfall * rainfallFactor +
    RISK_WEIGHTS.catchment * Number(location.catchment || 0) +
    RISK_WEIGHTS.traffic * Number(location.traffic || 0) +
    RISK_WEIGHTS.construction * Number(location.construction || 0) +
    RISK_WEIGHTS.waste * Number(location.waste || 0) +
    RISK_WEIGHTS.waterSensitivity * waterSensitivity
  );

  const score = Math.round(clamp(weightedRaw * 0.82 + base * 0.18, 0, 99));

  return {
    score,
    level: riskLevel(score),
    factors: {
      dryDays: Math.round(dryDaysFactor),
      rainfall: Math.round(rainfallFactor),
      catchment: Number(location.catchment || 0),
      traffic: Number(location.traffic || 0),
      construction: Number(location.construction || 0),
      waste: Number(location.waste || 0),
      waterSensitivity
    }
  };
}

export function confidenceScore(location, relatedObservations = []) {
  const sourceBonus = location.sourceType === 'official' ? 25 : location.sourceType === 'mixed' ? 15 : 5;
  const observationBonus = Math.min(20, relatedObservations.length * 5);
  const verificationBonus = relatedObservations.some((item) => item.verificationStatus === 'verified') ? 20 : 0;
  const freshnessBonus = relatedObservations.some((item) => {
    const created = new Date(item.createdAt || 0).getTime();
    return Number.isFinite(created) && Date.now() - created < 1000 * 60 * 60 * 24 * 30;
  }) ? 15 : 0;

  return clamp(Math.round(35 + sourceBonus + observationBonus + verificationBonus + freshnessBonus));
}
