/**
 * Validation Utilities
 *
 * Common validation functions for backend services
 */

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates German IBAN format
 * @param iban - IBAN string (with or without spaces)
 */
export function isValidIBAN(iban: string): boolean {
  // Remove spaces and convert to uppercase
  const cleanIBAN = iban.replace(/\s/g, '').toUpperCase();

  // German IBAN: DE followed by 2 check digits and 18 digits
  const germanIBANRegex = /^DE\d{20}$/;

  if (!germanIBANRegex.test(cleanIBAN)) {
    return false;
  }

  // IBAN checksum validation (mod 97 algorithm)
  const rearranged = cleanIBAN.slice(4) + cleanIBAN.slice(0, 4);
  const numericString = rearranged.replace(/[A-Z]/g, (char) =>
    (char.charCodeAt(0) - 55).toString()
  );

  // Calculate mod 97
  let remainder = '';
  for (const digit of numericString) {
    remainder = (parseInt(remainder + digit) % 97).toString();
  }

  return parseInt(remainder) === 1;
}

/**
 * Validates German BIC format
 */
export function isValidBIC(bic: string): boolean {
  // BIC: 8 or 11 characters (4 bank code, 2 country, 2 location, optional 3 branch)
  const bicRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
  return bicRegex.test(bic.toUpperCase());
}

/**
 * Validates German phone number
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Remove spaces, dashes, and parentheses
  const cleanPhone = phone.replace(/[\s\-()]/g, '');

  // German phone: starts with 0 or +49, followed by 9-14 digits
  const germanPhoneRegex = /^(\+49|0)[1-9]\d{8,13}$/;
  return germanPhoneRegex.test(cleanPhone);
}

/**
 * Validates German postal code
 */
export function isValidPostalCode(postalCode: string): boolean {
  // German postal code: exactly 5 digits
  const postalCodeRegex = /^\d{5}$/;
  return postalCodeRegex.test(postalCode);
}

/**
 * Validates date is in the past (for birthdays)
 */
export function isDateInPast(date: string | Date): boolean {
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  return inputDate < new Date();
}

/**
 * Validates age is within range
 */
export function isAgeInRange(
  birthDate: string | Date,
  minAge: number,
  maxAge: number
): boolean {
  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  const actualAge =
    monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())
      ? age - 1
      : age;

  return actualAge >= minAge && actualAge <= maxAge;
}

/**
 * Validates password strength
 * - At least 8 characters
 * - Contains uppercase and lowercase
 * - Contains at least one number
 */
export function isStrongPassword(password: string): boolean {
  if (password.length < 8) return false;

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  return hasUpperCase && hasLowerCase && hasNumber;
}

/**
 * Sanitizes string input (removes HTML tags and trims)
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .trim();
}

/**
 * Validates MongoDB ObjectId format
 */
export function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}
