/**
 * Date formatting utilities using Intl.DateTimeFormat
 * Provides consistent, internationalized date formatting across the app
 */

/**
 * Format a date using the browser's locale
 * @param date - Date string or Date object
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(undefined, options).format(dateObj);
  } catch {
    console.error('Date formatting failed');
    return 'Invalid date';
  }
}

/**
 * Format a date with short format (e.g., "1/15/26")
 */
export function formatDateShort(date: string | Date): string {
  return formatDate(date, { dateStyle: 'short' });
}

/**
 * Format a date with medium format (e.g., "Jan 15, 2026")
 */
export function formatDateMedium(date: string | Date): string {
  return formatDate(date, { dateStyle: 'medium' });
}

/**
 * Format a date with long format (e.g., "January 15, 2026")
 */
export function formatDateLong(date: string | Date): string {
  return formatDate(date, { dateStyle: 'long' });
}

/**
 * Format a date with full format (e.g., "Wednesday, January 15, 2026")
 */
export function formatDateFull(date: string | Date): string {
  return formatDate(date, { dateStyle: 'full' });
}

/**
 * Format a date and time
 */
export function formatDateTime(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
  }
): string {
  return formatDate(date, options);
}
