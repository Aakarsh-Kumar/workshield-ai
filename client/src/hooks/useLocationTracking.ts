'use client';

import { useEffect, useRef, useState } from 'react';
import { isTracking as getIsTracking, startTracking, stopTracking } from '@/lib/locationTracker';
import { onSyncStatus, startSyncLoop, stopSyncLoop, type SyncStatus } from '@/lib/locationSync';

export interface LiveCoords {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: string;
}

export interface LocationTrackingState {
  isTracking: boolean;
  syncStatus: SyncStatus;
  syncDetail: string | null;
  hasPermission: boolean | null;
  liveCoords: LiveCoords | null;
  trail: LiveCoords[];
}

const MAX_TRAIL = 20;

export const useLocationTracking = (): LocationTrackingState => {
  const [isTracking, setIsTracking] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncDetail, setSyncDetail] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(() => {
    if (typeof navigator === 'undefined') return null;
    return navigator.geolocation ? null : false;
  });
  const [liveCoords, setLiveCoords] = useState<LiveCoords | null>(null);
  const [trail, setTrail] = useState<LiveCoords[]>([]);
  const startedRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const unsubscribe = onSyncStatus((status, detail) => {
      setSyncStatus(status);
      setSyncDetail(detail ?? null);
    });

    if (!navigator.geolocation) {
      return () => unsubscribe();
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setHasPermission(true);
        const initialCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString(),
        };
        setLiveCoords(initialCoords);
        setTrail([initialCoords]);

        startTracking();
        setIsTracking(getIsTracking());
        startSyncLoop();

        watchIdRef.current = navigator.geolocation.watchPosition(
          (nextPosition) => {
            const nextCoords = {
              lat: nextPosition.coords.latitude,
              lng: nextPosition.coords.longitude,
              accuracy: nextPosition.coords.accuracy,
              timestamp: new Date().toISOString(),
            };
            setLiveCoords(nextCoords);
            setTrail((prev) => [...prev.slice(-(MAX_TRAIL - 1)), nextCoords]);
          },
          (error) => {
            console.warn('[LocationTracking] watchPosition error:', error.message);
          },
          { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
        );
      },
      () => {
        setHasPermission(false);
      },
      { timeout: 5000, maximumAge: 60_000 },
    );

    return () => {
      stopTracking();
      stopSyncLoop();
      setIsTracking(false);
      unsubscribe();
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  return { isTracking, syncStatus, syncDetail, hasPermission, liveCoords, trail };
};
