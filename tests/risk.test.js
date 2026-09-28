import { describe, expect, it } from 'vitest';
import { confidenceScore, riskLevel, scoreBreakdown } from '../shared/risk.js';

describe('risk scoring', () => {
  it('computes consistent score and level', () => {
    const result = scoreBreakdown({
      base: 79,
      catchment: 88,
      traffic: 82,
      construction: 73,
      waste: 61,
      waterBody: 'Lake'
    }, { dryDays: 18, rainfallMm: 62 });

    expect(result.score).toBeGreaterThan(70);
    expect(riskLevel(result.score)).toBe(result.level);
  });

  it('calculates confidence using source and observations', () => {
    const confidence = confidenceScore(
      { sourceType: 'observation' },
      [{ verificationStatus: 'verified', createdAt: new Date().toISOString() }]
    );

    expect(confidence).toBeGreaterThan(60);
  });
});
