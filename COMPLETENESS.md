# FirstFlush India — completeness checklist

This file records the scope that is intentionally implemented in the static MVP and the items that require real integrations before presenting the product as live nationwide infrastructure.

## Implemented

- Dashboard-first product flow: scenario → ranked priorities → location explanation → field action → report.
- India-wide regions, states, cities, water-body context, and seeded fallback records.
- Explainable relative-risk model with documented weights.
- Separate confidence and provenance labels.
- Map/list view toggle.
- Region, city, state, and risk filters.
- Persistent scenario settings and action records using browser local storage.
- Action choices: inspect, clean, temporary screen/diversion, sample water, monitor.
- Field observation intake with pending-verification status.
- Optional photo evidence input in location details.
- CSV export and print/save-as-PDF report flow.
- Mobile-responsive and keyboard-friendly controls.
- Explicit limitations around incomplete coverage and non-laboratory estimates.

## Still required for a real nationwide deployment

These are not fabricated in the MVP and should be added only with verified sources:

1. Connect a permitted rainfall provider (IMD or another approved source) behind a server-side adapter.
2. Import official water-body, river, catchment, and administrative boundary datasets with provenance.
3. Collect and verify real drain observations; do not treat fallback records as official data.
4. Move observations, action records, and image evidence from local storage to API Gateway/Lambda, DynamoDB, and S3.
5. Add authentication and moderation for public submissions.
6. Add an India GIS layer with licensed or OpenStreetMap-compatible tiles.
7. Calibrate the score against field inspections and laboratory samples before making water-quality claims.
8. Add notification delivery through SNS only after an operational owner and consent workflow exist.

## Recommended presentation wording

Say: “FirstFlush is a national prioritization layer that can become more accurate as verified observations are added.”

Do not say: “FirstFlush measures pollution across India” or “FirstFlush prevents a precise quantity of toxic material.”
