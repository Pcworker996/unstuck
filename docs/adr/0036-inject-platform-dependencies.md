# ADR 0036: Inject platform dependencies into the Pivot service

The Pivot application service depends on interfaces for Bedrock generation, Titan embedding, CockroachDB persistence/retrieval, and clock/ID generation. Production adapters provide the real AWS and CockroachDB clients, while tests provide deterministic fakes. This keeps the agent workflow independently testable and makes platform failures and fallback behavior explicit.
