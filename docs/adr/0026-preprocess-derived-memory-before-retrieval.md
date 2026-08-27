# ADR 0026: Preprocess the current Derived memory before retrieval

The backend performs a separate consented preprocessing step before the bounded agent loop: Bedrock creates the current factual Derived memory, and Titan Text Embeddings V2 creates its normalized embedding. Only after both succeed does the backend invoke the required retrieval attempt and the final recommendation turn. This sequencing makes the current Derived representation available as the semantic query while keeping the tool loop bounded and auditable.
