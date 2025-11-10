/**
 * Form validation utilities for membership application
 *
 * IMPORTANT: Validation rules here are intentionally duplicated with backend validation.
 * 
 * Frontend validation (this file):
 * - Purpose: Fast UX feedback without network round-trips
 * - Behavior: Progressive disclosure, partial validation as user fills form
 * - User-friendly error messages
 * 
 * Backend validation (apps/api/src/models/MembershipApplication.ts):
 * - Purpose: Security boundary and data integrity enforcement
 * - Behavior: Strict validation on all incoming data
 * - Cannot be bypassed by malicious users
 * 
 * Maintenance: When updating validation rules:
 * 1. Update backend schema first (security boundary)
 * 2. Update frontend validation to match (this file)
 * 3. Update integration tests to verify consistency
 * 
 * See: openspec/ARCHITECTURE.md#validation-strategy for full rationale
 */

export interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  phone: string;
  birthday: string;
  gender: string;
  city: string;
  postalCode: string;
  country: string;
  membershipType: string;
  debitFrequency: string;
  accountHolderFirstName: string;
  accountHolderLastName: string;
  accountHolderAddress: string;
  bankName: string;
  bic: string;
  hasConditions: boolean;
  conditions: string;
  canParticipate: boolean;
  motivation: string;
  iban: string;
}

export interface ValidationErrors {
  [key: string]: string[];
}

// IBAN validation function with improved algorithm
export const validateIBAN = (iban: string): boolean => {
  // Remove spaces and convert to uppercase
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();

  // Check minimum length and German IBAN format
  if (cleanIban.length < 15 || !cleanIban.startsWith('DE')) {
    return false;
  }

  // Basic German IBAN length check (22 characters)
  if (cleanIban.length !== 22) {
    return false;
  }

  // More sophisticated IBAN validation could be implemented here
  // For now, we'll check basic format requirements
  const ibanRegex = /^DE\d{20}$/;
  return ibanRegex.test(cleanIban);
};

// Email validation - matches server-side pattern
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  return emailRegex.test(email);
};

// Phone validation (basic)
export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[\+]?[\d\s\-\(\)]{8,}$/;
  return phoneRegex.test(phone);
};

// Date validation (ensure user is at least 14 years old and not in the future)
export const validateBirthday = (birthday: string): boolean => {
  if (!birthday) return false;

  const birthDate = new Date(birthday);
  const today = new Date();
  const minAge = 14;

  // Check if date is valid
  if (isNaN(birthDate.getTime())) return false;

  // Check if date is not in the future
  if (birthDate > today) return false;

  // Check minimum age
  const ageInYears = (today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return ageInYears >= minAge;
};

// Main validation function
export const validateForm = (data: FormData, t: any, accountHolderType?: 'same' | 'different', hasSEPADebit?: boolean, submissionMode?: 'full' | 'membership-only' | 'sepa-only'): ValidationErrors => {
  const errors: ValidationErrors = {};

  // Different required fields based on submission mode
  let requiredFields: string[] = [];

  if (submissionMode === 'sepa-only') {
    // For SEPA-only mode, validate banking information and account holder details
    requiredFields = ['accountHolderFirstName', 'accountHolderLastName', 'accountHolderAddress', 'email', 'debitFrequency', 'bankName', 'iban'];
  } else if (submissionMode === 'membership-only') {
    // For membership-only mode, only validate personal info and membership details
    requiredFields = [
      'firstName', 'lastName', 'email', 'address', 'phone',
      'birthday', 'gender', 'city', 'postalCode', 'country',
      'membershipType'
    ];
  } else {
    // Full application mode - all personal info required
    requiredFields = [
      'firstName', 'lastName', 'email', 'address', 'phone',
      'birthday', 'gender', 'city', 'postalCode', 'country',
      'membershipType'
    ];

    // Add SEPA-related fields to required list (full mode always includes SEPA)
    requiredFields.push('debitFrequency', 'bankName', 'iban');

    // Add account holder fields to required list only if different from applicant
    if (accountHolderType === 'different') {
      requiredFields.push('accountHolderFirstName', 'accountHolderLastName', 'accountHolderAddress');
    }
  }

  requiredFields.forEach(field => {
    const value = data[field as keyof FormData];
    if (typeof value === 'string' && !value.trim()) {
      errors[field] = [t('validation.required')];
    } else if (typeof value === 'boolean') {
      // Boolean fields don't need trim validation
      return;
    } else if (!value) {
      errors[field] = [t('validation.required')];
    }
  });

  // Email validation
  if (data.email && !validateEmail(data.email)) {
    errors.email = [t('validation.email')];
  }

  // Phone validation
  if (data.phone && !validatePhone(data.phone)) {
    errors.phone = [t('validation.phone') || 'Please enter a valid phone number'];
  }

  // Birthday validation - only for modes that require full personal info
  if (submissionMode !== 'sepa-only' && data.birthday && !validateBirthday(data.birthday)) {
    errors.birthday = [t('validation.birthday') || 'Please enter a valid date (minimum age 14)'];
  }

  // IBAN validation - validate if in full mode or sepa-only mode
  if ((submissionMode === 'full' || submissionMode === 'sepa-only') && data.iban && !validateIBAN(data.iban)) {
    errors.iban = [t('validation.invalidIBAN')];
  }

  // Name validation (only letters, spaces, hyphens, apostrophes)
  const nameRegex = /^[a-zA-ZäöüÄÖÜß\s\-\']+$/;
  if (data.firstName && !nameRegex.test(data.firstName)) {
    errors.firstName = [t('validation.invalidName') || 'Please enter a valid name'];
  }
  if (data.lastName && !nameRegex.test(data.lastName)) {
    errors.lastName = [t('validation.invalidName') || 'Please enter a valid name'];
  }

  return errors;
};

// Format IBAN for display (add spaces every 4 characters)
export const formatIBAN = (iban: string): string => {
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();
  return cleanIban.replace(/(.{4})/g, '$1 ').trim();
};

// Clean IBAN for submission (remove spaces)
export const cleanIBAN = (iban: string): string => {
  return iban.replace(/\s/g, '').toUpperCase();
};