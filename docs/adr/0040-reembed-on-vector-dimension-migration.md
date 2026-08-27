# ADR 0040: Re-embed memories when vector dimensions change

The schema migration from the deterministic `VECTOR(6)` fixture representation to Titan’s `VECTOR(1024)` representation replaces the incompatible vector column/index and requires regeneration of every existing embedding. The system must not cast or mix vectors of different dimensions. MVP fixtures are regenerated during migration preparation; any real stored memories must be re-embedded before retrieval is enabled against the new index.
