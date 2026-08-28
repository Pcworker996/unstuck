# ADR 0029: Validate Derived memory output before persistence

Gemini must return the current Derived memory in a strict structured shape containing a short factual context. The backend validates the shape, length, and allowed content before creating the Firestore record; it rejects output containing diagnosis, personality labels, crisis predictions, or invented facts. Invalid output follows the non-persistent curated fallback path.
