# ADR 0034: Upsert the personal account on first authenticated use

After verifying a Cognito ID token, the backend upserts the corresponding `personal_accounts` row using the token subject as the stable external identity. The request then uses the database account ID for all ownership checks and persistence. This removes a separate onboarding dependency while preserving server-derived account ownership.
