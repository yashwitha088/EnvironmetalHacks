import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import request from 'supertest';
import {app} from '../server/app.js';

let dataFile;

beforeEach(async () => {
  dataFile = path.join(os.tmpdir(), `firstflush-test-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  process.env.DATA_FILE = dataFile;
  await request(app).post('/api/dev/reset').send({});
});

afterEach(async () => {
  delete process.env.DATA_FILE;
  vi.restoreAllMocks();
  await fs.rm(dataFile, {force: true});
});

describe('FirstFlush API', () => {
  it('health is available', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('returns scored locations and API stats', async () => {
    const response = await request(app).get('/api/locations?dryDays=18&rainfall=heavy');
    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeGreaterThan(0);
    expect(response.body.items[0]).toHaveProperty('score');
    expect(response.body.stats).toEqual(expect.objectContaining({actions: expect.any(Number), observations: expect.any(Number)}));
  });

  it('persists location actions', async () => {
    const create = await request(app)
      .post('/api/locations/D-04/actions')
      .send({actionType: 'Inspect', notes: 'Check inlet obstruction'});

    expect(create.status).toBe(201);
    expect(create.body.locationId).toBe('D-04');

    const detail = await request(app).get('/api/locations/D-04');
    expect(detail.status).toBe(200);
    expect(detail.body.actions.some((action) => action.id === create.body.id)).toBe(true);
  });

  it('persists observations for selected location', async () => {
    const create = await request(app)
      .post('/api/observations')
      .field('locationId', 'D-04')
      .field('name', 'Lake North outfall')
      .field('state', 'Telangana')
      .field('condition', 'Blocked / littered')
      .field('notes', 'Field report');

    expect(create.status).toBe(201);
    expect(create.body.locationId).toBe('D-04');

    const detail = await request(app).get('/api/locations/D-04');
    expect(detail.status).toBe(200);
    expect(detail.body.observations.some((observation) => observation.id === create.body.id)).toBe(true);
  });

  it('answers Copilot locally with explicit limitations', async () => {
    const response = await request(app)
      .post('/api/chat')
      .send({message: 'Why is the top location risky?', scenario: {dryDays: 30, rainfall: 'extreme'}, locationId: 'D-04'});

    expect(response.status).toBe(200);
    expect(response.body.mode).toBe('local-fallback');
    expect(response.body.answer).toMatch(/prioritization estimate/i);
    expect(response.body.answer).toMatch(/not a laboratory toxicity result/i);
  });

  it('returns fallback weather when provider is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'));

    const response = await request(app).get('/api/weather?lat=10&lon=10');
    expect(response.status).toBe(200);
    expect(response.body.mode).toBe('fallback');
    expect(response.body.source).toMatch(/Fallback/i);
  });
});
