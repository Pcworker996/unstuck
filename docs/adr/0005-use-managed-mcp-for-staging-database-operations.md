# Use the Managed MCP Server for staging database operations

Unstuck will use the CockroachDB Cloud Managed MCP Server through an AI-assisted development workflow against its actual staging database for schema inspection, migrations, user-scoped retrieval validation, and diagnosis. The customer-facing pivot guide will use constrained backend operations instead of direct MCP access, because private entries require application-enforced ownership boundaries.
