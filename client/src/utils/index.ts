// ─── Shared utility functions ─────────────────────────────────────────────────

/**
 * Format an ISO date string to a human-readable relative label.
 * e.g. "2 hours ago", "3d ago"
 */
export function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/**
 * Truncate a string to `maxLength` characters, appending "…" if needed.
 */
export function truncate(str: string, maxLength: number): string {
  return str.length > maxLength ? `${str.slice(0, maxLength)}…` : str
}

/**
 * Convert a score (0–1) to a human-readable percentage string.
 */
export function scoreToPercent(score: number): string {
  return `${Math.round(score * 100)}%`
}
