export interface LocationPing {
  id?: number;
  timestamp: string;
  coordinates: [number, number];
  accuracy: number;
  speed: number;
  isOfflineSync: boolean;
  telemetry?: {
    sessionId?: string;
    deviceId?: string;
    userAgent?: string;
    platform?: string;
    language?: string;
    timezone?: string;
    timezoneOffsetMinutes?: number;
    online?: boolean;
    visibilityState?: string;
    hardwareConcurrency?: number;
    deviceMemoryGb?: number;
    maxTouchPoints?: number;
  };
  synced: boolean;
}

const DB_NAME = 'workshield-location';
const STORE_NAME = 'pings';
const DB_VERSION = 1;
const POLL_INTERVAL_MS = 60_000;
const MIN_DISTANCE_METERS = 50;
const MAX_IDLE_INTERVAL_MS = 5 * 60_000;

let intervalId: ReturnType<typeof setInterval> | null = null;
let lastRecordedPing: LocationPing | null = null;
let trackingActive = false;
const DEVICE_ID_STORAGE_KEY = 'workshield-device-id';
const SESSION_ID_STORAGE_KEY = 'workshield-session-id';

function getPersistedId(storageKey: string) {
  if (typeof window === 'undefined') return undefined;
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;

  const generated = globalThis.crypto?.randomUUID?.()
    || `${storageKey}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(storageKey, generated);
  return generated;
}

function buildTelemetry() {
  if (typeof window === 'undefined') return undefined;
  const extendedNavigator = navigator as Navigator & {
    userAgentData?: { platform?: string };
    deviceMemory?: number;
  };

  return {
    sessionId: getPersistedId(SESSION_ID_STORAGE_KEY),
    deviceId: getPersistedId(DEVICE_ID_STORAGE_KEY),
    userAgent: navigator.userAgent,
    platform: extendedNavigator.userAgentData?.platform || navigator.platform || undefined,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
    timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    online: navigator.onLine,
    visibilityState: document.visibilityState,
    hardwareConcurrency: navigator.hardwareConcurrency || undefined,
    deviceMemoryGb: extendedNavigator.deviceMemory || undefined,
    maxTouchPoints: navigator.maxTouchPoints || undefined,
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function haversineDistanceMeters(a: [number, number], b: [number, number]) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const h =
    Math.sin(dLat / 2) ** 2
    + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(h));
}

function shouldRecord(position: GeolocationPosition, previousPing: LocationPing | null) {
  if (!previousPing) return true;

  const currentCoords: [number, number] = [
    position.coords.longitude,
    position.coords.latitude,
  ];

  const distance = haversineDistanceMeters(previousPing.coordinates, currentCoords);
  const elapsedMs = Date.now() - new Date(previousPing.timestamp).getTime();

  return distance >= MIN_DISTANCE_METERS || elapsedMs >= MAX_IDLE_INTERVAL_MS;
}

export async function savePing(ping: Omit<LocationPing, 'id'>): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(ping);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getUnsyncedPings(): Promise<LocationPing[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const results = (request.result as LocationPing[]).filter((ping) => !ping.synced);
      resolve(results.sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deletePingsByIds(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    ids.forEach((id) => store.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function pollLocation() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      if (!shouldRecord(position, lastRecordedPing)) return;

      const ping: Omit<LocationPing, 'id'> = {
        timestamp: new Date().toISOString(),
        coordinates: [position.coords.longitude, position.coords.latitude],
        accuracy: Number(position.coords.accuracy || 0),
        speed: Number(position.coords.speed || 0),
        isOfflineSync: false,
        telemetry: buildTelemetry(),
        synced: false,
      };

      try {
        await savePing(ping);
        lastRecordedPing = ping;
      } catch (err) {
        console.warn('[LocationTracker] Failed to save ping:', err);
      }
    },
    (err) => {
      console.warn('[LocationTracker] Geolocation error:', err.message);
    },
    {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 60_000,
    },
  );
}

export function startTracking(): void {
  if (trackingActive || typeof window === 'undefined') return;
  if (!navigator.geolocation) {
    console.warn('[LocationTracker] Geolocation API not available');
    return;
  }

  trackingActive = true;
  pollLocation();
  intervalId = setInterval(pollLocation, POLL_INTERVAL_MS);
}

export function stopTracking(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  trackingActive = false;
}

export function isTracking(): boolean {
  return trackingActive;
}
