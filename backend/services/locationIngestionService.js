const axios = require('axios');
const LocationPing = require('../models/LocationPing');

const MAX_ACCEPTABLE_ACCURACY_METERS = 150;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:5001';

const isValidCoordinates = (coords) =>
  Array.isArray(coords)
  && coords.length === 2
  && Number.isFinite(Number(coords[0]))
  && Number.isFinite(Number(coords[1]))
  && Number(coords[0]) >= -180
  && Number(coords[0]) <= 180
  && Number(coords[1]) >= -90
  && Number(coords[1]) <= 90;

const toLocationPingDoc = (workerId, rawPing) => ({
  workerId,
  timestamp: new Date(rawPing.timestamp),
  location: {
    type: 'Point',
    coordinates: [Number(rawPing.coordinates[0]), Number(rawPing.coordinates[1])],
  },
  accuracy: Number(rawPing.accuracy),
  speed: Number(rawPing.speed ?? 0),
  isOfflineSync: Boolean(rawPing.isOfflineSync),
  telemetry: rawPing.telemetry ? {
    sessionId: rawPing.telemetry.sessionId || undefined,
    deviceId: rawPing.telemetry.deviceId || undefined,
    userAgent: rawPing.telemetry.userAgent || undefined,
    platform: rawPing.telemetry.platform || undefined,
    language: rawPing.telemetry.language || undefined,
    timezone: rawPing.telemetry.timezone || undefined,
    timezoneOffsetMinutes: Number.isFinite(Number(rawPing.telemetry.timezoneOffsetMinutes))
      ? Number(rawPing.telemetry.timezoneOffsetMinutes)
      : undefined,
    online: typeof rawPing.telemetry.online === 'boolean' ? rawPing.telemetry.online : undefined,
    visibilityState: rawPing.telemetry.visibilityState || undefined,
    hardwareConcurrency: Number.isFinite(Number(rawPing.telemetry.hardwareConcurrency))
      ? Number(rawPing.telemetry.hardwareConcurrency)
      : undefined,
    deviceMemoryGb: Number.isFinite(Number(rawPing.telemetry.deviceMemoryGb))
      ? Number(rawPing.telemetry.deviceMemoryGb)
      : undefined,
    maxTouchPoints: Number.isFinite(Number(rawPing.telemetry.maxTouchPoints))
      ? Number(rawPing.telemetry.maxTouchPoints)
      : undefined,
  } : undefined,
});

const filterAndInsert = async (workerId, rawPings = []) => {
  const validDocs = [];
  let discarded = 0;

  rawPings.forEach((rawPing) => {
    const accuracy = Number(rawPing?.accuracy);
    if (
      !rawPing
      || !rawPing.timestamp
      || Number.isNaN(new Date(rawPing.timestamp).getTime())
      || !isValidCoordinates(rawPing.coordinates)
      || !Number.isFinite(accuracy)
      || accuracy > MAX_ACCEPTABLE_ACCURACY_METERS
    ) {
      discarded += 1;
      return;
    }

    validDocs.push(toLocationPingDoc(workerId, rawPing));
  });

  if (validDocs.length > 0) {
    await LocationPing.insertMany(validDocs, { ordered: false });
  }

  return {
    saved: validDocs.length,
    discarded,
    docs: validDocs,
  };
};

const triggerKinematicCheck = async (workerId, pings = []) => {
  if (!Array.isArray(pings) || pings.length < 2) {
    return null;
  }

  const { data } = await axios.post(
    `${AI_SERVICE_URL}/kinematic-check`,
    { worker_id: workerId, pings },
    { timeout: 5000 },
  );

  return data;
};

module.exports = {
  filterAndInsert,
  triggerKinematicCheck,
};
