# ADR 0027: Do not persist when memory preparation fails

If Bedrock cannot create the current Derived memory or Titan cannot create its embedding, the backend must not persist the raw Quick dump or an incomplete searchable memory record. It returns a curated non-personalized Pivot and clearly reports that memory was not saved. This preserves the user’s privacy and prevents records that cannot participate correctly in the retrieval lifecycle.
