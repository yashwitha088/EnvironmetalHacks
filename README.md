# FirstFlush India — Option A local build

## Run locally (no AI key required)

```bash
npm install
npm start
```

Open `http://localhost:8787`.

- Frontend and API are served by the same Express server.
- Local persistence is stored in `data/runtime.json`.
- Uploaded observation images are stored in `uploads/` (local demo only).

## Required validation commands

```bash
npm run lint
npm run test
npm run build
```

## Option A demo flow (exact)

1. Open dashboard; confirm **Live / Fallback / Offline** status badge and last-updated timestamp.
2. Change dry days/rainfall/filters; rankings refresh from `GET /api/locations`.
3. Open a location, record an action, and close.
4. Add an observation (with optional allowed image upload).
5. Refresh page; action/observation history remains persisted.
6. Ask Copilot: `Why is the top location risky?`
7. Click **Refresh now** (manual) or wait for automatic 20-second polling.
8. Export CSV from the API-backed report.

## API endpoints

- `GET /api/health`
- `GET /api/locations?dryDays=&rainfall=&region=&state=&city=&risk=`
- `GET /api/locations/:id`
- `POST /api/locations/:id/actions`
- `POST /api/observations` (multipart form; image types: jpeg/png/webp/gif, max 5 MB)
- `GET /api/weather?lat=&lon=`
- `POST /api/chat`
- `GET /api/reports/priority.csv`
- `POST /api/dev/reset` (local demo reset)

## Leaflet / OpenStreetMap map

- Uses Leaflet with OpenStreetMap-compatible tiles:
  - Tile URL: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
  - Attribution: `© OpenStreetMap contributors`
- Markers are drawn from seeded API lat/lon records and filtered with the active scenario/query.
- If map tiles fail, the UI switches to a graceful fallback list that still opens full location details.

## FirstFlush Copilot (local fallback)

`POST /api/chat` runs a deterministic local assistant grounded in current API records and selected scenario/location context.

It explicitly does **not** claim:
- laboratory toxicity results
- exact pollutant quantities

No external AI key is required for Option A.

## Fallback behavior and status clarity

- Dashboard polls every **20 seconds** plus manual refresh.
- Weather endpoint labels `mode`, `source`, and `updatedAt`.
- System badge reports **Live**, **Fallback**, or **Offline**.
- `lastUpdated` always reflects latest successful `GET /api/locations` refresh.

## AWS-ready adapter path (without requiring AWS credentials now)

Current local persistence uses an adapter boundary at:
- `server/adapters/persistence.js` (local JSON implementation)

Future deployment path:
- Replace persistence adapter internals with DynamoDB implementation.
- Replace local uploads path with S3-backed storage adapter.
- Keep route contracts unchanged so frontend continues to work with the same API.

Do not add secrets to source code. Configure provider credentials only through server-side environment variables in deployment.
