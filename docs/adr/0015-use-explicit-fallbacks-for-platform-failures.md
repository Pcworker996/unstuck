# Use explicit fallbacks for platform failures

Safety evaluation remains deterministic and local. If Bedrock or vector retrieval is unavailable, the Pivot Guide returns a curated, non-personalized Pivot; if CockroachDB persistence fails, the response states that the outcome was not saved. The system must never claim memory influence or persistence unless those operations succeeded.
