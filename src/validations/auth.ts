import { RegisterPassengerInput } from '@/types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_REGEX = /^(\+63|0)?9\d{9}$/;

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required.';
  if (!EMAIL_REGEX.test(email.trim())) return 'Please enter a valid email address.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
}

export function validateMobileNumber(mobileNumber: string): string | null {
  const normalized = mobileNumber.replace(/\s/g, '');
  if (!normalized) return 'Mobile number is required.';
  if (!MOBILE_REGEX.test(normalized)) {
    return 'Please enter a valid Philippine mobile number (e.g. 09171234567).';
  }
  return null;
}

export function validateRegisterInput(input: RegisterPassengerInput): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.fullName.trim()) {
    errors.fullName = 'Full name is required.';
  }

  const emailError = validateEmail(input.email);
  if (emailError) errors.email = emailError;

  const passwordError = validatePassword(input.password);
  if (passwordError) errors.password = passwordError;

  if (!input.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (input.password !== input.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  const mobileError = validateMobileNumber(input.mobileNumber);
  if (mobileError) errors.mobileNumber = mobileError;

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateLoginInput(email: string, password: string): ValidationResult {
  const errors: Record<string, string> = {};

  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;

  if (!password) {
    errors.password = 'Password is required.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function normalizeMobileNumber(mobileNumber: string): string {
  const digits = mobileNumber.replace(/\D/g, '');
  if (digits.startsWith('63') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `+63${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith('9')) {
    return `+63${digits}`;
  }
  return mobileNumber.trim();
}
