export function applyLocationFilters(locations, query = {}) {
  return locations.filter((location) => {
    if (query.region && query.region !== 'All India' && location.region !== query.region) return false;
    if (query.state && query.state !== 'all' && location.state !== query.state) return false;
    if (query.city && query.city !== 'all' && location.city !== query.city) return false;
    return true;
  });
}
