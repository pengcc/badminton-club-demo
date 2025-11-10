/**
 * Shared utilities for match display and processing
 *
 * **Design Rationale:**
 * - UI-level formatting utilities for locale-specific display
 * - Type-safe date handling with comprehensive error handling
 * - Performance-optimized formatting with locale support
 * - Data computation now handled by View layer transformers
 *
 * Note: Match data processing (team names, results, date calculations) is now
 * handled by the View layer (MatchViewTransformers). This file contains only
 * UI-specific formatting utilities.
 */

/**
 * Format match date for display with comprehensive error handling
 *
 * @param date - Date string or Date object
 * @param options - Formatting options
 * @returns Formatted date string or fallback
 */
export function formatMatchDate(
  date: string | Date,
  options: {
    includeWeekday?: boolean;
    includeTime?: boolean;
    time?: string;
    locale?: string;
  } = {}
): string {
  const {
    includeWeekday = false,
    includeTime = false,
    time,
    locale = 'de-DE'
  } = options;

  try {
    const matchDate = new Date(date);
    if (isNaN(matchDate.getTime())) {
      return 'Ungültiges Datum';
    }

    let formatted = '';

    if (includeWeekday) {
      const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(matchDate);
      formatted += `${weekday}, `;
    }

    formatted += matchDate.toLocaleDateString(locale);

    if (includeTime && time) {
      formatted += ` um ${time} Uhr`;
    }

    return formatted;
  } catch {
    return 'Ungültiges Datum';
  }
}

/**
 * Get status badge variant for match status
 *
 * @param status - Match status
 * @returns Badge variant string
 */
export function getStatusBadgeVariant(status: string): string {
  switch (status) {
    case 'scheduled':
      return 'default';
    case 'ongoing':
      return 'secondary';
    case 'completed':
      return 'outline';
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

/**
 * Get result badge configuration
 *
 * @param result - Match result
 * @returns Badge styling configuration
 */
export function getResultBadgeConfig(result?: 'win' | 'loss' | 'draw') {
  switch (result) {
    case 'win':
      return {
        className: 'bg-green-100 text-green-800',
        label: 'Victory'
      };
    case 'loss':
      return {
        className: 'bg-red-100 text-red-800',
        label: 'Defeat'
      };
    case 'draw':
      return {
        className: 'bg-yellow-100 text-yellow-800',
        label: 'Draw'
      };
    default:
      return {
        className: 'bg-gray-100 text-gray-800',
        label: 'TBD'
      };
  }
}