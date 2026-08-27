# ADR 0048: Return safety as a typed success result

The Pivot endpoint returns an HTTP 200 response for a safety interruption because it is an expected product outcome rather than a malformed request or server failure. The JSON uses a discriminated result such as `{ kind: "safety-interruption", ... }`, allowing the frontend to render the approved interruption flow without treating it as an infrastructure error.
