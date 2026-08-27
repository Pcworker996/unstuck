# ADR 0020: Query memory with the current Derived memory embedding

After consent, the backend uses the embedding generated from the current Check-in’s factual Derived memory as the semantic retrieval query. The raw Quick dump may be sent to Bedrock for current processing, but it is not embedded or passed directly into the SQL/vector query layer. Using the same Derived representation for stored memories and the current query keeps retrieval consistent and limits the database boundary to privacy-filtered context.
