# ADR 0049: Return typed platform fallbacks

Expected Bedrock, embedding, and vector-retrieval degradation returns HTTP 200 with a typed fallback protocol result when the application can still provide a curated Pivot. The response explicitly reports memory and persistence status so it never claims unavailable memory influence or a saved record. Malformed requests, authentication failures, authorization failures, conflicts, and unrecoverable server errors use appropriate 4xx or 5xx responses.
