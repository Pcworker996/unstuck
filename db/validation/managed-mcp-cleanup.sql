-- Remove only the synthetic validation rows from staging.
-- Run through Managed MCP after the retrieval checks pass.

DELETE FROM check_ins
WHERE account_id LIKE 'mcp-fixture-%';

DELETE FROM personal_accounts
WHERE account_id LIKE 'mcp-fixture-%';
