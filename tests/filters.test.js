import { describe, expect, it } from 'vitest';
import { applyLocationFilters } from '../shared/filters.js';

describe('location filters', () => {
  const fixtures = [
    { id: '1', region: 'South India', state: 'Telangana', city: 'Hyderabad' },
    { id: '2', region: 'North India', state: 'Delhi', city: 'Delhi' }
  ];

  it('filters by region and city', () => {
    const result = applyLocationFilters(fixtures, { region: 'South India', city: 'Hyderabad' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});
