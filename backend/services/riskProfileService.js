const LocationPing = require('../models/LocationPing');
const HazardZone = require('../models/HazardZone');

const LOOKBACK_DAYS = 7;
const MAX_PINGS_TO_SAMPLE = 200;

const getWorkerRecentPings = async (workerId) => {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  return LocationPing.find(
    { workerId, timestamp: { $gte: since } },
    { location: 1, _id: 0 },
  )
    .sort({ timestamp: -1 })
    .limit(MAX_PINGS_TO_SAMPLE)
    .lean();
};

const getZonesForPoint = async (coords) =>
  HazardZone.find(
    {
      isActive: true,
      boundary: {
        $geoIntersects: {
          $geometry: {
            type: 'Point',
            coordinates: coords,
          },
        },
      },
    },
    { zoneId: 1, hazardType: 1, riskMultiplier: 1, name: 1, _id: 0 },
  ).lean();

const getLocationRiskMultiplier = async (workerId) => {
  const pings = await getWorkerRecentPings(workerId);

  if (pings.length === 0) {
    return { locationRiskMultiplier: 1.0, matchedZones: [], pingsSampled: 0 };
  }

  const uniqueCoordKeys = new Set();
  const uniqueCoords = [];

  for (const ping of pings) {
    const [lng, lat] = ping.location.coordinates;
    const key = `${lng.toFixed(4)},${lat.toFixed(4)}`;
    if (!uniqueCoordKeys.has(key)) {
      uniqueCoordKeys.add(key);
      uniqueCoords.push([lng, lat]);
    }
  }

  const zoneQueryResults = await Promise.all(uniqueCoords.map((coords) => getZonesForPoint(coords)));
  const zoneMap = new Map();

  zoneQueryResults.forEach((zones) => {
    zones.forEach((zone) => {
      if (!zoneMap.has(zone.zoneId)) {
        zoneMap.set(zone.zoneId, zone);
      }
    });
  });

  const matchedZones = Array.from(zoneMap.values());
  const locationRiskMultiplier = matchedZones.length > 0
    ? Math.max(...matchedZones.map((zone) => zone.riskMultiplier))
    : 1.0;

  return {
    locationRiskMultiplier: Number(locationRiskMultiplier.toFixed(4)),
    matchedZones: matchedZones.map(({ zoneId, hazardType, name, riskMultiplier }) => ({
      zoneId,
      hazardType,
      name,
      riskMultiplier,
    })),
    pingsSampled: pings.length,
  };
};

module.exports = {
  getLocationRiskMultiplier,
};
