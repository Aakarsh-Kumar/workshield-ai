const LocationPing = require('../models/LocationPing');

const validateWorkerInZone = async (workerId, eventPolygon, timeWindow) => {
  if (!eventPolygon || !timeWindow?.start || !timeWindow?.end) {
    return {
      inZone: null,
      matchedPing: null,
      pingCount: 0,
    };
  }

  const filter = {
    workerId,
    timestamp: {
      $gte: new Date(timeWindow.start),
      $lte: new Date(timeWindow.end),
    },
    location: {
      $geoIntersects: {
        $geometry: eventPolygon,
      },
    },
  };

  const [matchedPing, pingCount] = await Promise.all([
    LocationPing.findOne(filter).sort({ timestamp: -1 }).lean(),
    LocationPing.countDocuments(filter),
  ]);

  return {
    inZone: Boolean(matchedPing),
    matchedPing,
    pingCount,
  };
};

const findWorkersInZone = async (eventPolygon, timeWindow) => {
  if (!eventPolygon || !timeWindow?.start || !timeWindow?.end) {
    return [];
  }

  return LocationPing.distinct('workerId', {
    timestamp: {
      $gte: new Date(timeWindow.start),
      $lte: new Date(timeWindow.end),
    },
    location: {
      $geoWithin: {
        $geometry: eventPolygon,
      },
    },
  });
};

module.exports = {
  validateWorkerInZone,
  findWorkersInZone,
};
