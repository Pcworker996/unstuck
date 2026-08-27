# ADR 0025: Use Derived context in the final recommendation

The final Pivot recommendation turn receives the current Check-in’s factual Derived context and the bounded set of retrieved historical Derived memories, but not the raw current Quick dump. The raw Quick dump is permitted in the consented preprocessing step that creates the current Derived context. This keeps the recommendation prompt concise, preserves the distinction between current processing and historical memory, and ensures the final recommendation is grounded in the same representation used for semantic retrieval.
