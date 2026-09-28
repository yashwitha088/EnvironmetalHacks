# FirstFlush India

**Act before polluted runoff reaches India's waters.**

FirstFlush India is a deployable environmental decision-support MVP for prioritizing drainage points before polluted first-flush stormwater reaches lakes, rivers, and recharge areas. It is designed for the Environmental Hacks / Bharat Builds Tour hackathon (October 8–11, 2026).

## What problem it addresses

After dry periods, the first rain can wash accumulated road dust, oil residue, tyre/brake particles, construction material, animal waste, and litter into storm drains. Local teams often have limited time and no ranked, explainable way to decide which locations to inspect, clean, protect, or sample first.

FirstFlush does **not** claim to measure toxicity or replace laboratory water testing. It provides a transparent **relative prioritization estimate** from visible factors and recorded observations.

## Current MVP

- India-wide styled overview with transparent fallback records across states
- Region and state filtering
- Adjustable dry spell and rainfall scenarios
- Explainable risk score and factor breakdown
- Interactive risk map visualization
- Priority queue with action recommendations
- Location detail drawer with confidence and provenance
- Field observation intake with pending-verification status
- Intervention recording
- CSV priority-report export
- Methodology and limitations disclosure
- Responsive, accessible UI with mobile layout
- No API keys required for the fallback deployment

## Run locally

This is a zero-build static site:

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

Alternatively open `index.html` directly in a browser. A modern browser is recommended.

## AWS Amplify deployment

1. Push this repository to GitHub.
2. In AWS Amplify Hosting, choose **Deploy without Git** or connect the repository.
3. Use the repository root as the app root.
4. The included `amplify.yml` uses the static `index.html` directly.
5. No environment variables are required for fallback mode.

Optional future integrations are documented below; the public MVP intentionally works without credentials.

## Risk model

The score is a transparent relative estimate:

- Dry-period accumulation: 25%
- Rainfall intensity: 20%
- Paved/catchment exposure: 15%
- Traffic exposure: 15%
- Construction proximity: 10%
- Waste/animal activity: 10%
- Connected water-body sensitivity: 5%

Data confidence is shown separately. Confidence reflects observation completeness, freshness, verification state, and source type. A high risk score with low confidence should be treated as a request for field verification, not as a fact.

## Data honesty

The current records are clearly labelled as fallback/seeded records so the website remains usable without live APIs. They are not presented as official municipal measurements. To add real observations, use the in-app field observation form; production should store verified submissions in DynamoDB/S3 and attach source metadata.

Suggested real observation schema:

```text
drain_id, latitude, longitude, city, state, connected_water_body,
observation_date, blockage_level, litter_level, traffic_exposure,
construction_nearby, catchment_type, photo_url, source, verification_status
```

## Suggested production architecture

- AWS Amplify Hosting: frontend deployment
- API Gateway + Lambda: risk calculation and observations API
- DynamoDB: locations, observations, actions, provenance
- S3: field photos and generated reports
- EventBridge: forecast refresh / rain threshold trigger
- SNS: optional operational notifications
- CloudWatch: monitoring and audit logs
- Weather-provider adapter: IMD or another approved provider, with fallback mode
- OpenStreetMap-compatible map layer or a licensed national geospatial provider

## Three-minute demo flow

1. Open FirstFlush India and explain the first-flush problem.
2. Set **18 days** dry spell and **Heavy · 62 mm** rainfall.
3. Click **Run risk assessment**.
4. Open the top priority and show the visible factor breakdown and confidence.
5. Record the location as protected.
6. Add a field observation and show its pending-verification label.
7. Export the priority CSV report.
8. State the limitation: the score prioritizes action; it is not a lab result.

## Design principles

- Make the next environmental action obvious.
- Explain every estimate.
- Distinguish official data, field observations, fallback data, and model estimates.
- Avoid unsupported pollution multipliers and exact pollutant-mass claims.
- Prefer a small verified pilot over pretending to have complete national drain coverage.

## Future work

- Verified national observation onboarding
- Official rainfall provider integration
- GIS catchment import and river/water-body boundaries
- Photo evidence and verification workflow
- Real intervention outcome tracking
- Laboratory sample result ingestion
- Calibrated model trained on Indian runoff observations
- Role-based access for civic teams and NGOs

## License

Add the license chosen by the team before public production use.
