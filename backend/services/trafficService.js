const axios = require('axios');

const TRAFFIC_API_MODE = process.env.TRAFFIC_API_MODE || 'live';
const TRAFFIC_TIMEOUT_MS = Number(process.env.TRAFFIC_API_TIMEOUT_MS || 7000);
const TOMTOM_TRAFFIC_KEY = process.env.TOMTOM_TRAFFIC_KEY || '';
const TOMTOM_FLOW_ENDPOINT = process.env.TOMTOM_FLOW_ENDPOINT
  || 'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json';

const round = (value, digits = 2) => Number(Number(value).toFixed(digits));

const buildMockTrafficBaseline = (latitude, longitude) => {
  const seed = Math.abs(Math.round(latitude * 173 + longitude * 211));
  const freeFlowSpeedKph = 32 + (seed % 18);
  const currentSpeedKph = Math.max(6, freeFlowSpeedKph - (seed % 20));

  return {
    freeFlowSpeedKph: round(freeFlowSpeedKph),
    currentSpeedKph: round(currentSpeedKph),
    roadClosure: false,
    source: 'mock-traffic-provider',
  };
};

const fetchTomTomTrafficBaseline = async (latitude, longitude) => {
  if (!TOMTOM_TRAFFIC_KEY) {
    throw new Error('TOMTOM_TRAFFIC_KEY not configured');
  }

  const { data } = await axios.get(TOMTOM_FLOW_ENDPOINT, {
    params: {
      key: TOMTOM_TRAFFIC_KEY,
      point: `${Number(latitude)},${Number(longitude)}`,
      unit: 'KMPH',
    },
    timeout: TRAFFIC_TIMEOUT_MS,
  });

  const segment = data?.flowSegmentData;
  const freeFlowSpeed = Number(segment?.freeFlowSpeed);
  const currentSpeed = Number(segment?.currentSpeed);

  if (!Number.isFinite(freeFlowSpeed) || freeFlowSpeed <= 0) {
    throw new Error('Traffic provider returned no free-flow speed');
  }

  return {
    freeFlowSpeedKph: round(freeFlowSpeed),
    currentSpeedKph: Number.isFinite(currentSpeed) ? round(currentSpeed) : null,
    roadClosure: Boolean(segment?.roadClosure),
    source: 'tomtom-flow-segment',
  };
};

const fetchTrafficBaseline = async ({ latitude, longitude }) => {
  const lat = Number(latitude);
  const lon = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('latitude and longitude must be valid numbers');
  }

  if (TRAFFIC_API_MODE === 'mock') {
    return buildMockTrafficBaseline(lat, lon);
  }

  return fetchTomTomTrafficBaseline(lat, lon);
};

module.exports = {
  fetchTrafficBaseline,
};
