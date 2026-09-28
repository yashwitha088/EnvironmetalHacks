export const rainfallMm = { light: 8, moderate: 24, heavy: 62, extreme: 110 };
export function riskScore(location, {dryDays=18, rainfall='heavy'}={}) {
  const dry = Math.min(100, Number(dryDays) / 18 * 100);
  const rain = Math.min(100, (rainfallMm[rainfall] ?? Number(rainfall) ?? 0) / 62 * 100);
  const raw = .25*dry + .20*rain + .15*location.catchment + .15*location.traffic + .10*location.construction + .10*location.waste + .05*80;
  return Math.round(Math.min(99, raw*.82 + location.base*.18));
}
export function riskLevel(score) { return score >= 80 ? 'very-high' : score >= 65 ? 'high' : score >= 45 ? 'medium' : 'low'; }
export function confidence(location) { return Math.max(5, Math.min(99, Number(location.confidence || 30))); }
export function enrich(location, scenario) { const score = riskScore(location, scenario); return {...location, score, level:riskLevel(score), confidence:confidence(location)}; }
