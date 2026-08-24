# Spec: TMDB Key Management

## Purpose

Securely store and manage the user's TMDB API key so it is never persisted in plaintext. The user-facing outcome is a trustable credential system where the API key can be entered, validated, encrypted, and used for enrichment without exposure in logs, dev tools, or storage inspection.

## Requirements

### REQ-TMDBKEY-1: Encrypted Storage

The system SHALL encrypt the TMDB API key before persisting it, using AES-256 with a key derived from the machine's HWID per DOC-8 §8.7.

#### Scenario: Store API key

- GIVEN the user enters a valid TMDB API key
- WHEN the system persists it
- THEN the key is encrypted with AES-256 before writing to IndexedDB
- AND the stored record contains `encrypted_value`, `created_at`, `last_validated_at`
- AND the plaintext key is NEVER written to disk, logs, or IndexedDB

#### Scenario: Retrieve API key

- GIVEN an encrypted API key exists in storage
- WHEN the enrichment worker needs to call TMDB
- THEN the system decrypts the key in memory using the HWID-derived key
- AND the decrypted key is used for the API call then immediately discarded from memory

### REQ-TMDBKEY-2: Key Validation

The system SHALL validate the TMDB API key before persisting it by making a test call to the TMDB API.

#### Scenario: Valid API key

- GIVEN the user enters a TMDB API key
- WHEN they click "Validate and Save"
- THEN the system calls `GET /configuration` on the TMDB API with the key
- AND on HTTP 200 response, the key is encrypted and persisted
- AND the UI shows status "Configured" (green)

#### Scenario: Invalid API key

- GIVEN the user enters an invalid or expired TMDB API key
- WHEN they click "Validate and Save"
- THEN the TMDB API returns HTTP 401
- AND the key is NOT persisted
- AND the UI shows status "Invalid" (red) with an error message

### REQ-TMDBKEY-3: No Plaintext Leakage

The system SHALL ensure the TMDB API key never appears in plaintext in any persistent storage, console logs, network inspector, or error messages.

#### Scenario: Console log protection

- GIVEN the enrichment worker processes API calls
- WHEN a TMDB request fails
- THEN error logs contain `"TMDB API error"` but NOT the actual API key
- AND the key is redacted in any serialized error objects

#### Scenario: DevTools inspection

- GIVEN the API key is stored in IndexedDB
- WHEN a developer inspects IndexedDB via DevTools
- THEN they see only the `encrypted_value` string
- AND no plaintext key is recoverable from IndexedDB inspection

## Out of Scope

- Backend proxy for TMDB (future premium feature per DOC-8 §8.7)
- Key rotation or expiration policies
- Multi-service key management (license key is separate, DOC-6)
