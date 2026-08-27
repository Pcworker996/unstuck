# ADR 0019: Retrieve at most three Derived memories

The memory retrieval boundary returns at most the three highest-scoring owner-scoped Derived memories that are eligible for retrieval. This gives the Pivot guide enough context to compare recurring patterns while keeping prompts bounded and limiting exposure of historical information. The backend remains responsible for ranking, eligibility, and the result limit; the model receives only the returned Derived context and outcome metadata.
