# ADR 0044: Bound Bedrock timeouts and retries

Each Bedrock request has a strict timeout and may be retried at most once for a classified transient platform failure using a short backoff. Safety interruptions, invalid model output, authentication failures, tool-loop violations, and other non-transient errors are not retried. After the bounded retry fails, the application returns its curated fallback and does not continue the agent loop.
