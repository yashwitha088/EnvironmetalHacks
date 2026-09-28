/** @vitest-environment jsdom */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('frontend smoke', () => {
  it('contains key dynamic controls', () => {
    const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
    expect(html.includes('id="regionSelect"')).toBe(true);
    expect(html.includes('id="cityFilter"')).toBe(true);
    expect(html.includes('id="observationForm"')).toBe(true);
    expect(html.includes('id="mapCanvas"')).toBe(true);
  });
});
