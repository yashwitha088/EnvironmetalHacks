import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

async function createTempDb() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'firstflush-test-'));
  const file = path.join(dir, 'local-db.json');
  await fs.writeFile(file, JSON.stringify({ locations: [], observations: [], actions: [], meta: {} }, null, 2));
  return { file, dir };
}

describe('api endpoints', () => {
  let app;

  beforeEach(async () => {
    vi.resetModules();
    process.env.AWS_REGION = '';
    process.env.DDB_APP_TABLE = '';
    process.env.S3_UPLOAD_BUCKET = '';
    const tmp = await createTempDb();
    process.env.LOCAL_DB_PATH = tmp.file;
    process.env.LOCAL_UPLOADS_DIR = tmp.dir;
    const mod = await import('../server/app.js');
    app = mod.createApp();
  });

  it('returns filtered locations', async () => {
    const response = await request(app).get('/api/locations?region=South%20India&dryDays=10&rainfall=24');
    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeGreaterThan(0);
    expect(response.body.items.every((item) => item.region === 'South India')).toBe(true);
  });

  it('validates observations', async () => {
    const response = await request(app)
      .post('/api/observations')
      .field('name', 'x')
      .field('state', '')
      .field('city', '')
      .field('region', '')
      .field('condition', 'Unknown');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('records action and persists in history', async () => {
    const first = await request(app).get('/api/locations');
    const id = first.body.items[0].id;

    const action = await request(app)
      .post(`/api/locations/${id}/actions`)
      .send({ actionType: 'Inspect', notes: 'Checked screen' });

    expect(action.status).toBe(201);

    const history = await request(app).get(`/api/locations/${id}/history`);
    expect(history.status).toBe(200);
    expect(history.body.items.some((item) => item.type === 'action' && item.actionType === 'Inspect')).toBe(true);
  });

  it('accepts observation image upload metadata', async () => {
    const response = await request(app)
      .post('/api/observations')
      .field('name', 'Observation point')
      .field('state', 'Telangana')
      .field('city', 'Hyderabad')
      .field('region', 'South India')
      .field('condition', 'Blocked / littered')
      .attach('photo', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { filename: 'evidence.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(201);
    expect(response.body.observation.evidence.originalName).toBe('evidence.jpg');
  });
});
