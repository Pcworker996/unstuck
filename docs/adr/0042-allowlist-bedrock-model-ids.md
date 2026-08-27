# ADR 0042: Allowlist Bedrock model IDs

The Bedrock adapter accepts model IDs only from a server-side allowlist containing Amazon Titan Text Embeddings V2 and the configured Amazon Nova Lite generation model. The browser cannot choose a model, and any unapproved or missing model ID fails closed into the explicit platform fallback. This keeps capability and cost changes under deployment control.
