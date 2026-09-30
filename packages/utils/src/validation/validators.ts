import type { ValidationResult } from "@esli-cosmetics/types";
import { REGEX_PATTERNS } from "../lib/constants";

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  return REGEX_PATTERNS.email.test(email);
}

/**
 * Validate phone number format
 */
export function validatePhone(phone: string): boolean {
  return REGEX_PATTERNS.phone.test(phone);
}

/**
 * Validate SKU format
 */
export function validateSku(sku: string): boolean {
  return REGEX_PATTERNS.sku.test(sku);
}

/**
 * Validate barcode format
 */
export function validateBarcode(barcode: string): boolean {
  return REGEX_PATTERNS.barcode.test(barcode);
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];

  if (password.length < 6) {
    errors.push("Contraseña debe tener mínimo 6 caracteres");
  }

  if (password.length > 100) {
    errors.push("Contraseña debe tener máximo 100 caracteres");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Contraseña debe contener al menos una minúscula");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Contraseña debe contener al menos una mayúscula");
  }

  if (!/\d/.test(password)) {
    errors.push("Contraseña debe contener al menos un número");
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Validate Nicaraguan ID number (Cédula)
 */
export function validateNicaraguanId(cedula: string): boolean {
  // Remove any spaces or hyphens
  const cleanCedula = cedula.replace(/[\s-]/g, "");

  // Nicaraguan cédula format: 001-DDMMYY-XXXX# or DDMMYY-XXXX-XXXX#
  const cedulaRegex = /^\d{3}\d{6}\d{4}\w{1}$/;

  return cedulaRegex.test(cleanCedula) && cleanCedula.length === 14;
}

/**
 * Validate required field
 */
export function validateRequired(
  value: unknown,
  fieldName: string
): string | undefined {
  if (value === null || value === undefined || value === "") {
    return `${fieldName} es requerido`;
  }
  return undefined;
}

/**
 * Validate number range
 */
export function validateNumberRange(
  value: number,
  min?: number,
  max?: number,
  fieldName = "Campo"
): string | undefined {
  if (typeof value !== "number" || isNaN(value)) {
    return `${fieldName} debe ser un número válido`;
  }

  if (min !== undefined && value < min) {
    return `${fieldName} debe ser mayor o igual a ${min}`;
  }

  if (max !== undefined && value > max) {
    return `${fieldName} debe ser menor o igual a ${max}`;
  }

  return undefined;
}

/**
 * Validate string length
 */
export function validateStringLength(
  value: string,
  min?: number,
  max?: number,
  fieldName = "Campo"
): string | undefined {
  if (typeof value !== "string") {
    return `${fieldName} debe ser texto válido`;
  }

  if (min !== undefined && value.length < min) {
    return `${fieldName} debe tener mínimo ${min} caracteres`;
  }

  if (max !== undefined && value.length > max) {
    return `${fieldName} debe tener máximo ${max} caracteres`;
  }

  return undefined;
}

/**
 * Validate date range
 */
export function validateDateRange(
  date: Date,
  minDate?: Date,
  maxDate?: Date,
  fieldName = "Fecha"
): string | undefined {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return `${fieldName} debe ser una fecha válida`;
  }

  if (minDate && date < minDate) {
    return `${fieldName} debe ser posterior a ${minDate.toLocaleDateString()}`;
  }

  if (maxDate && date > maxDate) {
    return `${fieldName} debe ser anterior a ${maxDate.toLocaleDateString()}`;
  }

  return undefined;
}
