/**
 * Formats duration in milliseconds to MM:SS stopwatch string.
 * @param ms - Duration in milliseconds.
 * @returns Zero-padded string in MM:SS format.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Formats timestamp to HH:mm localized time string.
 * @param timestamp - Epoch millisecond timestamp.
 * @param locale - BCP 47 language code (defaults to 'fr').
 * @returns Formatted 24-hour time string.
 */
export function formatTimeOnly(timestamp: number, locale: string = 'fr'): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(timestamp));
  } catch {
    const d = new Date(timestamp);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
}

/**
 * Formats timestamp to full localized date and time string.
 * @param timestamp - Epoch millisecond timestamp.
 * @param locale - BCP 47 language code (defaults to 'fr').
 * @returns Localized date and time string.
 */
export function formatDateFull(timestamp: number, locale: string = 'fr'): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

/**
 * Computes human-readable relative time (e.g. 'just now', '5m ago').
 * @param timestamp - Epoch millisecond timestamp.
 * @param locale - BCP 47 language code ('fr', 'ar', 'en').
 * @returns Localized relative time description.
 */
export function formatRelativeTime(timestamp: number, locale: string = 'fr'): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) {
    if (locale === 'ar') return 'الآن';
    if (locale === 'en') return 'just now';
    return "À l'instant";
  }

  if (diffMin < 60) {
    if (locale === 'ar') return `منذ ${diffMin} د`;
    if (locale === 'en') return `${diffMin}m ago`;
    return `Il y a ${diffMin} min`;
  }

  if (diffHours < 24) {
    return formatTimeOnly(timestamp, locale);
  }

  if (diffDays === 1) {
    if (locale === 'ar') return 'أمس';
    if (locale === 'en') return 'Yesterday';
    return 'Hier';
  }

  return formatDateFull(timestamp, locale);
}
