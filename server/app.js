import crypto from 'node:crypto';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createPersistenceAdapter} from './adapters/persistence.js';
import {enrich} from './risk.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const app = express();
const persistence = createPersistenceAdapter(resolveDataFile);

function resolveDataFile() {
  return path.resolve(root, process.env.DATA_FILE || 'data/runtime.json');
}

const upload = multer({
  dest: path.join(root, 'uploads'),
  limits: {fileSize: 5 * 1024 * 1024},
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype))
});

app.disable('x-powered-by');
app.use(cors({origin: (process.env.CORS_ORIGIN || 'http://localhost:8787').split(',')}));
app.use(express.json({limit: '512kb'}));
app.use(express.static(root));

const rate = new Map();

function limit(req, res, next) {
  const key = `${req.ip}:${req.path}`;
  const now = Date.now();
  const recent = (rate.get(key) || []).filter((timestamp) => now - timestamp < 60000);
  if (recent.length >= 30) return res.status(429).json({error: 'Rate limit exceeded'});
  recent.push(now);
  rate.set(key, recent);
  next();
}

function scenario(q = {}) {
  return {
    dryDays: Number(q.dryDays || 18),
    rainfall: q.rainfall || 'heavy'
  };
}

function filtered(items, q = {}) {
  return items.filter((location) => (
    (!q.region || q.region === 'All India' || location.region === q.region) &&
    (!q.state || q.state === 'all' || location.state === q.state) &&
    (!q.city || q.city === 'all' || location.city === q.city) &&
    (!q.risk || q.risk === 'all' || enrich(location, scenario(q)).level === q.risk)
  ));
}

function rankedLocations(locations, q = {}) {
  return filtered(locations, q)
    .map((location) => enrich(location, scenario(q)))
    .sort((a, b) => b.score - a.score);
}

function localCopilotAnswer(message, data, inputScenario, locationId) {
  const text = message.toLowerCase();
  const ranked = rankedLocations(data.locations, inputScenario || {dryDays: 18, rainfall: 'heavy'});
  const selected = ranked.find((item) => item.id === locationId);
  const top = selected || ranked[0];

  if (!top) {
    return 'I do not have location records yet. Add a field observation first, then ask me again.';
  }

  if (text.includes('why')) {
    return `FirstFlush Copilot: ${top.name} is currently prioritized at ${top.score}/100 because dry-spell accumulation, rainfall context, catchment exposure, traffic pressure, construction, and waste indicators combine into a high relative risk score. Confidence is ${top.confidence}%. This is a prioritization estimate only; it is not a laboratory toxicity result and does not report exact pollutant quantities.`;
  }

  if (text.includes('action') || text.includes('next')) {
    return `Recommended next action for ${top.name}: inspect first, record observations, and consider temporary diversion/screens or a water sample where safe. Use field verification because this model estimates priority and does not prove pollutant concentration.`;
  }

  if (text.includes('confidence') || text.includes('source') || text.includes('provenance')) {
    return `${top.name} currently shows ${top.confidence}% confidence with provenance: ${top.source}. Seed and community observations remain operational inputs and should be validated before policy or lab claims.`;
  }

  if (text.includes('weather') || text.includes('fallback') || text.includes('data')) {
    return 'Weather responses are labelled as live Open-Meteo or fallback mode with update time. Location rankings are operational estimates from current API records and field submissions, not certified nationwide laboratory monitoring.';
  }

  return 'I can explain current risk ranking, factor breakdown, confidence/provenance, recommended actions, and system limits. I cannot provide lab toxicity claims or exact pollutant quantities.';
}

app.get('/api/health', async (_req, res) => {
  const data = await persistence.read();
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    persistence: 'local-json',
    weather: 'open-meteo-ready-fallback',
    ai: process.env.AI_PROVIDER || 'local-fallback',
    locations: data.locations.length
  });
});

app.get('/api/locations', async (req, res) => {
  const data = await persistence.read();
  const items = rankedLocations(data.locations, req.query);
  res.json({
    items,
    scenario: scenario(req.query),
    updatedAt: new Date().toISOString(),
    source: 'Fallback seed records; replace with verified observations',
    stats: {
      actions: data.actions.length,
      observations: data.observations.length
    }
  });
});

app.get('/api/locations/:id', async (req, res) => {
  const data = await persistence.read();
  const item = data.locations.find((location) => location.id === req.params.id);
  if (!item) return res.status(404).json({error: 'Location not found'});

  res.json({
    ...enrich(item, scenario(req.query)),
    actions: data.actions.filter((action) => action.locationId === item.id),
    observations: data.observations.filter((observation) => observation.locationId === item.id)
  });
});

app.post('/api/locations/:id/actions', limit, async (req, res) => {
  const data = await persistence.read();
  const item = data.locations.find((location) => location.id === req.params.id);
  if (!item) return res.status(404).json({error: 'Location not found'});

  const actionType = String(req.body.actionType || '').trim();
  const allowed = ['Inspect', 'Clean', 'Temporary screen / diversion', 'Sample water', 'Monitor'];
  if (!allowed.includes(actionType)) return res.status(400).json({error: 'Invalid action'});

  const action = {
    id: crypto.randomUUID(),
    locationId: item.id,
    actionType,
    notes: String(req.body.notes || '').slice(0, 500),
    createdAt: new Date().toISOString(),
    actor: 'local operator'
  };
  data.actions.push(action);
  await persistence.write(data);
  res.status(201).json(action);
});

app.post('/api/observations', limit, upload.single('photo'), async (req, res) => {
  const required = ['name', 'state', 'condition'];
  if (required.some((key) => !String(req.body[key] || '').trim())) {
    return res.status(400).json({error: 'name, state and condition are required'});
  }

  const data = await persistence.read();
  const locationId = String(req.body.locationId || '').trim() || null;
  const matchedLocation = locationId ? data.locations.find((location) => location.id === locationId) : null;

  if (locationId && !matchedLocation) {
    return res.status(400).json({error: 'locationId does not exist'});
  }

  const observation = {
    id: `OBS-${Date.now()}`,
    locationId: matchedLocation ? matchedLocation.id : null,
    name: String(req.body.name).slice(0, 120),
    state: String(req.body.state).slice(0, 80),
    condition: String(req.body.condition).slice(0, 80),
    notes: String(req.body.notes || '').slice(0, 500),
    photo: req.file ? `/uploads/${req.file.filename}` : null,
    verificationStatus: 'Pending verification',
    createdAt: new Date().toISOString()
  };

  data.observations.push(observation);

  if (!matchedLocation) {
    data.locations.push({
      id: observation.id,
      name: observation.name,
      city: 'Field observation',
      state: observation.state,
      region: 'South India',
      lat: 17.4,
      lon: 78.4,
      waterBody: 'To be verified',
      catchment: 55,
      traffic: 50,
      construction: 45,
      waste: observation.condition.toLowerCase().includes('blocked') ? 80 : 40,
      base: 58,
      confidence: 25,
      source: 'Community field observation · pending verification'
    });
  }

  await persistence.write(data);
  res.status(201).json(observation);
});

app.get('/api/weather', async (req, res) => {
  const lat = Number(req.query.lat || 17.385);
  const lon = Number(req.query.lon || 78.486);

  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation_probability,precipitation&forecast_days=1&timezone=auto`);
    if (!response.ok) throw new Error('provider unavailable');

    const json = await response.json();
    res.json({
      mode: 'live',
      source: 'Open-Meteo',
      updatedAt: new Date().toISOString(),
      latitude: lat,
      longitude: lon,
      nextHours: json.hourly?.precipitation?.slice(0, 6) || [],
      probability: json.hourly?.precipitation_probability?.slice(0, 6) || []
    });
  } catch {
    res.json({
      mode: 'fallback',
      source: 'Fallback scenario',
      updatedAt: new Date().toISOString(),
      nextHours: [8, 12, 24, 62],
      probability: [20, 30, 55, 80]
    });
  }
});

app.post('/api/chat', limit, async (req, res) => {
  const message = String(req.body.message || '').trim();
  if (!message) return res.status(400).json({error: 'message is required'});

  const data = await persistence.read();
  res.json({
    mode: 'local-fallback',
    answer: localCopilotAnswer(message, data, req.body.scenario, req.body.locationId),
    createdAt: new Date().toISOString(),
    limitations: 'Operational prioritization assistant only; no lab toxicity or exact pollutant quantity claims.'
  });
});

app.get('/api/reports/priority.csv', async (req, res) => {
  const data = await persistence.read();
  const rows = rankedLocations(data.locations, req.query);
  const escapeCsv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

  const csv = [
    ['FirstFlush India report'],
    ['Generated', new Date().toISOString()],
    [],
    ['ID', 'Location', 'City', 'State', 'Risk', 'Level', 'Confidence', 'Source'],
    ...rows.map((row) => [row.id, row.name, row.city, row.state, row.score, row.level, row.confidence, row.source])
  ].map((row) => row.map(escapeCsv).join(',')).join('\n');

  res
    .type('text/csv')
    .set('Content-Disposition', 'attachment; filename="firstflush-priority-report.csv"')
    .send(csv);
});

app.post('/api/dev/reset', limit, async (_req, res) => {
  const {seed} = await import('./store.js');
  await persistence.write(JSON.parse(JSON.stringify(seed)));
  res.json({ok: true});
});

app.get('*', (_req, res) => res.sendFile(path.join(root, 'index.html')));

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const port = Number(process.env.PORT || 8787);
  app.listen(port, () => console.log(`FirstFlush running on http://localhost:${port}`));
}

export {app};
