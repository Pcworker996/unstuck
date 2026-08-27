# ADR 0024: Bind retrieval inputs server-side

The `retrieve_similar_memories` tool exposes no model-controlled account identifier, raw query, or vector. The backend binds the authenticated account, the current Check-in’s Derived-memory embedding, the configured similarity threshold, and the top-three limit from the server-side run context. This keeps identity, privacy, and retrieval policy outside model control while preserving a simple bounded tool request.
