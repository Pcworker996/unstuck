# Use normalized 1,024-dimensional Titan Text Embeddings V2 vectors

Unstuck will use Amazon Titan Text Embeddings V2 for semantic retrieval, request normalized floating-point vectors with 1,024 dimensions, and migrate the Derived-memory embedding column and fixtures from `VECTOR(6)` to `VECTOR(1024)`. Query and stored vectors must use the same model and dimension; existing deterministic vectors will not be mixed into the production index.
