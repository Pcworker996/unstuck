# ADR 0021: Use a configurable memory similarity threshold

The backend applies a configurable minimum cosine-similarity threshold to owner-scoped memory retrieval, initially targeting 0.5 for the MVP. It returns only eligible results at or above the threshold, up to the top three; if none qualify, retrieval returns a valid no-match result. This prevents weak semantic matches from being treated as meaningful personal patterns while leaving room for evaluation-driven tuning.
