# ADR 0033: Gate the development auth bypass explicitly

Local development may use a fixed test identity only when an explicit development configuration flag such as `UNSTUCK_DEV_AUTH=true` is enabled. The bypass must be unavailable in production, where every request requires a verified Cognito ID token and the backend derives the account from its subject. This keeps local testing practical without weakening deployed identity isolation.
