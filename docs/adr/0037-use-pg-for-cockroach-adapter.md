# ADR 0037: Use `pg` for the CockroachDB adapter

The production CockroachDB adapter uses Node’s standard `pg` client with parameterized SQL, explicit transactions, and the existing SQL migration files. The adapter owns vector query syntax and row mapping so the application service depends on domain interfaces rather than database details. An ORM is not introduced for the MVP because it would add abstraction around the required Cockroach vector operations.
