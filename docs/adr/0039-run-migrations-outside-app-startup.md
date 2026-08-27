# ADR 0039: Run migrations outside application startup

CockroachDB schema migrations are an explicit setup/deployment step executed and verified before the ECS image version that depends on them is released. The web process does not run migrations during container startup. This keeps startup safe across multiple tasks and makes schema changes observable, repeatable, and independently recoverable.
