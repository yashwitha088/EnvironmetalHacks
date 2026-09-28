function fallbackWeather(lat, lon, reason = 'Fallback weather context') {
  return {
    lat,
    lon,
    rainfallMm: 24,
    source: 'Fallback weather context',
    mode: 'fallback',
    lastUpdated: new Date().toISOString(),
    fallbackReason: reason
  };
}

export function createWeatherAdapter() {
  const useFallbackOnly = process.env.WEATHER_PROVIDER_MODE === 'fallback';

  return {
    mode: useFallbackOnly ? 'fallback' : 'open-meteo',
    async getWeather(lat, lon) {
      if (useFallbackOnly) {
        return fallbackWeather(lat, lon, 'WEATHER_PROVIDER_MODE=fallback');
      }

      try {
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.searchParams.set('latitude', String(lat));
        url.searchParams.set('longitude', String(lon));
        url.searchParams.set('hourly', 'precipitation');
        url.searchParams.set('forecast_days', '1');

        const response = await fetch(url, { headers: { accept: 'application/json' } });
        if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
        const payload = await response.json();
        const values = payload?.hourly?.precipitation || [];
        const rainfallMm = values.slice(0, 6).reduce((sum, value) => sum + Number(value || 0), 0);

        return {
          lat,
          lon,
          rainfallMm: Number(rainfallMm.toFixed(2)),
          source: 'Open-Meteo',
          mode: 'live',
          lastUpdated: new Date().toISOString()
        };
      } catch (error) {
        return fallbackWeather(lat, lon, error instanceof Error ? error.message : 'Unknown weather error');
      }
    }
  };
}
