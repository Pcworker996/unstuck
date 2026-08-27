# ADR 0043: Use model-specific Bedrock APIs

The Bedrock adapter invokes Titan Text Embeddings V2 through `InvokeModel` and invokes Nova Lite through `Converse` with the constrained retrieval tool configuration. The application service depends on higher-level generation and embedding interfaces, so model-specific request and response formats remain isolated in the production adapter.
