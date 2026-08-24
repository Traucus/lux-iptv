/**
 * Shared types for license management
 * Used across main, renderer, and licensing-api
 */

/**
 * License status enum
 */
export type LicenseStatus = 'active' | 'expired' | 'revoked' | 'pending';

/**
 * License interface
 */
export interface License {
  id: string;
  key: string;
  hwid?: string | null;
  activatedAt?: string | null;
  expiresAt?: string | null;
  status: LicenseStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Activation request
 */
export interface ActivateRequest {
  key: string;
  hwid: string;
}

/**
 * Activation response
 */
export interface ActivateResponse {
  success: boolean;
  license?: License;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Validation request
 */
export interface ValidateRequest {
  key: string;
  hwid?: string;
}

/**
 * Validation response
 */
export interface ValidateResponse {
  valid: boolean;
  license?: {
    id: string;
    status: LicenseStatus;
    expiresAt?: string | null;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * License creation request (admin)
 */
export interface CreateLicenseRequest {
  expiresAt?: string;
}

/**
 * License update request (admin)
 */
export interface UpdateLicenseRequest {
  status?: LicenseStatus;
  expiresAt?: string;
}
