# ADR 0045: Use private-safe correlated logging

The backend assigns or propagates a correlation ID for each request and emits structured logs for workflow stage, timing, model/tool status, persistence status, and classified errors. Logs must not contain Quick dumps, Derived memory text, prompts, embeddings, model responses, or other private content. This supports Cloud Run and Cloud Logging diagnosis without creating an uncontrolled duplicate memory store.
