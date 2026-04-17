import { getToken } from './auth';
import { deletePingsByIds, getUnsyncedPings, type LocationPing } from './locationTracker';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'no-token';

const ENDPOINT = '/api/location/pings';
const SYNC_INTERVAL_MS = 3 * 60_000;
const OFFLINE_SYNC_THRESHOLD_MS = 30_000;

let syncIntervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(status: SyncStatus, detail?: string) => void>();

function notifyListeners(status: SyncStatus, detail?: string) {
  listeners.forEach((listener) => listener(status, detail));
}

function buildPayload(pings: LocationPing[]) {
  const now = Date.now();
  return pings.map((ping) => ({
    timestamp: ping.timestamp,
    coordinates: ping.coordinates,
    accuracy: ping.accuracy,
    speed: ping.speed,
    isOfflineSync: ping.isOfflineSync || now - new Date(ping.timestamp).getTime() > OFFLINE_SYNC_THRESHOLD_MS,
    telemetry: ping.telemetry,
  }));
}

export function onSyncStatus(listener: (status: SyncStatus, detail?: string) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function syncNow(): Promise<void> {
  const token = getToken();
  if (!token) {
    notifyListeners('no-token', 'No auth token available yet.');
    return;
  }

  const unsynced = await getUnsyncedPings();
  if (unsynced.length === 0) {
    notifyListeners('idle', 'No pending location pings.');
    return;
  }

  notifyListeners('syncing', `Uploading ${unsynced.length} location ping(s)...`);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ pings: buildPayload(unsynced) }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    await deletePingsByIds(unsynced.map((ping) => ping.id).filter((id): id is number => typeof id === 'number'));
    notifyListeners('success', `${unsynced.length} location ping(s) synced.`);
  } catch (err) {
    console.warn('[LocationSync] Sync failed:', err);
    notifyListeners('error', err instanceof Error ? err.message : 'Sync failed');
  }
}

export function startSyncLoop() {
  if (syncIntervalId || typeof window === 'undefined') return;
  syncNow().catch(() => undefined);
  syncIntervalId = setInterval(() => {
    syncNow().catch(() => undefined);
  }, SYNC_INTERVAL_MS);
}

export function stopSyncLoop() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}
