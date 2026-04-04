const axios = require('axios');

const WEATHER_MODE = process.env.WEATHER_API_MODE || 'live';
const WEATHER_TIMEOUT_MS = Number(process.env.WEATHER_API_TIMEOUT_MS || 7000);
const ARCHIVE_ENDPOINT = process.env.WEATHER_ARCHIVE_ENDPOINT || 'https://archive-api.open-meteo.com/v1/archive';
const FORECAST_ENDPOINT = process.env.WEATHER_FORECAST_ENDPOINT || 'https://api.open-meteo.com/v1/forecast';

const toDateString = (dateInput) => {
  const date = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid weather observation date');
  }
  return date.toISOString().slice(0, 10);
};

const parsePrecipitation = (payload) => {
  const value = payload?.daily?.precipitation_sum?.[0];
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return Number(numeric.toFixed(2));
  }
  return null;
};

const fetchFromEndpoint = async (endpoint, params) => {
  const { data } = await axios.get(endpoint, {
    params,
    timeout: WEATHER_TIMEOUT_MS,
  });

  return parsePrecipitation(data);
};

const buildMockRainfall = (latitude, longitude, observedDate) => {
  const seed = Math.abs(Math.round(latitude * 131 + longitude * 97 + observedDate.replace(/-/g, '')));
  const rainfallMm = Number(((seed % 1200) / 20).toFixed(2));
  return {
    rainfallMm,
    source: 'mock-weather-provider',
    observedDate,
    latitude,
    longitude,
  };
};

const fetchRainfallMm = async ({ latitude, longitude, observedAt }) => {
  const lat = Number(latitude);
  const lon = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('latitude and longitude must be valid numbers');
  }

  const observedDate = toDateString(observedAt);

  if (WEATHER_MODE === 'mock') {
    return buildMockRainfall(lat, lon, observedDate);
  }

  const params = {
    latitude: lat,
    longitude: lon,
    start_date: observedDate,
    end_date: observedDate,
    daily: 'precipitation_sum',
    timezone: 'UTC',
  };

  try {
    const archiveRain = await fetchFromEndpoint(ARCHIVE_ENDPOINT, params);
    if (archiveRain != null) {
      return {
        rainfallMm: archiveRain,
        source: 'open-meteo-archive',
        observedDate,
        latitude: lat,
        longitude: lon,
      };
    }
  } catch (err) {
    console.warn('weather archive lookup failed:', err.message);
  }

  const forecastRain = await fetchFromEndpoint(FORECAST_ENDPOINT, params);
  if (forecastRain == null) {
    throw new Error('Weather provider returned no precipitation data');
  }

  return {
    rainfallMm: forecastRain,
    source: 'open-meteo-forecast',
    observedDate,
    latitude: lat,
    longitude: lon,
  };
};

module.exports = {
  fetchRainfallMm,
};
