const CONDITIONS = ['Blocked / littered', 'Partially blocked', 'Clear', 'Standing water'];
const ACTIONS = ['Inspect', 'Clean', 'Temporary screen / diversion', 'Sample water', 'Monitor'];

export { CONDITIONS, ACTIONS };

export function toNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function validateObservationInput(fields) {
  const errors = [];
  if (!fields.name || String(fields.name).trim().length < 3) {
    errors.push('name must be at least 3 characters');
  }
  if (!fields.state) errors.push('state is required');
  if (!fields.city) errors.push('city is required');
  if (!fields.region) errors.push('region is required');
  if (!CONDITIONS.includes(fields.condition)) {
    errors.push('condition is invalid');
  }

  const lat = toNumber(fields.lat);
  const lon = toNumber(fields.lon);
  if (lat !== null && (lat < 6 || lat > 38)) errors.push('lat must be within India bounds');
  if (lon !== null && (lon < 68 || lon > 98)) errors.push('lon must be within India bounds');

  return {
    valid: errors.length === 0,
    errors,
    parsed: {
      ...fields,
      lat,
      lon
    }
  };
}

export function validateActionInput(fields) {
  const errors = [];
  if (!ACTIONS.includes(fields.actionType)) {
    errors.push('actionType is invalid');
  }
  if (fields.notes && String(fields.notes).length > 500) {
    errors.push('notes must be 500 characters or less');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateUpload(file) {
  if (!file) return { valid: true, errors: [] };
  const errors = [];
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.mimetype)) {
    errors.push('photo must be jpeg, png, or webp');
  }
  if (file.size > 4 * 1024 * 1024) {
    errors.push('photo exceeds 4MB limit');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
