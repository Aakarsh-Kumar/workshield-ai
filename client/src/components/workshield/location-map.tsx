'use client';

import { useMemo } from 'react';
import type { LiveCoords } from '@/hooks/useLocationTracking';

function buildMapUrl(coords: LiveCoords, trail: LiveCoords[]) {
  const points = trail.length > 0 ? trail : [coords];
  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lng);

  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  const latPadding = Math.max((maxLat - minLat) * 0.35, 0.01);
  const lngPadding = Math.max((maxLng - minLng) * 0.35, 0.01);

  const bbox = [
    minLng - lngPadding,
    minLat - latPadding,
    maxLng + lngPadding,
    maxLat + latPadding,
  ].join(',');

  const marker = `${coords.lat},${coords.lng}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(marker)}`;
}

export function LocationMap({
  coords,
  trail,
  hasPermission,
}: {
  coords: LiveCoords | null;
  trail: LiveCoords[];
  hasPermission: boolean | null;
}) {
  const mapUrl = useMemo(() => {
    if (!coords) return null;
    return buildMapUrl(coords, trail);
  }, [coords, trail]);

  if (hasPermission === false) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <div>
          <p className="text-sm font-semibold text-slate-900">Location access is off</p>
          <p className="mt-1 text-sm text-slate-600">Enable geolocation to see your live coverage map.</p>
        </div>
      </div>
    );
  }

  if (!coords || !mapUrl) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <div>
          <p className="text-sm font-semibold text-slate-900">Waiting for live coordinates</p>
          <p className="mt-1 text-sm text-slate-600">Once the browser shares your location, your current position will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-64 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      <iframe
        title="Worker route map"
        src={mapUrl}
        className="h-full w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="pointer-events-none absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
        Live location
      </div>
    </div>
  );
}
