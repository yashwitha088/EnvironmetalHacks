# FirstFlush India

**Pre-rain runoff risk prioritization for India (dynamic full-stack app).**

FirstFlush India helps civic teams prioritize which drain/outfall to inspect or protect before rainfall.  
It provides **estimated relative risk** for prioritization and **does not claim lab-measured pollution concentrations**.

---

## What is implemented

- Dynamic API-backed dashboard (no hard-coded frontend state)
- Region/state/city/risk/scenario filtering via API
- Shared risk domain logic (`shared/risk.js`) used by frontend + backend
- Location detail with factors, confidence, provenance, and timeline history
- Observation intake API with validation (`multipart/form-data`, optional image)
- Action logging API with persistence and audit timeline
- CSV export endpoint + print-friendly frontend report
- Weather adapter:
  - Live: Open-Meteo (no key)
  - Fallback: explicit mode + source + timestamp
- Health endpoint exposing provider modes and freshness
- Persistence adapters:
  - Local JSON fallback (default, no credentials)
  - DynamoDB adapter (when env configured)
- File adapters:
  - Local uploads folder fallback
  - S3 adapter (when env configured)
- Interactive map using Leaflet + OpenStreetMap tiles with fallback message
- Loading/error/retry UX, toasts, and responsive UI
- Tests for risk, filters, validation/API, action persistence, frontend smoke
- AWS SAM template for API Gateway + Lambda + DynamoDB + S3
- Amplify frontend build config

---

## Project structure

- `index.html`, `styles.css`, `app.js` — frontend UI
- `shared/` — shared domain logic (risk + filters)
- `server/app.js` — Express API
- `server/lambda.js` — Lambda handler for API Gateway
- `server/adapters/` — persistence/storage/weather adapters
- `data/seed-locations.json` — labelled fallback seed records
- `data/local-db.json` — local persistence store
- `scripts/reset-data.js` — reset local data from seed
- `template.yaml` — AWS SAM deployment template for API

---

## Local run (no AWS credentials required)

```bash
npm install
npm run reset-data
npm run dev
```

- Frontend: `http://localhost:4173`
- API: `http://localhost:8787`

Single-server mode:

```bash
npm run start
```

Then open `http://localhost:8787`.

---

## Scripts

- `npm run dev` — Vite frontend + nodemon API
- `npm run start` — API server (also serves frontend files)
- `npm run build` — frontend production build (`dist/`)
- `npm run test` — vitest suite
- `npm run lint` — eslint
- `npm run typecheck` — TypeScript no-emit check
- `npm run reset-data` — reset local JSON and reload seed records

---

## Environment variables

See `.env.example`.

### Local fallback mode (default)
Leave AWS variables unset to use local JSON + local uploads.

### AWS mode
Set:

- `AWS_REGION`
- `DDB_APP_TABLE`
- `S3_UPLOAD_BUCKET`
- optional `S3_UPLOAD_PREFIX`

Weather:

- `WEATHER_PROVIDER_MODE=open-meteo` (default)
- `WEATHER_PROVIDER_MODE=fallback` to force fallback

---

## API endpoints

- `GET /api/health`
- `GET /api/locations?region=&state=&city=&risk=&dryDays=&rainfall=`
- `GET /api/locations/:id`
- `GET /api/locations/:id/history`
- `POST /api/observations` (`multipart/form-data`, optional `photo`)
- `POST /api/locations/:id/actions`
- `GET /api/weather?lat=&lon=`
- `GET /api/reports/priority.csv?...`
- `POST /api/dev/reset` (local reset helper)

### Example request

```bash
curl "http://localhost:8787/api/locations?region=South%20India&dryDays=18&rainfall=62"
```

---

## AWS deployment

### Frontend (Amplify Hosting)

1. Connect repository in Amplify.
2. Amplify uses `amplify.yml`:
   - `npm ci`
   - `npm run build`
   - publish `dist/`
3. Set frontend environment variable (if needed) for API base URL strategy in your hosting setup.

### Backend (API Gateway + Lambda + DynamoDB + S3)

Deploy `template.yaml` with SAM:

```bash
sam build
sam deploy --guided
```

Creates:

- HTTP API Gateway
- Lambda (`server/lambda.handler`)
- DynamoDB table (`pk`, `sk`)
- S3 bucket for image evidence

### IAM permissions

Lambda role requires:

- DynamoDB CRUD on app table
- S3 Put/Get/Delete on uploads bucket

(Already attached in `template.yaml` policies.)

---

## Data honesty and limitations

- Risk score is an **estimate for prioritization**, not a toxicity or lab measurement.
- Seed records are explicitly marked fallback and are not official municipal records.
- India coverage is incomplete until verified field/official datasets are added.
- Weather endpoint includes source/timestamp and fallback mode when live data is unavailable.

---

## Hackathon demo walkthrough (3 minutes)

1. Open dashboard, show mode badge from `/api/health`.
2. Change dry days + rainfall scenario.
3. Show priority list re-ranking from API response.
4. Open top location detail and explain factors/provenance/confidence.
5. Record action and show updated timeline.
6. Add field observation (with optional photo) and show pending verification.
7. Export CSV report and print summary.
8. State limitation clearly: prioritization estimate, not lab measurement.
