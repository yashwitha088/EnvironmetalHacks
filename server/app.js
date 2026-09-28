import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalPersistenceAdapter } from './adapters/persistence-local.js';
import { canUseDynamo, createDynamoPersistenceAdapter } from './adapters/persistence-dynamo.js';
import { createLocalStorageAdapter } from './adapters/storage-local.js';
import { canUseS3, createS3StorageAdapter } from './adapters/storage-s3.js';
import { createWeatherAdapter } from './adapters/weather.js';
import { applyLocationFilters } from '../shared/filters.js';
import { DEFAULT_SCENARIO, confidenceScore, scoreBreakdown } from '../shared/risk.js';
import { ACTIONS, validateActionInput, validateObservationInput, validateUpload } from './utils/validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const persistence = canUseDynamo() ? createDynamoPersistenceAdapter() : createLocalPersistenceAdapter();
const storage = canUseS3() ? createS3StorageAdapter() : createLocalStorageAdapter();
const weather = createWeatherAdapter();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }
});

function parseScenario(query) {
  const dryDays = Number(query.dryDays || DEFAULT_SCENARIO.dryDays);
  const rainfallMm = Number(query.rainfall || query.rainfallMm || DEFAULT_SCENARIO.rainfallMm);
  return {
    dryDays: Number.isFinite(dryDays) ? dryDays : DEFAULT_SCENARIO.dryDays,
    rainfallMm: Number.isFinite(rainfallMm) ? rainfallMm : DEFAULT_SCENARIO.rainfallMm
  };
}

function withComputed(location, observations, scenario) {
  const breakdown = scoreBreakdown(location, scenario);
  const related = observations.filter((item) => item.locationId === location.id);
  const confidence = confidenceScore(location, related);

  return {
    ...location,
    ...breakdown,
    confidence,
    provenance: {
      sourceType: location.sourceType,
      sourceLabel: location.provenance,
      recordType: location.sourceType === 'fallback' ? 'Fallback record' : location.sourceType === 'observation' ? 'Field observation' : 'Mixed/official',
      note: 'Estimated relative risk for prioritization. Not a laboratory measurement.'
    },
    observationCount: related.length
  };
}

function csvEscape(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
  app.use(express.json({ limit: '512kb' }));
  app.use('/uploads', express.static(path.join(projectRoot, 'uploads')));

  app.get('/api/health', async (_req, res, next) => {
    try {
      const db = await persistence.read();
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        modes: {
          persistence: persistence.mode,
          storage: storage.mode,
          weather: weather.mode
        },
        dataFreshness: db.meta?.lastUpdated || db.meta?.initializedAt || null,
        profile: persistence.mode === 'dynamodb' ? 'Live provider' : 'Local development'
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/locations', async (req, res, next) => {
    try {
      const scenario = parseScenario(req.query);
      const db = await persistence.read();
      const filtered = applyLocationFilters(db.locations, req.query);
      const computed = filtered.map((location) => withComputed(location, db.observations, scenario));
      const riskFiltered = req.query.risk ? computed.filter((item) => item.level === req.query.risk) : computed;
      riskFiltered.sort((a, b) => b.score - a.score);
      res.json({
        scenario,
        sourceMode: persistence.mode,
        fallbackRecords: riskFiltered.filter((item) => item.sourceType === 'fallback').length,
        items: riskFiltered
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/locations/:id', async (req, res, next) => {
    try {
      const scenario = parseScenario(req.query);
      const db = await persistence.read();
      const location = db.locations.find((item) => item.id === req.params.id);
      if (!location) {
        return res.status(404).json({ error: 'Location not found' });
      }

      const computed = withComputed(location, db.observations, scenario);
      const actions = db.actions.filter((item) => item.locationId === location.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const observations = db.observations.filter((item) => item.locationId === location.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return res.json({ ...computed, actions, observations });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/locations/:id/history', async (req, res, next) => {
    try {
      const db = await persistence.read();
      const history = [
        ...db.actions.filter((item) => item.locationId === req.params.id).map((item) => ({ ...item, type: 'action' })),
        ...db.observations.filter((item) => item.locationId === req.params.id).map((item) => ({ ...item, type: 'observation' }))
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      res.json({ items: history });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/observations', upload.single('photo'), async (req, res, next) => {
    try {
      const validation = validateObservationInput(req.body);
      const uploadValidation = validateUpload(req.file);
      if (!validation.valid || !uploadValidation.valid) {
        return res.status(400).json({ error: 'Validation failed', details: [...validation.errors, ...uploadValidation.errors] });
      }

      const db = await persistence.read();
      const timestamp = new Date().toISOString();
      const fields = validation.parsed;
      let locationId = fields.locationId;

      let fileMeta = null;
      if (req.file) {
        fileMeta = await storage.saveFile(req.file);
      }

      if (!locationId || !db.locations.some((item) => item.id === locationId)) {
        locationId = `OBS-${db.locations.length + 1}`;
        db.locations.push({
          id: locationId,
          name: fields.name,
          state: fields.state,
          city: fields.city,
          region: fields.region,
          waterBody: fields.waterBody || 'To be verified',
          lat: fields.lat || 20.5937,
          lon: fields.lon || 78.9629,
          base: 55,
          catchment: 55,
          traffic: 50,
          construction: 45,
          waste: fields.condition === 'Blocked / littered' ? 80 : fields.condition === 'Partially blocked' ? 65 : 40,
          provenance: 'Community field observation · pending verification',
          sourceType: 'observation',
          status: 'pending'
        });
      }

      const observation = {
        id: `ob-${Date.now()}`,
        locationId,
        condition: fields.condition,
        notes: fields.notes || '',
        verificationStatus: 'pending',
        source: 'field-observation',
        createdAt: timestamp,
        evidence: fileMeta
      };

      db.observations.push(observation);
      const saved = await persistence.write(db);
      const persistedObservation = saved.observations.find((item) => item.id === observation.id) || observation;

      return res.status(201).json({
        message: 'Observation recorded',
        locationId,
        observation: persistedObservation
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/locations/:id/actions', async (req, res, next) => {
    try {
      const validation = validateActionInput(req.body || {});
      if (!validation.valid) {
        return res.status(400).json({ error: 'Validation failed', details: validation.errors });
      }

      const db = await persistence.read();
      const location = db.locations.find((item) => item.id === req.params.id);
      if (!location) {
        return res.status(404).json({ error: 'Location not found' });
      }

      const action = {
        id: `ac-${Date.now()}`,
        locationId: req.params.id,
        actionType: req.body.actionType,
        notes: req.body.notes || '',
        status: 'completed',
        createdAt: new Date().toISOString()
      };

      db.actions.push(action);
      location.status = 'protected';
      const saved = await persistence.write(db);
      const persisted = saved.actions.find((item) => item.id === action.id) || action;
      res.status(201).json({ message: 'Action recorded', action: persisted, availableActions: ACTIONS });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/weather', async (req, res, next) => {
    try {
      const lat = Number(req.query.lat);
      const lon = Number(req.query.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return res.status(400).json({ error: 'lat and lon are required numbers' });
      }
      const result = await weather.getWeather(lat, lon);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/reports/priority.csv', async (req, res, next) => {
    try {
      const scenario = parseScenario(req.query);
      const db = await persistence.read();
      const filtered = applyLocationFilters(db.locations, req.query).map((location) => withComputed(location, db.observations, scenario));
      filtered.sort((a, b) => b.score - a.score);

      const rows = [
        ['FirstFlush India priority report'],
        ['Generated at', new Date().toISOString()],
        ['Mode', persistence.mode],
        ['Dry days', scenario.dryDays],
        ['Rainfall mm', scenario.rainfallMm],
        [],
        ['ID', 'Location', 'Region', 'State', 'City', 'Risk', 'Level', 'Confidence', 'Status', 'Source']
      ];

      filtered.forEach((item) => {
        rows.push([
          item.id,
          item.name,
          item.region,
          item.state,
          item.city,
          item.score,
          item.level,
          item.confidence,
          item.status,
          item.provenance.sourceLabel
        ]);
      });

      const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="firstflush-priority-report.csv"');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/dev/reset', async (_req, res, next) => {
    try {
      const data = await persistence.reset();
      res.json({ message: 'Local data reset', mode: persistence.mode, locations: data.locations.length });
    } catch (error) {
      next(error);
    }
  });

  app.use(express.static(projectRoot));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(projectRoot, 'index.html'));
  });

  app.use((err, _req, res, _next) => {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    res.status(500).json({ error: 'Internal server error', message });
  });

  return app;
}
