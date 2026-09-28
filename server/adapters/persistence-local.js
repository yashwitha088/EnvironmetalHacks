import fs from 'node:fs/promises';
import path from 'node:path';
import { dataDirectory } from '../utils/paths.js';

const localPath = process.env.LOCAL_DB_PATH || path.join(dataDirectory, 'local-db.json');
const seedPath = path.join(dataDirectory, 'seed-locations.json');

async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

async function ensureInitialized() {
  const db = await readJson(localPath);
  if (db.locations.length > 0) return db;
  const seedLocations = await readJson(seedPath);
  const initialized = {
    ...db,
    locations: seedLocations,
    meta: {
      ...db.meta,
      initializedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      mode: 'local-json-fallback'
    }
  };
  await writeJson(localPath, initialized);
  return initialized;
}

export function createLocalPersistenceAdapter() {
  return {
    mode: 'local-json-fallback',
    async read() {
      return ensureInitialized();
    },
    async write(data) {
      const payload = {
        ...data,
        meta: {
          ...(data.meta || {}),
          lastUpdated: new Date().toISOString(),
          mode: 'local-json-fallback'
        }
      };
      await writeJson(localPath, payload);
      return payload;
    },
    async reset() {
      const base = {
        locations: [],
        observations: [],
        actions: [],
        meta: { lastUpdated: null, initializedAt: null }
      };
      await writeJson(localPath, base);
      return ensureInitialized();
    }
  };
}
