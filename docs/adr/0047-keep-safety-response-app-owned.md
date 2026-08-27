# ADR 0047: Keep the safety response app-owned

Safety interruptions use a deterministic application-owned response containing the approved interruption message and support resources. Bedrock is never asked to compose, summarize, or modify safety-critical wording. This keeps the safety experience stable and reviewable even when the model provider is unavailable or behaves unexpectedly.
