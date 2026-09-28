# FirstFlush India — dynamic build

## Run the working application

```bash
npm install
npm start
```

Open `http://localhost:8787`. This runs the browser UI and API from the same server. Data is persisted in `data/runtime.json`; uploads are stored in `uploads/` during local development.

## Dynamic features

- API-backed locations and rankings (`GET /api/locations`)
- Scenario-aware risk recalculation
- Persistent field observations and action history
- Validated image uploads up to 5 MB
- Live Open-Meteo weather when reachable, explicitly labelled fallback otherwise
- Health/status endpoint
- Polling refresh every 20 seconds for dashboard/weather status
- FirstFlush Copilot at `POST /api/chat` with deterministic local fallback
- CSV export from the API
- Print-friendly reports in the browser
- Reset local data with `curl -X POST http://localhost:8787/api/dev/reset`

## FirstFlush Copilot

The local assistant explains current prioritization records and refuses to present estimates as lab measurements. It runs without an API key. For a production AI provider, add a server-side adapter behind `AI_PROVIDER`; never place credentials in frontend code.

## Data honesty

Seed records are fallback records, not official nationwide drain measurements. User submissions are pending verification. Weather responses expose `mode`, `source`, and `updatedAt`. Risk is a relative prioritization estimate, not a toxicity or pollutant-mass measurement.

## API examples

```bash
curl http://localhost:8787/api/health
curl 'http://localhost:8787/api/locations?region=All%20India&dryDays=18&rainfall=heavy'
curl -X POST http://localhost:8787/api/chat -H 'content-type: application/json' -d '{"message":"Why is the top location risky?"}'
```

## AWS path

The current implementation is production-structured and local-complete. For AWS, deploy the frontend with Amplify Hosting and move `server/app.js` behind API Gateway/Lambda, `data/runtime.json` to DynamoDB, and `uploads/` to S3. Set `CORS_ORIGIN`, `DATA_FILE`/adapter settings, weather provider credentials if required, and AI provider credentials only as server-side environment variables. Do not claim national live coverage until verified datasets are connected.

## Three-minute demo

1. Open the dashboard and show the status badges.
2. Change dry days/rainfall; rankings update through the API.
3. Open a location and record a field action.
4. Add an observation with an image.
5. Ask FirstFlush Copilot why the top location is risky.
6. Wait for the live refresh indicator or click refresh.
7. Download the current priority CSV.

## Limitations

This repository provides a complete working local dynamic application. Nationwide official drain coverage, authenticated multi-user roles, DynamoDB/S3 adapters, and calibrated laboratory validation remain integration steps requiring approved data, cloud credentials, and operational ownership.
