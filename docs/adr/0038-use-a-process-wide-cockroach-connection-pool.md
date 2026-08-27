# ADR 0038: Use a process-wide CockroachDB connection pool

Each ECS task creates one server-side `pg.Pool` per Next.js process and reuses it across requests, with a small configured connection limit, Cockroach TLS settings, and guaranteed client release in `finally` blocks. The pool is never exposed to the browser and individual requests do not create independent database connections. This matches the long-lived container process while limiting connection pressure on the database as ECS scales the task count.
