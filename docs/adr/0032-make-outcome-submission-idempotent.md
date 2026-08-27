# ADR 0032: Make outcome submission idempotent

The outcome endpoint treats repeated submission of the same outcome for a Check-in as an idempotent retry and returns the existing saved result. A conflicting second outcome for the same Check-in is rejected rather than overwriting history. This protects against browser/network retries while preserving one authoritative outcome per Check-in.
